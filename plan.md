# Orbis Personality-Driven Streaming MVP

## Goal

Build an MVP that accepts an initial user prompt, applies a selected or updated
personality, generates an Orbis-ready video instruction, and streams the
resulting Reactor-hosted Visko Orbis video to the existing frontend.

## Architecture

```text
Frontend
  -> Main Agent (OpenAI Agents SDK)
       -> Personality Agent subagent (OpenAI Agents SDK + JSON-file tools)
       -> Orbis Reactor tool (deterministic Python function)
            -> Reactor / Visko Orbis
                 -> Python frame relay -> frontend player
```

### Main Agent

The Main Agent is the only AI-facing entry point for the frontend. It accepts
the user's initial prompt and controls the workflow.

Responsibilities:

- Validate the user prompt and requested action (`start` or `steer`).
- Ask the Personality Agent to read, create, or update a personality.
- Call the Orbis Reactor tool with the user prompt and resolved personality.
- Return the active stream ID and relay URL to the frontend.
- Record an MVP run log: user input, personality ID, final Orbis prompt,
  action, and timestamp.

The Main Agent follows the manager pattern: it retains control of the
conversation and invokes specialized capabilities as tools rather than
handing control to another agent.

### Personality Agent

The Personality Agent is built with the OpenAI Agents SDK and has tightly
scoped tools for personality management only. It must not generate Orbis
prompts or contact Reactor.

Capabilities:

- List personalities.
- Read a personality by ID.
- Create a personality.
- Update a personality.
- Optionally delete a personality.

Its output must be validated structured `Personality` data.

```ts
type Personality = {
  id: string;
  name: string;
  description: string;
  visualStyle: string;
  tone: string;
  motionStyle: string;
  negativeConstraints: string[];
  updatedAt: string;
};
```

### Orbis Reactor Tool

## Reactor / Orbis Tool Plan

This team owns the Reactor / Orbis tool. The Main Agent calls it with a
completed, personality-conditioned video prompt. The tool owns a persistent
server-side Reactor connection, calls the Orbis API, and relays the received
frames to the frontend. It is a function tool, not an OpenAI agent.

### Boundary

The function accepts a video prompt and starts a server-owned stream:

```python
async def start_orbis_stream(prompt: str) -> ToolResult:
    # connect using REACTOR_API_KEY / ORBIS_API_KEY
    # send set_prompt, then start
    # return a stable stream_id
    ...
```

For follow-up prompts, the Main Agent calls the same tool with `stream_id` and
the new prompt. The tool calls `set_prompt` on the existing Reactor session;
it does not reconnect or call `start` again. Orbis applies the new prompt at
the next chunk boundary.

### Tool implementation

Implement the following Python function tools and register them on the Main
Agent:

- `start_orbis_stream(prompt)` — connects, sets the initial prompt, and
  starts generation.
- `steer_orbis_stream(stream_id, prompt)` — sends `set_prompt` to the active
  session.
- `stop_orbis_stream(stream_id)` — closes the session and releases resources.

