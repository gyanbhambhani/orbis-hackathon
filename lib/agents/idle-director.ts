import { Agent } from "@openai/agents";

import { loadPrompt } from "@/lib/agents/load-prompt";
import { getAgentModel } from "@/lib/agents/model";
import { IdleDirectorOutputSchema } from "@/lib/schemas/turn";

export const idleDirectorAgent = new Agent({
  name: "IdleDirectorAgent",
  instructions: loadPrompt("idle-director.md"),
  model: getAgentModel(),
  outputType: IdleDirectorOutputSchema,
});
