# Revenant — Personality Bank for Live Persona Worlds

A spec for Cursor. Build a Character.AI-shaped product that is more personal:
the user deposits photos and writing into a **Personality Bank**, Gemini
compiles a persona card, and the user then speaks with that person inside a
live Orbis world that keeps running.

This is not a public character marketplace. Each bank is private. Personas are
made from the user's own material: letters, messages, captions, voice-memo
transcripts, and photographs. The output is speech plus a persistent video
world, not a chat bubble with a static avatar.

---

## 0. Product

Character.AI: pick a fictional bot, type, get a reply.

Revenant: deposit *this person's* artifacts, review the compiled card, then
talk to them in a room that does not freeze when you stop talking.

The bank is the home screen.

- **Browse.** Saved personas as cards (photo, name, relationship, knowledge
  cutoff).
- **Create.** Text field plus image uploads. Attest, compile with Gemini,
  review, save.
- **Open.** One persona becomes a live Orbis session. Voice in, voice out,
  world stays up.

A persona is more personal than a C.AI character when three things are true:

1. The card was compiled from *their* photos and *their* words, then edited by
   the user who knew them.
2. `temporal_anchor.knowledge_cutoff` is explicit. They do not know 2026.
3. They inhabit a continuous world, not a new still every turn.

---

## 1. Stack

Use what this repo already has. Do not invent a second video stack.

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js App Router, TypeScript | existing starter |
| Personality compile | Gemini via `GEMINI_API_KEY` | vision + text; server-only |
| Dialogue agent | Gemini structured JSON | one call per turn; stream |
| World model | `reactor/visko-orbis-stable` | `@reactor-team/js-sdk` |
| Identity | one 16:9 `set_image` + prompt restatement | no Morphe in this hackathon |
| Steering | `set_prompt` mid-run | lands at next ~1.8s chunk |
| STT | streaming, partials | Deepgram or Whisper streaming |
| TTS | streaming, cancellable | ElevenLabs or equivalent; mute Orbis `main_audio` or keep it as ambience only |
| State | in-memory Personality Bank per process | no `localStorage` / `sessionStorage` |

Do not use `localStorage` or `sessionStorage` anywhere in artifact-rendered
code. Keep `REACTOR_API_KEY` and `GEMINI_API_KEY` on the server.

**Out of scope for this build:** Visko Morphe, Visko Kinesis, C2PA export
pipelines. Identity lock is “start from this photo and keep describing her in
every prompt.” Lip sync of Orbis mouths to TTS is not promised.

---

## 2. Non-negotiable constraints

Implement these as code, not as copy. A judge will ask about every one.

1. **Consent gate.** No persona is compiled without an attestation step. The
   user selects a basis: `self`, `deceased_family_member`, `fictional`, or
   `licensed`. Store `attested_by`, `attested_at`, and the basis on the persona
   record. Block compilation without it.
2. **Public figure block.** Run the display name and user-supplied description
   through a Gemini check at compile time. Reject with an explanation. Image
   celebrity-ID is best-effort, not a research project. Postmortem right of
   publicity is live in California for 70 years under Civ. Code 3344.1.
3. **Persistent disclosure.** A visible, non-dismissable marker on the video
   surface for the entire session (“Generated persona”). Visible watermark on
   any saved still.
4. **No claims of contact.** The persona never asserts it is actually the
   person, never claims knowledge of an afterlife, never says it has been
   watching over the user. Enforce in the system prompt and in a
   post-generation filter.
5. **Session ceiling and off-ramp.** Hard cap at 20 minutes. At the cap, the
   scene closes gracefully rather than cutting. Track cumulative weekly
   minutes per user and surface a gentle check-in past a threshold.
6. **Distress handling.** If the dialogue agent classifies user affect as
   acute distress, it must break persona, end the scene softly, and surface
   human support resources. This path is tested before demo.

---

## 3. Architecture

