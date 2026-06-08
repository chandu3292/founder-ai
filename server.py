import os
import json
import uuid
import uvicorn
import logging
import warnings
from datetime import datetime, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP
from google import genai
from google.genai import types
from livekit import api

from agent_personas import list_personas, get_persona, DEFAULT_PERSONA_ID
from calendar_integration import get_appointment_manager
from about import ABOUT, FOUNDER_NAME, FOUNDER_SHORT

warnings.filterwarnings("ignore", category=UserWarning, module='cryptography')
logger = logging.getLogger("server")

app = FastAPI()
mcp = FastMCP("Founder AI")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
load_dotenv()

CHAT_MODEL = os.getenv("CHAT_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
google_client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY")) if os.getenv("GOOGLE_API_KEY") else None

active_persona_id: str = DEFAULT_PERSONA_ID
chat_histories: dict = {}

SYSTEM = (
    f"You are the personal AI assistant of {FOUNDER_NAME}. You speak on his behalf to visitors of his "
    f"portfolio. Be warm, confident and concise. Answer questions about {FOUNDER_SHORT}'s background, research, "
    "projects, skills and experience using the profile below. If a visitor wants to connect or hire him, offer "
    "to book a meeting. If something is not in the profile, say you are not sure and suggest booking a quick call. "
    "You can check real availability and book meetings yourself using your tools, so never say you cannot access "
    "the calendar. To book: ask for a preferred date, call check_and_book_appointment to get the real slots, present "
    "ONLY the starting times, then collect the visitor's name and email and call schedule_appointment. When calling "
    "schedule_appointment, pass the agreed time as a clear phrase like 'tomorrow 10 AM'. If the visitor "
    "gives only a time with no date, assume tomorrow. Briefly acknowledge before calling a tool. "
    "Detect the visitor's language and reply in the same language. "
    "Do not use em-dashes (the long dash); use commas or short sentences instead.\n\n"
    f"PROFILE:\n{ABOUT}"
)


@app.get("/")
async def read_index():
    return FileResponse('frontend/dist/index.html')


@app.get("/token")
def get_token(persona: str = None):
    pid = persona or active_persona_id
    p = get_persona(pid)
    room_name = f"room-{uuid.uuid4().hex[:8]}"
    metadata = json.dumps({"persona_id": pid, "language": p["language"] if p else "en"})
    at = api.AccessToken(os.environ["LIVEKIT_API_KEY"], os.environ["LIVEKIT_API_SECRET"]) \
        .with_identity("web-user").with_grants(api.VideoGrants(room_join=True, room=room_name)) \
        .with_metadata(metadata) \
        .with_room_config(api.RoomConfiguration(agents=[api.RoomAgentDispatch(agent_name="founder")]))
    return {"token": at.to_jwt(), "url": os.getenv("LIVEKIT_URL", "ws://localhost:7880")}


class ChatMessage(BaseModel):
    message: str
    session_id: str = "default"


@app.post("/api/chat")
async def chat(req: ChatMessage):
    if not google_client:
        return {"status": "error", "message": "Gemini API key not configured"}
    user_message = req.message.strip()
    if not user_message:
        return {"status": "error", "message": "Empty message"}
    history = chat_histories.setdefault(req.session_id, [])
    contents = []
    for msg in history[-20:]:
        contents.append({"role": msg["role"], "parts": [{"text": msg["text"]}]})
    contents.append({"role": "user", "parts": [{"text": user_message}]})
    try:
        cfg = types.GenerateContentConfig(system_instruction=SYSTEM, tools=CHAT_TOOLS)
        response = google_client.models.generate_content(model=CHAT_MODEL, contents=contents, config=cfg)
        text = response.text
        history.append({"role": "user", "text": user_message})
        history.append({"role": "model", "text": text})
        if len(history) > 100:
            chat_histories[req.session_id] = history[-60:]
        return {"status": "success", "response": text}
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/api/chat/clear")
async def clear_chat(data: dict = {}):
    chat_histories.pop(data.get("session_id", "default"), None)
    return {"status": "ok"}


@app.get("/api/personas")
async def get_personas():
    return {"personas": list_personas(), "active_persona_id": active_persona_id}


class SetPersonaRequest(BaseModel):
    persona_id: str


@app.post("/api/set-persona")
async def set_persona(req: SetPersonaRequest):
    global active_persona_id
    if not get_persona(req.persona_id):
        return {"status": "error", "message": f"Unknown persona: {req.persona_id}"}
    active_persona_id = req.persona_id
    return {"status": "ok", "active_persona_id": active_persona_id}


# --- MCP tools (used by the voice agent) ---
def query_knowledge_base(question: str, source_name: str = None) -> str:
    """Return Chandra's profile so the agent can answer questions about him."""
    return f"Profile of {FOUNDER_NAME}:\n{ABOUT}"


def get_appointment_info() -> str:
    """Get current meeting configuration like duration."""
    try:
        from calendar_integration.constants import TASK_TYPES
        duration = TASK_TYPES.get("appointment", {}).get("duration_minutes", 30)
    except (ImportError, ModuleNotFoundError):
        duration = 30
    return (f"Meetings with {FOUNDER_SHORT} are about {max(1, duration // 60)} hour(s) long. "
            "They are stored in Google Calendar and managed in India Standard Time (IST).")


def check_and_book_appointment(date_text: str) -> str:
    """Check meeting availability for a given date or day string."""
    manager = get_appointment_manager()
    dt = manager.parse_date_time(date_text)
    if not dt:
        return f"I couldn't understand the date '{date_text}'. Could you say it more clearly?"
    slots = manager.get_available_slots(dt, "appointment")
    if not slots:
        nxt = manager.find_next_available_slot("appointment", from_date=dt)
        if nxt and nxt.get("found"):
            resp = f"No slots on {dt.strftime('%A, %B %d')}. Next available: {nxt['date_formatted']}.\n"
            for s in nxt['all_slots']:
                resp += f"- {s['formatted']} (Start ISO: {s['start']})\n"
            return resp
        return f"No available slots starting from {dt.strftime('%B %d')}."
    resp = f"Available slots for {dt.strftime('%A, %B %d')}:\n"
    for s in slots:
        resp += f"- {s['formatted']} (Start ISO: {s['start'].isoformat()})\n"
    return resp


def schedule_appointment(start_time_iso: str, user_name: str, user_email: str, user_phone: str = None, notes: str = None) -> str:
    """Schedule a meeting with Chandra at the specified start time."""
    manager = get_appointment_manager()
    try:
        if 'T' in start_time_iso:
            start_dt = datetime.fromisoformat(start_time_iso.replace('Z', '+00:00'))
        else:
            start_dt = manager.parse_date_time(start_time_iso)
    except Exception as e:
        return f"Error: Invalid start time format. {e}"
    if not start_dt:
        return f"Error: Could not parse start time '{start_time_iso}'."
    result = manager.create_appointment(user_id=1, user_name=user_name, user_email=user_email,
                                         task_type="appointment", start_time=start_dt, notes=notes, phone=user_phone)
    if result.get("success"):
        return manager.format_appointment_confirmation(result["appointment"])
    error = result.get("error", "Unknown error")
    if "already passed" in error.lower() or "past time" in error.lower():
        nxt = manager.find_next_available_slot("appointment", from_date=start_dt + timedelta(days=1))
        if nxt and nxt.get("found"):
            return f"That time passed. Next available: {nxt['date_formatted']} at {nxt['first_slot']['formatted']}."
    return f"Failed to schedule: {error}"


# Register the tools with MCP (for the voice agent). The same plain callables are
# also handed to the text chat below, so chat can check slots and book too.
for _tool in (query_knowledge_base, get_appointment_info, check_and_book_appointment, schedule_appointment):
    mcp.tool()(_tool)

# Tools exposed to the Gemini text chat (booking, not the profile lookup which is already in-prompt)
CHAT_TOOLS = [get_appointment_info, check_and_book_appointment, schedule_appointment]


mcp_sse = mcp.sse_app()
app.mount("/mcp", mcp_sse)
if not os.path.exists("sessions"):
    os.makedirs("sessions")
app.mount("/sessions", StaticFiles(directory="sessions"), name="sessions")
app.mount("/", StaticFiles(directory="frontend/dist"), name="static")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8006))
    uvicorn.run(app, host="0.0.0.0", port=port, log_config=None)

