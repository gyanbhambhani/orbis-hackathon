# Agent scaffold

Minimal OpenAI Agents SDK structure for the Revenant room. Teammates implement
sub-agent logic and prompts; this folder wires them together.

## Layout

| File | Owner | Spec reference |
|---|---|---|
| `dialogue.ts` | Dialogue teammate | AGENTS.md section 13 |
| `compiler.ts` | Compiler teammate | AGENTS.md section 6.5 |
| `idle-director.ts` | Idle teammate | AGENTS.md section 9 |
| `orchestrator.ts` | Shared — coordinate tool names | — |
| `run.ts` | Shared — API entry helper | — |

Prompts live in `/prompts/*.md`. Shared request/response types live in
`/lib/schemas/turn.ts`.

## How to implement a sub-agent

1. Edit `prompts/<agent>.md` with real instructions from AGENTS.md.
2. Update `lib/agents/<agent>.ts` if you need extra Agent options
   (`tools`, guardrails, etc.).
3. Keep `outputType` aligned with the Zod schema in `lib/schemas/turn.ts`.
4. If the agent needs more inputs, extend the `parameters` Zod object for that
   tool in `orchestrator.ts` and update `run.ts` or the API route that calls it.

## Orchestrator tools (do not rename without coordinating)

| Tool name | Sub-agent | Purpose |
|---|---|---|
| `run_dialogue_turn` | DialogueAgent | Room chat turns |
| `compile_persona` | CompilerAgent | Persona card compilation |
| `generate_idle_motion` | IdleDirectorAgent | Ambient Orbis motion |

The main agent uses `agent.asTool()` so the orchestrator delegates without a
full handoff. See
[OpenAI Agents SDK — Agents as tools](https://openai.github.io/openai-agents-js/guides/tools/).

## Environment

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
```

Copy from `.env.example` into `.env.local`. The SDK reads `OPENAI_API_KEY`
automatically.

## Testing locally

Health check (no LLM call):

```bash
curl http://localhost:3000/api/agent/health
```

Dialogue turn (calls orchestrator + dialogue tool):

```bash
curl -X POST http://localhost:3000/api/turn \
  -H "Content-Type: application/json" \
  -d '{
    "utterance": "Hello, how are you?",
    "seatedIds": ["helen-ward"]
  }'
```

## Next steps (not in this scaffold)

- Guard pipeline: `distress`, `contact-claim`, `continuity` in `/lib/guards/`
- Frontend: wire `hooks/use-room.ts` to `POST /api/turn`
- `POST /api/persona/compile` route for the compiler tool
- Evals: `/evals/dialogue.json` per AGENTS.md section 12
