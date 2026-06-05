# founder-ai

Personal AI voice assistant for **Chandra Sekhar Karri**, live at `founder.four2labs.com`.

Visitors talk to an AI (voice or text) that answers questions about Chandra's research,
projects, skills and experience, and books a meeting with him via Google Calendar.

Built on LiveKit (WebRTC voice), Deepgram (STT), Google Gemini (LLM), and Cartesia (TTS).
No vector DB needed: the profile lives directly in the model's context (`about.py`).

## Run (Docker, on the shared four2labs VM)
```bash
cd deploy
docker compose -f docker-compose.app.yml up -d --build
```
Reuses the host's existing Caddy (TLS) and LiveKit server; the agent is dispatched by the
name `founder` so it only handles this app's rooms.
