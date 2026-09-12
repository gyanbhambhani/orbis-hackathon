# Revenant — Voice-Driven Persona Worlds

A spec for Cursor. Build a system where a user speaks to a generated person who
answers in their voice and appears in a live, continuously running world.

Personas are compiled from user-supplied images and text. Input is speech.
Output is speech plus a persistent video world that reacts in real time.

---

## 0. Stack

| Layer | Choice | Notes |
|---|---|---|
| App | Next.js 14 App Router, TypeScript | |
| World model | Visko Orbis via Reactor | `@reactor-team/js-sdk`, docs at docs.reactor.inc |
| Identity lock | Visko Morphe | conditions the subject on reference images |
| Scene injection | Visko Kinesis | props, lighting, entrances mid-stream |
| STT | streaming, partial hypotheses required | Deepgram or Whisper streaming |
| TTS | streaming, sub-200ms first audio | ElevenLabs or equivalent |
| Agent | Claude Sonnet, structured JSON output | one call per turn |
| State | in-memory per session, Redis if time allows | |

Do not use `localStorage` or `sessionStorage` anywhere in artifact-rendered code.

---

## 1. Non-negotiable constraints

Implement these as code, not as copy. A judge will ask about every one.

1. **Consent gate.** No persona is compiled without an attestation step. The user
   selects a basis: `self`, `deceased_family_member`, `fictional`, or
   `licensed`. Store `attested_by`, `attested_at`, and the basis on the persona
   record. Block compilation without it.
2. **Public figure block.** Run uploaded names and reference images through a
   public-figure check at compile time. Reject with an explanation. Postmortem
   right of publicity is live in California for 70 years under Civ. Code
   3344.1, and impersonation of living public figures is the fastest way to
   make this unsellable.
3. **Persistent disclosure.** A visible, non-dismissable marker on the video
   surface for the entire session. Every exported clip carries C2PA provenance
   metadata and a visible watermark.
4. **No claims of contact.** The persona never asserts it is actually the
   person, never claims knowledge of an afterlife, never says it has been
   watching over the user. Enforce in the system prompt and in a post-generation
   filter.
5. **Session ceiling and off-ramp.** Hard cap at 20 minutes. At the cap, the
   scene closes gracefully rather than cutting. Track cumulative weekly minutes
   per user and surface a gentle check-in past a threshold.
6. **Distress handling.** If the dialogue agent classifies user affect as
   acute distress, it must break persona, end the scene softly, and surface
   human support resources. This path is tested before demo.

---

## 2. Architecture

```
  voice in
     │
     ▼
┌──────────┐   partials     ┌──────────────────┐
│   STT    │───────────────▶│   Turn Router    │
└──────────┘                └────────┬─────────┘
                                     │ { utterance, persona, scene, history }
                                     ▼
                            ┌──────────────────┐
                            │  Dialogue Agent  │  single structured call
                            └────────┬─────────┘
                    ┌────────────────┴────────────────┐
        affect + video_prompt (first)        reply_text (streamed)
                    │                                 │
                    ▼                                 ▼
            ┌───────────────┐                  ┌──────────┐
            │ Reactor/Orbis │                  │   TTS    │
            │  steer(delta) │                  └────┬─────┘
            └───────┬───────┘                       │
                    ▼                               ▼
              live video ◀────── synced ──────▶ voice out
```

Two background loops run alongside:

- **Idle Director.** Every 8s of user silence, emits an ambient `video_prompt`
  with no dialogue. This is what makes the world feel alive.
- **Continuity Guard.** Rejects any `scene_delta` that would violate a
  `continuity_lock`. Orbis holds persistent memory; do not churn it.

---

## 3. Latency budget

Perceived response target is **under 800ms**. Allocate:

| Stage | Budget |
|---|---|
| STT final hypothesis | 250ms |
| Agent first token | 300ms |
| `video_prompt` parsed and dispatched | 200ms after first token |
| Reactor steer acknowledged | 50ms |
| TTS first audio | 150ms |

Rules:

- Stream the agent response. Parse `video_prompt` the moment its closing quote
  arrives and dispatch immediately. Do not wait for the full object.
- Support barge-in. VAD detects user speech during TTS playback, cancels the
  audio, cancels the in-flight agent call, and starts a new turn. The world
  keeps running throughout. Never tear down the Reactor session.
- On agent timeout past 1.2s, emit a persona-appropriate filler from
  `voice.thinking_sounds` and keep the world moving.

---

## 4. Schemas

### 4.1 PersonaCard

