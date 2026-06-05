import asyncio
import logging
import os
import datetime
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    AutoSubscribe,
    cli,
    mcp,
)
from livekit import rtc
from livekit.agents.voice import ConversationItemAddedEvent
import wave
import json
from livekit.plugins import silero, google
from livekit.plugins.deepgram import STT as DeepgramSTT
from livekit.plugins.cartesia import TTS as CartesiaTTS
from agent_personas import get_voice_id, get_persona, DEFAULT_PERSONA_ID

import sys
os.environ["PYTHONIOENCODING"] = "utf-8"
logging.basicConfig(
    level=logging.INFO,
    handlers=[logging.StreamHandler(stream=open(sys.stdout.fileno(), mode='w', encoding='utf-8', closefd=False))]
)
logger = logging.getLogger("mcp-agent")

load_dotenv()

os.environ["LIVEKIT_DISABLE_GATEWAYS"] = "true"
os.environ["LIVEKIT_DISABLE_AGENT_GATEWAY"] = "true"

server = AgentServer(
    load_threshold=float('inf'),
    num_idle_processes=1,
    port=8082,            # avoid clash with the four2labs agent's health server (8081) on the shared host
    prometheus_port=9101,
)


class MyAgent(Agent):
    def __init__(self, forced_language, participant_identity, room_name, transcript_file, persona_name="Sophia"):
        lang_names = {"en": "English", "te": "Telugu", "hi": "Hindi"}
        target_lang = lang_names.get(forced_language, "English")
        self.persona_name = persona_name

        base_instruction = (
            f"Your name is {persona_name}. You are the personal AI assistant of Chandra Sekhar Karri, "
            "an AI engineer and researcher. You speak on his behalf to visitors of his portfolio. "
            f"STRICTLY respond ONLY in {target_lang}. "
            "Keep responses extremely concise and natural, like a real conversation. "
            "Never use em-dashes (the long dash) in anything you say; use commas or short sentences instead. "
            "For ANY question about Chandra (his background, research, projects, skills, experience, education, "
            "publications or achievements), you MUST call the tool 'query_knowledge_base' and answer from that profile. "
            "Speak about him warmly and confidently, referring to him as 'he' or 'Chandra'. "
            "Only say you are not sure if the profile does not cover it, and then offer to book a quick call with him. "
            f"STRICTLY call the tool in {target_lang}."
            "\n\nBOOKING A MEETING WITH CHANDRA:\n"
            "If the visitor wants to connect, hire, collaborate with, or talk to Chandra, offer to book a meeting.\n"
            "All meetings are stored in Google Calendar. Current timezone: India Standard Time (IST).\n"
            "When the visitor mentions a date or asks to book:\n"
            "1. As soon as they mention a date or day (e.g., 'tomorrow', 'next Monday'), say 'Let me check the availability' and immediately call 'check_and_book_appointment'.\n"
            "2. If they mention only a TIME without a DATE, default to tomorrow's date.\n"
            "3. Present ONLY the starting times of the available slots (e.g., 'I have slots at 9 AM and 10 AM').\n"
            "4. Once they confirm a time, collect their name, email, and optionally phone.\n"
            "5. Confirm all the details, then say 'One moment, I am booking your meeting' and call 'schedule_appointment'.\n"
            "6. If it fails because the time has passed, suggest the next available date.\n"
            "7. Tell them the meeting is on the calendar and they will receive an invitation.\n"
            "Always give a brief acknowledgment before calling any tool."
        )

        super().__init__(instructions=base_instruction)
        self.forced_language = forced_language
        self.voice_session = None
        self.iteration_count = 0

    async def on_user_turn_completed(self, turn_ctx, new_message):
        self.iteration_count += 1

    async def on_enter(self):
        logger.info(f"Agent on_enter called. Language: {self.forced_language}")
        if not self.voice_session:
            return

        if self.forced_language == "hi":
            greeting = (
                f"नमस्ते! मैं {self.persona_name} हूँ, चंद्रा की AI सहायक। "
                "मैं आपको उनके AI और रिसर्च के काम के बारे में बता सकती हूँ, या उनके साथ मीटिंग बुक कर सकती हूँ। "
                "आप क्या जानना चाहेंगे?"
            )
        elif self.forced_language == "te":
            greeting = (
                f"నమస్తే! నేను {self.persona_name}, చంద్ర యొక్క AI అసిస్టెంట్. "
                "ఆయన AI మరియు పరిశోధన పని గురించి నేను మీకు చెప్పగలను, లేదా ఆయనతో మీటింగ్ బుక్ చేయగలను. "
                "మీరు ఏమి తెలుసుకోవాలనుకుంటున్నారు?"
            )
        else:
            greeting = (
                f"Hi there! I'm {self.persona_name}, Chandra's AI assistant. "
                "I can tell you about his work in AI and research, or book a meeting with him. "
                "What would you like to know?"
            )

        await asyncio.sleep(1)
        await self.voice_session.say(
            greeting,
            allow_interruptions=False,
            add_to_chat_ctx=False
        )

        if hasattr(self, "log_callback") and self.log_callback:
            self.log_callback("assistant", greeting)