```
 Personality Bank
   text + images ──▶ attest ──▶ Gemini compiler ──▶ editable PersonaCard
                                                         │
                                                         ▼ save
                                              bank of PersonaCards
                                                         │
                                              user opens one
                                                         ▼
  voice in
     │
     ▼
┌──────────┐   partials     ┌──────────────────┐
│   STT    │───────────────▶│   Turn Router    │
└──────────┘                └────────┬─────────┘
                                     │ { utterance, persona, scene, history }
                                     ▼
                            ┌──────────────────┐
                            │  Gemini turn    │  structured JSON, streamed
                            └────────┬─────────┘
                    ┌────────────────┴────────────────┐
        affect + video_prompt (first)        reply_text (streamed)
                    │                                 │
                    ▼                                 ▼
            ┌───────────────┐                  ┌──────────┐
            │ Orbis        │                  │   TTS    │
            │ set_prompt    │                  └────┬─────┘
            └───────┬───────┘                       │
                    ▼                               ▼
              live video                    voice out (not lip-synced)
```

Two background loops run alongside:

- **Idle Director.** Every 8s of user silence, emits an ambient `video_prompt`
  with no dialogue. This is what makes the world feel alive.
- **Continuity Guard.** Every Orbis prompt restates identity, location, and
  `continuity_locks`. Reject any `scene_delta` that would drop a lock.

---

## 4. Latency budget

Perceived **voice** response target is **under 800ms**. The picture will lag.

| Stage | Budget |
|---|---|
| STT final hypothesis | 250ms |
| Agent first token | 300ms |
| `video_prompt` parsed and `set_prompt` sent | 200ms after first token |
| Orbis `prompt_accepted` | command ack, not a new frame |
| TTS first audio | 150ms |
| Visible morph | next ~1.8s chunk boundary |

Rules:

- Stream the Gemini turn. Parse `video_prompt` the moment its closing quote
  arrives and dispatch `set_prompt` immediately. Do not wait for the full object.
- Support barge-in. VAD detects user speech during TTS playback, cancels the
  audio, cancels the in-flight agent call, and starts a new turn. Never tear
  down the Reactor session.
- On agent timeout past 1.2s, emit a persona-appropriate filler from
  `voice.thinking_sounds` and keep the world moving.
- First Orbis frames can take minutes of pod warmup. Show a waiting state.
  Demo with a session that is already generating.

---

## 5. Personality Bank

The bank is an in-memory store of `PersonaCard`s for the process. Seed it with
one demo persona so the live path works before compile is done.

### 5.1 Create flow

`/bank` or `/create`.

1. **Attest.** Basis picker. Disabled compile until attested.
2. **Images.** 1 to 10 photos. Require at least one. User marks a **primary
   still** (16:9 crop if needed). That file is what Orbis `set_image` uses.
3. **Text.** One large field, optional extra blobs: letters, chat paste,
   “who they are to me,” transcribed voice memos. Empty text is allowed only
   if the user types a short relationship note (`grandmother`, `mentor`).
4. **Compile.** `POST /api/persona/compile` sends images + text to Gemini.
   Show progress (captioning → speech → card). Target 30–60s.
5. **Review.** Editable `PersonaCard` form. User confirms
   `temporal_anchor.knowledge_cutoff`. User is the authority, not Gemini.
6. **Save.** Card lands in the bank. Primary image stays available for
   `set_image` when a session opens.

### 5.2 Gemini compiler

Server-only. Use the existing Gemini path (`GEMINI_API_KEY`, `@google/genai`).
Vision model for images; the same or a flash model for the card merge.

Input:

```ts
type CompileRequest = {
  attested_by: string;
  consent_basis: PersonaCard['consent']['basis'];
  display_name_hint?: string;
  relationship_hint?: string;
  source_text: string;
  images: Array<{ name: string; mimeType: string; bytes: string }>;
  primary_image_index: number;
};
```

Pipeline:

1. Caption each image. Extract apparent age, wardrobe, setting, posture, era
   signals, and a short identity description.
2. Extract speech features from `source_text`: sentence length, register,
   recurring phrases, humor, verbal tics.
3. Infer a *proposed* `temporal_anchor` from dates and era markers. Never
   silently lock it. The review form requires an explicit cutoff.
4. Public-figure name check. If likely, return an error payload, do not
   save.
5. Emit a `PersonaCard`. Prompt lives at `/prompts/compiler.md`.

