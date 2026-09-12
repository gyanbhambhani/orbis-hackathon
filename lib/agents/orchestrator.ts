import { Agent } from "@openai/agents";
import { z } from "zod";

import { compilerAgent } from "@/lib/agents/compiler";
import { dialogueAgent } from "@/lib/agents/dialogue";
import { idleDirectorAgent } from "@/lib/agents/idle-director";
import { getAgentModel } from "@/lib/agents/model";

export const dialogueTool = dialogueAgent.asTool({
  toolName: "run_dialogue_turn",
  toolDescription:
    "Generate in-character room dialogue for a user utterance or room event.",
  parameters: z.object({
    utterance: z.string(),
    context_json: z.string(),
  }),
  inputBuilder: ({ params }) =>
    `Generate a dialogue turn.\n\nUtterance: ${params.utterance}\n\nContext:\n${params.context_json}`,
  customOutputExtractor: (result) =>
    JSON.stringify(result.finalOutput ?? {}),
});

export const compilerTool = compilerAgent.asTool({
  toolName: "compile_persona",
  toolDescription:
    "Compile uploaded photos and text into a PersonaCard draft summary.",
  parameters: z.object({
    consent_basis: z.string(),
    source_text: z.string(),
    relationship_hint: z.string(),
  }),
  inputBuilder: ({ params }) =>
    `Compile a persona draft.\n\nBasis: ${params.consent_basis}\nRelationship: ${params.relationship_hint}\n\nSource text:\n${params.source_text}`,
  customOutputExtractor: (result) =>
    JSON.stringify(result.finalOutput ?? {}),
});

export const idleTool = idleDirectorAgent.asTool({
  toolName: "generate_idle_motion",
  toolDescription:
    "Generate ambient group motion for Orbis when the room is idle.",
  parameters: z.object({
    occupancy_json: z.string(),
    scene_json: z.string(),
    elapsed_seconds: z.number(),
  }),
  inputBuilder: ({ params }) =>
    `Generate idle motion.\n\nElapsed seconds: ${params.elapsed_seconds}\n\nOccupancy:\n${params.occupancy_json}\n\nScene:\n${params.scene_json}`,
  customOutputExtractor: (result) =>
    JSON.stringify(result.finalOutput ?? {}),
});

export const roomOrchestrator = new Agent({
  name: "RoomOrchestrator",
  instructions: `You coordinate a live persona room.
- For user chat turns: call run_dialogue_turn exactly once.
- For persona compilation requests: call compile_persona.
- For idle or ambient motion: call generate_idle_motion.
Never answer in your own voice. Always delegate to a tool.`,
  model: getAgentModel(),
  tools: [dialogueTool, compilerTool, idleTool],
});