The tool receives the stream, resolution, and command events from Reactor; it
must retain the `Reactor` object in a process-local stream manager. The React
frontend connects to a service WebSocket to receive relayed frames. The first
MVP relay can send JPEG frames; replace it with a WebRTC relay before
production. [Reactor Orbis API reference](https://www.reactor.inc/models/visko-orbis-stable/api)

### Execution flow

```text
Main Agent
  -> PersonalityAgent.run(user request)
  -> receives validated Personality
  -> start_orbis_stream(prompt) [Python tool]
  -> Reactor: set_prompt, start
  -> service WebSocket relays received frames to frontend
```

For a follow-up prompt:

```text
Main Agent -> steer_orbis_stream(stream_id, prompt)
            -> Reactor set_prompt
            -> same video relay remains connected
```

### Files owned by this tool

```text
orbis_service/app/main.py               # FastAPI start, steer, stop, and frame endpoints
orbis_service/app/orbis_tool.py         # OpenAI Agents SDK function tools
orbis_service/app/stream_manager.py     # persistent Reactor sessions and frame relay
orbis_service/app/models.py             # Pydantic request and response schemas
```

### Guardrails and errors

- Validate all user-derived prompt text for a non-empty, bounded length.
- Never expose the Reactor API key to the browser.
- Keep a bounded frame queue so slow clients do not add latency.
- Surface Reactor connection and command failures as structured API errors.
- Stop and remove a stream when the user ends it or the service shuts down.
- Do not log credentials.

### Build order

1. Implement the server-owned Reactor stream manager and FastAPI endpoints.
2. Register start and steer operations as OpenAI Agents SDK function tools.
3. Test input validation, missing-key errors, stream start, steering, and
   shutdown.
4. Connect the frontend to the frame WebSocket.
5. Replace JPEG-frame relay with WebRTC before production.

## Persistence

For the MVP, do not use a database. Store personalities server-side in:

```text
data/personalities.json
```

The browser never reads or writes this file directly. API routes and the
Personality Agent use a small store module that validates records and performs
safe file updates.

JSON storage is suitable for local development and a single-instance hackathon
demo. A database is required before deployment to serverless infrastructure or
support for concurrent writers.

## API Contracts

### Agent orchestration

`POST /api/agent/run`

```ts
{
  prompt: string;
  personalityId?: string;
  personalityUpdate?: Partial<Personality>;
  action: "start" | "steer";
  resolution?: string;
}
```

Response:

```ts
{
  personality: Personality;
  orbisPrompt: string;
  action: "start" | "steer";
}
```

### Personality routes

- `GET /api/personalities` — list personalities.
- `POST /api/personalities` — create a personality.
- `GET /api/personalities/:id` — read a personality.
- `PATCH /api/personalities/:id` — update a personality.
- `DELETE /api/personalities/:id` — delete a personality.

## Orbis Integration

The current starter already provides the core streaming path:

- `app/api/token/route.ts` mints a short-lived, scoped Reactor JWT.
- `components/orbis-demo.tsx` configures `ReactorProvider`.
- `hooks/use-orbis-session.ts` sends Orbis commands.
- `components/orbis-player.tsx` renders the incoming video and audio.

Update `useOrbisSession` so both starting and steering generation first call
`/api/agent/run`.

- For `start`, use `orbisPrompt` with the existing `set_prompt` and `start`
  sequence.
- For `steer`, use `orbisPrompt` with `set_prompt` only. Orbis applies the
  change at a chunk boundary.

Reactor credentials remain server-side. The browser receives only the
short-lived Reactor JWT needed for its WebRTC session.

## UI

Build the MVP UI around the existing Orbis player:

- Prompt textarea.
- Personality selector.
- Personality management drawer or form.
- Start stream button.
- Live steering input for in-stream changes.
- Stream lifecycle status: connecting, prompt accepted, generating, paused,
  and error.
- Optional disclosure showing the final prompt sent to Orbis for debugging.

## Proposed Files

```text
data/personalities.json
lib/personality-store.ts
lib/agents/main-agent.ts
lib/agents/personality-agent.ts
lib/agents/live-model-agent.ts
app/api/agent/run/route.ts
app/api/personalities/route.ts
app/api/personalities/[id]/route.ts
components/personality-selector.tsx
components/personality-editor.tsx
```

## Delivery Sequence

1. Add the `Personality` type, a seeded JSON file, and validated file-store
   functions.
2. Implement the personality API routes.
3. Add the OpenAI Agents SDK and implement the Personality Agent with only
   personality store tools.
4. Implement the Main Agent to orchestrate the Personality Agent and Orbis
   Reactor tool.
5. Implement the Orbis Reactor tool's command-plan rules and schema.
6. Add `POST /api/agent/run` with input/output validation and run logging.
7. Wire the resulting prompt into `useOrbisSession` for start and live
   steering.
8. Build the selector, editor, and stream-state UI.
9. Verify end-to-end with a valid Reactor key: connect, start, pause/resume,
   steer, update a personality, and reconnect.

## MVP Acceptance Criteria

- A user can select an existing personality or create/update one.
- The Main Agent retrieves the relevant structured personality through the
  Personality Agent.
- The Orbis Reactor tool generates a personality-conditioned Orbis command
  plan and prompt.
- A new stream starts successfully in the existing player.
- A user can steer a running stream without restarting it.
- No OpenAI or Reactor long-lived API secret is exposed to the browser.
