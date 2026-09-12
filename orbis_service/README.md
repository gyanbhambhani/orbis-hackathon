# Orbis Python service

This service owns the server-side Reactor connection. The Main Agent calls its
function tools to start or steer a stream; the service relays received Orbis
frames to the frontend over a WebSocket.

## Setup

```bash
cd orbis_service
python -m venv .venv
source .venv/bin/activate
pip install -e .
export REACTOR_API_KEY=... # ORBIS_API_KEY is also accepted
uvicorn app.main:app --reload --port 8000
```

`OPENAI_API_KEY` is only required when this tool is registered on and called
by an OpenAI Agents SDK Main Agent. Direct HTTP endpoint testing requires only
`REACTOR_API_KEY`.

## Test a stream

Start a stream:

```bash
curl -X POST http://localhost:8000/v1/orbis/streams \
  -H 'content-type: application/json' \
  -d '{"prompt":"A red fox running through a snowy forest. Cinematic continuous tracking shot, no cuts."}'
```

The response contains `stream_id` and a `ws_url`. Connect a browser WebSocket
to that URL. It receives JSON messages with JPEG images encoded as base64:

```json
{"type":"frame","mime_type":"image/jpeg","data":"..."}
```

Steer the existing stream without restarting it:

```bash
curl -X POST http://localhost:8000/v1/orbis/streams/STREAM_ID/prompts \
  -H 'content-type: application/json' \
  -d '{"prompt":"Keep the same fox and tracking shot, but transition into a glowing moonlit forest."}'
```

Stop it:

```bash
curl -X DELETE http://localhost:8000/v1/orbis/streams/STREAM_ID
```

The relay is intentionally an MVP transport. It sends JPEG frames, not a
browser-native video track. Replace it with a WebRTC relay before production.
