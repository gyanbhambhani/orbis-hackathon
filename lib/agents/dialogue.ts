import { Agent } from "@openai/agents";

import { loadPrompt } from "@/lib/agents/load-prompt";
import { getAgentModel } from "@/lib/agents/model";
import { TurnOutputSchema } from "@/lib/schemas/turn";

export const dialogueAgent = new Agent({
  name: "DialogueAgent",
  instructions: loadPrompt("dialogue.md"),
  model: getAgentModel(),
  outputType: TurnOutputSchema,
});
