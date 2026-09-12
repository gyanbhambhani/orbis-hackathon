import { z } from "zod";

export const TurnLineSchema = z.object({
  speaker_id: z.string(),
  reply_text: z.string(),
  affect: z.string(),
});

export const MemoryProposalSchema = z.object({
  persona_id: z.string(),
  fact: z.string(),
  ask_user: z.boolean(),
});

export const TurnOutputSchema = z.object({
  lines: z.array(TurnLineSchema).min(1).max(2),
  addressee_used: z.union([z.string(), z.literal("room")]),
  video_prompt: z.string(),
  scene_delta: z.record(z.string(), z.unknown()).optional(),
  user_distress: z.boolean(),
  notice: z.string().optional(),
  memory_proposal: MemoryProposalSchema.nullable().optional(),
});

export type TurnLine = z.infer<typeof TurnLineSchema>;
export type TurnOutput = z.infer<typeof TurnOutputSchema>;

export const CompilerOutputSchema = z.object({
  display_name: z.string(),
  relationship_to_user: z.string(),
  knowledge_cutoff: z.string(),
  draft_summary: z.string(),
  ready_for_review: z.boolean(),
});

export type CompilerOutput = z.infer<typeof CompilerOutputSchema>;

export const IdleDirectorOutputSchema = z.object({
  video_prompt: z.string(),
});

export type IdleDirectorOutput = z.infer<typeof IdleDirectorOutputSchema>;

export type TurnRequest = {
  utterance: string;
  seatedIds: string[];
  addressee?: string | "room";
  messages?: Array<{
    role: "user" | "persona";
    personaId?: string;
    name: string;
    text: string;
  }>;
  scene?: Record<string, unknown>;
  roomWorkingMemory?: string[];
};

export function parseTurnRequest(body: unknown): TurnRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const utterance = record.utterance;

  if (typeof utterance !== "string" || utterance.trim().length === 0) {
    throw new Error("utterance is required.");
  }

  if (!Array.isArray(record.seatedIds)) {
    throw new Error("seatedIds must be an array.");
  }

  const seatedIds = record.seatedIds.filter(
    (id): id is string => typeof id === "string",
  );

  return {
    utterance: utterance.trim(),
    seatedIds,
    addressee:
      typeof record.addressee === "string" ? record.addressee : "room",
    messages: Array.isArray(record.messages)
      ? (record.messages as TurnRequest["messages"])
      : undefined,
    scene:
      record.scene && typeof record.scene === "object"
        ? (record.scene as Record<string, unknown>)
        : undefined,
    roomWorkingMemory: Array.isArray(record.roomWorkingMemory)
      ? record.roomWorkingMemory.filter(
          (item): item is string => typeof item === "string",
        )
      : undefined,
  };
}