@server.rtc_session(agent_name="founder")
async def entrypoint(ctx: JobContext):

    await ctx.connect(auto_subscribe=AutoSubscribe.SUBSCRIBE_ALL)

    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    # Read persona and language from participant metadata
    persona_id = DEFAULT_PERSONA_ID
    forced_language = "en"
    try:
        meta = json.loads(participant.metadata or "{}")
        persona_id = meta.get("persona_id", DEFAULT_PERSONA_ID)
        forced_language = meta.get("language", "en")
    except Exception:
        pass

    persona = get_persona(persona_id)
    persona_name = persona["name"] if persona else "Sophia"
    logger.info(f"Using persona: {persona_name} ({persona_id}), language: {forced_language}")

    # STT - map language codes for Deepgram
    stt_lang = forced_language if forced_language != "te" else "en"
    stt = DeepgramSTT(
        api_key=os.environ["DEEPGRAM_API_KEY"],
        model="nova-3",
        language=stt_lang
    )

    # LLM - Gemini
    llm = google.LLM(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite"),
        api_key=os.environ["GOOGLE_API_KEY"]
    )

    # Voice Selection
    voice_id = get_voice_id(persona_id)

    tts = CartesiaTTS(
        api_key=os.environ["CARTESIA_API_KEY"],
        model="sonic-3",
        voice=voice_id,
        sample_rate=48000,
        volume=2.0,
    )

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=stt,
        llm=llm,
        tts=tts,
        mcp_servers=[
            mcp.MCPServerHTTP(
                url=os.getenv(
                    "MCP_SERVER_URL",
                    f"http://127.0.0.1:{os.getenv('PORT', '8000')}/mcp/sse",
                )
            )
        ],
        preemptive_generation=True,
    )

    @session.on("mcp_tool_call")
    def on_mcp_tool_call(tool_call):
        logger.info(f"[MCP TOOL] Calling tool: {tool_call.name} with args: {tool_call.arguments}")

    @session.on("mcp_tools_listed")
    def on_mcp_tools_listed(tools):
        logger.info(f"[MCP TOOLS] Listed {len(tools)} tools from server")

    # Use IST for filenames
    ist_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
    session_id = ist_now.strftime("%Y%m%d_%H%M%S")
    os.makedirs("sessions", exist_ok=True)
    base_name = f"sessions/session_{session_id}_{participant.identity}"
    transcript_file = f"{base_name}.txt"
    audio_file = f"{base_name}.wav"

    agent = MyAgent(forced_language, participant.identity, ctx.room.name, transcript_file, persona_name=persona_name)
    agent.voice_session = session

    conversation_log: list[dict] = []

    # Audio Capture (48kHz Mono)
    wav_out = wave.open(audio_file, "wb")
    wav_out.setnchannels(1)
    wav_out.setsampwidth(2)
    wav_out.setframerate(48000)

    audio_tasks = []
    write_lock = asyncio.Lock()
    total_frames_written = 0

    async def record_track(track: rtc.Track):
        nonlocal total_frames_written
        audio_stream = rtc.AudioStream(track, sample_rate=48000, num_channels=1)
        try:
            async for event in audio_stream:
                async with write_lock:
                    wav_out.writeframes(event.frame.data.tobytes())
                    total_frames_written += 1
        except Exception as e:
            logger.error(f"Error recording track: {e}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.Participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            audio_tasks.append(asyncio.create_task(record_track(track)))

    for p in ctx.room.remote_participants.values():
        for pub in p.track_publications.values():
            if pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                audio_tasks.append(asyncio.create_task(record_track(pub.track)))

    async def record_local_audio():
        while not any(pub.track is not None and pub.track.kind == rtc.TrackKind.KIND_AUDIO
                      for pub in ctx.room.local_participant.track_publications.values()):
            await asyncio.sleep(0.1)
        for pub in ctx.room.local_participant.track_publications.values():
            if pub.track and pub.track.kind == rtc.TrackKind.KIND_AUDIO:
                audio_tasks.append(asyncio.create_task(record_track(pub.track)))
                break

    audio_tasks.append(asyncio.create_task(record_local_audio()))

    def log_turn(role: str, text: str):
        if not text:
            return
        label = "User" if role == "user" else "Agent"
        ist_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=5, minutes=30)))
        ts = ist_now.strftime("%H:%M:%S")
        line = f"[{ts}] {label}: {text}"
        conversation_log.append({"role": role, "text": text, "time": ts})
        logger.info(line.encode('ascii', 'replace').decode('ascii'))
        with open(transcript_file, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    agent.log_callback = log_turn

    def on_conversation_item_added(event: ConversationItemAddedEvent) -> None:
        item = event.item
        if not hasattr(item, "role"):
            return
        log_turn(str(item.role), item.text_content)

    session.on("conversation_item_added", on_conversation_item_added)

    try:
        await session.start(agent=agent, room=ctx.room)
        close_future = asyncio.Future()
        session.on("close", lambda _: close_future.set_result(None) if not close_future.done() else None)
        await close_future
    finally:
        for t in audio_tasks:
            t.cancel()
        if audio_tasks:
            await asyncio.gather(*audio_tasks, return_exceptions=True)
        wav_out.close()

        if os.path.exists(audio_file):
            size = os.path.getsize(audio_file)
            logger.info(f"RECORDING COMPLETE: {audio_file} ({size} bytes)")

        if conversation_log:
            logger.info(f"Transcript saved to: {transcript_file}")
            logger.info(f"Audio recorded to: {audio_file}")
        await ctx.room.disconnect()


if __name__ == "__main__":
    cli.run_app(server)