Compiled once from uploads. Read-only at runtime.

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

  // The single most important field for believability.
  temporal_anchor: {
    knowledge_cutoff: string;          // "2019-04"
    apparent_age: number;
    era_markers: string[];             // "landline", "film photographs"
  };

  appearance: {
    reference_images: string[];        // conditions Morphe
    descriptors: string;               // prose, fed to Orbis seed
    wardrobe: string;
  };

  voice: {
    tts_voice_id: string;
    pace_wpm: number;
    accent: string;
    verbal_tics: string[];             // "mm", "oh honey"
    thinking_sounds: string[];         // latency filler
  };

  speech: {
    avg_sentence_words: number;
    register: 'plain' | 'formal' | 'technical' | 'ornate';
    catchphrases: string[];
    humor: string;
    question_return_rate: number;      // 0-1, how often they ask back
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
    unknown_response: string;          // "I wouldn't know about that, sweetheart."
  };
};
```

`temporal_anchor` and `boundaries.unknown_response` do the heaviest lifting.
A persona anchored to 2019 who is asked about a 2026 event must deflect in
character rather than invent. This single behavior is what separates a
convincing persona from an obvious language model.

### 4.2 SceneState

Mirrors what Orbis currently holds. Updated by applied deltas.

```ts
type SceneState = {
  reactor_session_id: string;
  location: string;                    // "1970s kitchen, late afternoon light"
  subject_pose: string;                // "seated, hands around a mug"
  props: string[];
  lighting: string;
  continuity_locks: string[];          // never allowed to change mid-session
  elapsed_world_seconds: number;
};
```

### 4.3 TurnOutput

**Key order is load-bearing.** The agent must emit these fields in exactly this
sequence so `video_prompt` streams out before `reply_text` is composed.

```ts
type TurnOutput = {
  affect: string;                      // 1. cheapest, arrives first
  video_prompt: string;                // 2. dispatched immediately
  scene_delta: Partial<SceneState>;    // 3.
  reply_text: string;                  // 4. streamed to TTS
  user_distress: boolean;              // 5. triggers off-ramp
};
```

`video_prompt` is a **delta, never a scene description**. Orbis is already
running and holds the world in memory.

- Correct: `she sets the mug down and leans forward, eyes softening`
- Wrong: `an elderly woman in a 1970s kitchen with afternoon light, sitting at
  a table with a mug, leaning forward`

The second form resets context Orbis already has and causes visible drift.

---

## 5. Dialogue Agent prompt

Store at `/prompts/dialogue.md`. Interpolate the persona card, scene state, and
last 12 turns.

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
- video_prompt is a physical delta describing motion, expression, and gaze
  only. Under 20 words. Never restate the setting.
- Never alter anything listed in scene.continuity_locks.
- Set user_distress true if the user expresses acute crisis.

Return only JSON with keys in this exact order:
affect, video_prompt, scene_delta, reply_text, user_distress
```

---

## 6. Persona Compiler

Batch job. Runs once per persona, takes 30 to 60 seconds, shows progress.

Input: 3 to 10 images, plus free text (letters, messages, the user's own
description, transcribed voice memos).

Pipeline:

1. Caption each image with a vision call. Extract apparent age, wardrobe,
   setting, posture, era signals.
2. Extract speech features from supplied text: sentence length distribution,
   vocabulary register, recurring phrases, humor style.
3. Infer `temporal_anchor` from image era markers and any dates in the text.
   Ask the user to confirm the knowledge cutoff explicitly. Do not guess
   silently.
4. Emit a `PersonaCard`. Show it to the user as an editable form before saving.
   The user is the authority on this person, not the model.
5. Seed the Reactor session with `appearance.descriptors` plus
   `default_scene`, and register reference images with Morphe for identity lock.

Step 4 is a product feature, not a nicety. Letting someone correct a wrong
detail about a person they loved is the difference between the app feeling
careless and feeling careful.

---

## 7. Reactor integration

```ts
import { Reactor } from '@reactor-team/js-sdk';

const reactor = new Reactor({ modelName: 'orbis' });
const session = await reactor.createSession({ seed: buildSeed(persona) });

// Steer without restarting. This is the whole point of a Live Model.
await session.steer({ prompt: videoPrompt });
```

Requirements:

- One long-lived session per conversation. Never recreate on a turn.
- Attach the video element to the stream on mount and render frames on arrival.
- Reconnection must preserve world state. Dropping the thread of time is a
  visible failure.
- Log `elapsed_world_seconds` and surface it in a dev overlay. You will want
  this number for the pitch.

---

## 8. File layout

```
/app
  /page.tsx                    persona picker
  /create/page.tsx             upload, attest, compile, review card
  /session/[id]/page.tsx       live conversation surface
  /api
    /persona/compile/route.ts
    /session/create/route.ts
    /turn/route.ts             streaming SSE
/lib
  /agents
    dialogue.ts                single structured call, streamed parse
    compiler.ts
    idle-director.ts
  /reactor
    client.ts
    session-manager.ts
  /voice
    stt.ts                     streaming, partials, VAD
    tts.ts                     streaming, cancellable
  /guards
    continuity.ts              rejects locked-field deltas
    consent.ts                 attestation + public figure check
    distress.ts                off-ramp
  /schemas
    persona.ts  scene.ts  turn.ts
/prompts
  dialogue.md  compiler.md
```

---

## 9. Build order

Timeboxed. Do not proceed until each gate passes.

| Phase | Build | Gate |
|---|---|---|
| 1 (2h) | Reactor session, video on screen, manual steer box | Typing a delta visibly changes the world without a reset |
| 2 (2h) | Dialogue agent, hardcoded persona card, text input | Structured output parses, `video_prompt` fires before `reply_text` completes |
| 3 (2h) | STT and TTS, full voice loop | End to end under 1s, barge-in cancels cleanly |
| 4 (2h) | Persona compiler with real uploads | A stranger uploads photos and gets a usable card |
| 5 (1h) | Idle Director and Continuity Guard | 60s of silence looks alive, not frozen |
| 6 (1h) | Consent gate, disclosure, distress path | Each is demonstrable on stage |
| 7 (1h) | Demo rehearsal | Runs three times without a crash |

Phase 5 is the one teams skip and the one that wins. A world that idles
convincingly is the only proof that you built on a Live Model rather than a
video generator.

---

## 10. Demo script

90 seconds, rehearsed.

1. Upload four photos and a paragraph. Compile live. Show the persona card
   and correct one field on stage.
2. Speak a question. She answers in voice while the world visibly reacts.
3. Stop talking for ten seconds. Let the room watch her exist.
4. Interrupt her mid-sentence. Show the barge-in and the unbroken world.
5. Ask about something after her knowledge cutoff. She deflects in character.
6. Show the dev overlay: elapsed world seconds, single session, zero resets.

Step 6 is the sales slide. One session, held continuously, no drift. That is
the specific claim Orbis makes and no competitor on Reactor's catalog matches.
