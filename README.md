# Orbis hackathon starter

A minimal Next.js example for the public Reactor-hosted Visko Orbis Stable API.
It demonstrates server-side token minting, WebRTC video and audio, text-to-video,
optional image-to-video, live prompt steering, delivery resolution, pause,
resume, and a foldable Nano Banana-to-Orbis livestreaming example.

## Requirements

- Node.js 20.9 or newer
- A Reactor API key with access to Visko Orbis Stable (for live video)
- A Google Gemini API key (for image edit and Orbis prompt grounding)
- An OpenAI API key (for the agent scaffold: room dialogue, compile, idle)

## Run locally

```bash
cp .env.example .env.local
# Fill in the keys below — see "Environment variables".
npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

Create `.env.local` in the project root (it is gitignored). Copy from
`.env.example` and fill in your values:

```dotenv
# Reactor / Orbis — live world streaming (POST /api/token, Room video)
REACTOR_API_KEY=your_reactor_api_key

# Google Gemini — image edit + Orbis prompt grounding
# Routes: /api/nano-banana, /api/orbis-prompt
GEMINI_API_KEY=your_gemini_api_key

# OpenAI — agent scaffold (dialogue, compiler, idle director)
# Routes: /api/turn, /api/agent/health
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4.1-mini
```

| Variable | Required for | Where to get it |
|---|---|---|
| `REACTOR_API_KEY` | Orbis live video, Room streaming | Reactor dashboard / hackathon credentials |
| `GEMINI_API_KEY` | Nano Banana image edit, Orbis prompt grounding | [Google AI Studio](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | Agent routes (`/api/turn`, sub-agents) | [OpenAI API keys](https://platform.openai.com/api-keys) |
| `OPENAI_MODEL` | Which model agents use (optional) | Defaults to `gpt-4.1-mini` if unset |

**Minimum by feature:**

- **Agent work only** — `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`)
- **Room with live video** — `REACTOR_API_KEY` + `OPENAI_API_KEY`
- **Full stack** (video + Gemini tools + agents) — all four variables

Keep all keys server-side. The browser receives only a short-lived Reactor JWT
and API responses — never the raw keys.

**Verify agent setup** (after `npm run dev`):

```bash
curl http://localhost:3000/api/agent/health
```

You should see `"ok": true` when `OPENAI_API_KEY` is set. See
[`lib/agents/README.md`](lib/agents/README.md) for agent development details.

## Nano Banana kickoff example

Connect to Orbis, expand **Livestreaming example**, and click
**Edit and start stream**. The bundled `dog.png` is displayed as the source
image. The server sends it with the displayed image-editing prompt to
`gemini-2.5-flash-image`. Gemini then analyzes the edited image with the user
prompt and returns a plain-text, image-grounded prompt. The
edited output is previewed, uploaded as the Orbis start image, and used with
that grounded prompt to begin the stream.

The two starting prompts are exported from `lib/nano-banana.ts`.
`NANO_BANANA_PROMPT` controls the image edit, while `ORBIS_KICKOFF_PROMPT`
describes the requested motion. The final Gemini-grounded prompt is displayed
before it is sent to Orbis.

## API flow

1. `POST /api/token` requests a scoped session JWT from
   `https://api.reactor.inc/tokens`.
2. `ReactorProvider` connects to `reactor/visko-orbis-stable` with the
   recv-only `main_video` and `main_audio` tracks.
3. The model sends a `state` snapshot. Its `state.available_resolutions` list
   replaces the starter's initial documented resolution choices.
4. If supplied, the reference image is uploaded and passed to `set_image`
   before `start`.
5. If selected, `set_resolution` stages a delivery tier for the next `start`.
   Omitting it keeps the model's current setting; the documented default is
   `2k`.
6. `set_prompt` supplies the required prompt, then `start` begins generation.
7. Sending another `set_prompt` while running steers the video at the next
   chunk boundary.

## Documented model behavior

- A prompt is required before `start`; the reference image is optional.
- A 16:9 reference image works best. Other aspect ratios are resized without
  cropping and may appear distorted.
- The starter initially shows the currently documented `1080p`, `2k`, and `4k`
  tiers. After connection, treat `state.available_resolutions` as authoritative
  and send the selected value exactly as given.
- `set_resolution` applies from the next `start`, not during the active run.
- Orbis emits chunks about every 1.8 seconds. The first chunk emits no frames
  while the upscaler primes; this is expected.
- Commands are asynchronous. Use model events such as `state`,
  `prompt_accepted`, `resolution_accepted`, `generation_started`,
  `chunk_complete`, and `command_error` as the source of truth.
- `pause` takes effect after the current chunk. `resume` continues the same
  generation, and `reset` clears the current prompt and image.

## Project files

- `app/api/token/route.ts` performs the server-side token exchange.
- `app/api/nano-banana/route.ts` performs the server-side image edit.
- `app/api/orbis-prompt/route.ts` creates the image-grounded video prompt.
- `components/orbis-demo.tsx` composes the provider, player, controls, and demo.
- `components/orbis-player.tsx` renders the streamed video and audio.
- `components/orbis-controls.tsx` renders the session controls.
- `components/nano-banana-example.tsx` owns the kickoff example and source image.
- `hooks/use-orbis-session.ts` contains the reusable Orbis command sequence and
  session state.
- `dog.png` is the Nano Banana source image.
- `lib/orbis.ts` contains the public model configuration and message helpers.
- `lib/orbis-prompt.ts` contains the plain-text Gemini grounding instruction.
- `lib/nano-banana.ts` contains the model and kickoff prompt.
- `.env.example` documents the required environment variables.
- `lib/agents/` contains the OpenAI Agents SDK scaffold (orchestrator + sub-agents).
- `app/api/turn/route.ts` and `app/api/agent/health/route.ts` are the agent API entry points.

For the complete command parameters, message schemas, tracks, and current model
behavior, use the public Reactor documentation:

- [Visko Orbis Stable API](https://www.reactor.inc/models/visko-orbis-stable/api)
- [Visko Orbis Dynamic API](https://www.reactor.inc/models/visko-orbis-dynamic/api)
- [Gemini image generation and editing](https://ai.google.dev/gemini-api/docs/image-generation)
