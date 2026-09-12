# Orbis Personality-Driven Streaming MVP

## Goal

Build an MVP that accepts an initial user prompt, applies a selected or updated
personality, generates an Orbis-ready video instruction, and streams the
resulting Reactor-hosted Visko Orbis video to the existing frontend.

## Architecture

```text
Frontend
  -> Main Agent (OpenAI Agents SDK)
       -> Personality Agent (OpenAI Agents SDK + JSON-file tools)
       -> Live Model Agent (server-side Orbis integration service)
            -> Reactor / Visko Orbis
                 -> Existing WebRTC player
```

### Main Agent

The Main Agent is the only AI-facing entry point for the frontend. It accepts
the user's initial prompt and controls the workflow.

Responsibilities:

- Validate the user prompt and requested action (`start` or `steer`).
- Ask the Personality Agent to read, create, or update a personality.
- Send the user prompt and resolved personality to the Live Model Agent.
- Return an Orbis stream specification to the frontend.
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

### Live Model Agent

The Live Model Agent is a server-side service responsible for turning the
user's intent and the selected personality into an Orbis-compatible prompt.
It does not require an LLM in the first MVP iteration.

Input:

```ts
{
  userPrompt: string;
  personality: Personality;
  action: "start" | "steer";
}
```

Output:

```ts
{
  orbisPrompt: string;
  action: "start" | "steer";
}
```

The initial implementation should use a deterministic, inspectable template:

```text
Create a continuous live video of: {userPrompt}.
Personality: {description}.
Visual style: {visualStyle}.
Motion: {motionStyle}.
Tone: {tone}.
Avoid: {negativeConstraints}.
No captions, UI, logos, or watermarks unless explicitly requested.
```

It can later become a third OpenAI Agents SDK agent without changing its input
or output contract.

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
4. Implement the Main Agent to orchestrate user prompt, Personality Agent,
   and Live Model Agent.
5. Implement the deterministic Live Model Agent prompt template.
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
- The Live Model Agent generates a personality-conditioned Orbis prompt.
- A new stream starts successfully in the existing player.
- A user can steer a running stream without restarting it.
- No OpenAI or Reactor long-lived API secret is exposed to the browser.