Reuse the Nano Banana / Orbis prompt idea only for the **kickoff still**:
Gemini may rewrite the primary photo into a 16:9 scene still if the upload is
a bad crop. The identity in that still must match the upload. Do not invent a
different face.

---

## 6. Schemas

### 6.1 PersonaCard

Compiled once from bank deposits. Editable at review. Read-only during a
session unless the user leaves and edits in the bank.

```ts
type PersonaCard = {
  id: string;
  display_name: string;
  relationship_to_user: string;        // "grandmother", "mentor"

  consent: {
    basis: 'self' | 'deceased_family_member' | 'fictional' | 'licensed';
    attested_by: string;
    attested_at: string;               // ISO 8601
  };

  temporal_anchor: {
    knowledge_cutoff: string;          // "2019-04"
    apparent_age: number;
    era_markers: string[];             // "landline", "film photographs"
  };

  appearance: {
    reference_images: string[];        // bank file ids; [0] is Orbis set_image
    descriptors: string;               // restated in every Orbis prompt
    wardrobe: string;
  };

  voice: {
    tts_voice_id: string;
    pace_wpm: number;
    accent: string;
    verbal_tics: string[];
    thinking_sounds: string[];
  };

  speech: {
    avg_sentence_words: number;
    register: 'plain' | 'formal' | 'technical' | 'ornate';
    catchphrases: string[];
    humor: string;
    question_return_rate: number;
  };

  affect: {
    baseline: string;
    range: string[];
    softens_on: string[];
    bristles_on: string[];
  };

  relationship_memory: Array<{
    fact: string;
    source: 'user_text' | 'image_caption';
    confidence: number;
  }>;

  default_scene: SceneState;

  boundaries: {
    will_not_discuss: string[];
    unknown_response: string;
  };
};
```

`temporal_anchor` and `boundaries.unknown_response` do the heaviest lifting.
A persona anchored to 2019 who is asked about a 2026 event must deflect in
character rather than invent.

### 6.2 SceneState

```ts
type SceneState = {
  reactor_session_id: string;
  location: string;
  subject_pose: string;
  props: string[];
  lighting: string;
  continuity_locks: string[];
  elapsed_world_seconds: number;
  session_chunk: number;             // from Orbis state / chunk_complete
};
```

### 6.3 TurnOutput

**Key order is load-bearing.** Gemini must emit these fields in exactly this
sequence so `video_prompt` streams out before `reply_text` is composed.

```ts
type TurnOutput = {
  affect: string;
  video_prompt: string;
  scene_delta: Partial<SceneState>;
  reply_text: string;
  user_distress: boolean;
};
```

### 6.4 Orbis prompt rule (this contradicts an earlier draft)

Orbis Stable morphs at the **next chunk**. Docs tell you to **re-establish
subject and setting in every `set_prompt`**. A motion-only delta causes
drift.

`video_prompt` is a **full steering prompt**, not a 12-word delta:

1. Same person (`appearance.descriptors`, wardrobe).
2. Same place (`location`, lighting, continuity_locks).
3. Then the new motion / expression / gaze.

- Correct: `The same woman, silver hair, floral housedress, 1970s kitchen in
  late afternoon. She sets the mug down and leans forward, eyes softening.
  Camera holding steady.`
- Wrong: `she sets the mug down and leans forward` (drops identity)
- Wrong: a brand-new cinematic establishing shot that reboots the world

Continuity Guard concatenates the lock phrases if the model omitted them.

---

## 7. Dialogue agent prompt

Store at `/prompts/dialogue.md`. Gemini. Interpolate the persona card, scene
state, and last 12 turns.

```
You are generating one turn of dialogue for a compiled persona.
You are not the persona. You are producing what the persona would say.

PERSONA CARD:
{{persona_json}}

CURRENT SCENE:
{{scene_json}}

RECENT TURNS:
{{history}}

USER JUST SAID:
{{utterance}}

Rules:
- Match speech.avg_sentence_words within 40%. Short is almost always right.
- Use verbal_tics sparingly. Roughly one per three turns.
- If the topic postdates temporal_anchor.knowledge_cutoff, deflect using
  boundaries.unknown_response phrasing. Never invent knowledge of it.
- Never claim to be actually present, actually alive, or actually watching
  over the user. Never reference an afterlife.
- Draw on relationship_memory only when relevant. Do not recite it.
- Ask a question back at roughly speech.question_return_rate frequency.
- video_prompt is a full Orbis steering prompt: restate identity, wardrobe,
  location, lighting, then the physical delta. Camera holding steady.
  Continuity_locks must appear verbatim.
- Set user_distress true if the user expresses acute crisis.

Return only JSON with keys in this exact order:
affect, video_prompt, scene_delta, reply_text, user_distress
```

---

## 8. Reactor / Orbis integration

Use the existing starter, not a fictional SDK.

```ts
// lib/orbis.ts already uses reactor/visko-orbis-stable
await sendCommand("set_image", { image: uploadedPrimaryStill });
await sendCommand("set_prompt", { prompt: kickoffPrompt });
await sendCommand("start", {});

// later, every turn + idle tick — never reset, never start again
await sendCommand("set_prompt", { prompt: videoPrompt });
```

Requirements:

- One long-lived session per conversation. Never `reset` or `start` again on
  a turn. Barge-in cancels TTS and the Gemini call only.
- Attach the video element on mount. Mute or duck Orbis `main_audio` so TTS
  is the voice.
- Reconnection must preserve world state if the API allows resume; dropping
  the thread of time is a visible failure.
- Log `elapsed_world_seconds` and `session_chunk` in a dev overlay. Pitch:
  one session, N chunks, zero resets.
- Kickoff prompt = `appearance.descriptors` + `default_scene`. Primary bank
  image = `set_image`.

---

## 9. File layout

```
/app
  /page.tsx                      Personality Bank (picker + create entry)
  /create/page.tsx               upload, attest, compile, review card
  /session/[id]/page.tsx        live conversation surface
  /api
    /persona/compile/route.ts   Gemini compiler
    /persona/route.ts            list / save cards in the bank
    /session/create/route.ts
    /turn/route.ts               streaming SSE (Gemini turn)
/lib
  /bank
    store.ts                     in-memory persona bank
  /agents
    dialogue.ts
    compiler.ts                  Gemini vision + merge
    idle-director.ts
  /reactor                       keep existing orbis.ts + hook
  /voice
    stt.ts
    tts.ts
  /guards
    continuity.ts
    consent.ts
    distress.ts
  /schemas
    persona.ts  scene.ts  turn.ts
/prompts
  dialogue.md  compiler.md
```

Keep `hooks/use-orbis-session.ts`, `components/orbis-player.tsx`, and the
token route. Extend them; do not replace the connect path.

---

## 10. Build order

Timeboxed. Do not proceed until each gate passes.

| Phase | Build | Gate |
|---|---|---|
| 1 | Orbis session already in starter | Typing a **full** steer prompt changes the world without reset |
| 2 | Personality Bank UI + one hardcoded card | Pick the card, open a session from it |
| 3 | Gemini turn agent, text input | Structured output parses; `set_prompt` fires before `reply_text` completes |
| 4 | Gemini compile from text + images | Upload photos and a paragraph, review card, save to bank |
| 5 | STT/TTS + barge-in | Voice in / voice out; world stays up |
| 6 | Idle Director + Continuity Guard | 60s of silence looks alive |
| 7 | Consent, disclosure, distress | Each is demonstrable on stage |
| 8 | Demo rehearsal | Runs three times without a crash |

Phase 6 is the one teams skip and the one that wins. A world that idles
convincingly is the only proof that you built on a Live Model rather than a
video generator.

---

## 11. Demo script

90 seconds, rehearsed.

1. Open the bank. Deposit four photos and a paragraph. Compile with Gemini.
   Show the card and correct one field (cutoff or a catchphrase).
2. Open the persona. Speak a question. They answer in TTS while Orbis morphs
   at the next chunk.
3. Stop talking for ten seconds. Let the room watch them exist.
4. Interrupt mid-sentence. Barge-in; world does not reset.
5. Ask about something after the knowledge cutoff. They deflect in character.
6. Dev overlay: elapsed world seconds, chunk count, single session, zero
   resets.

Step 6 is the sales slide. One session, held continuously. That is the
specific claim Orbis makes. The bank is why it is more personal than
Character.AI: the person came from the user's photos and words, not a public
bot listing.
