import { Agent } from "@openai/agents";

import { loadPrompt } from "@/lib/agents/load-prompt";
import { getAgentModel } from "@/lib/agents/model";
import { CompilerOutputSchema } from "@/lib/schemas/turn";

export const compilerAgent = new Agent({
  name: "CompilerAgent",
  instructions: loadPrompt("compiler.md"),
  model: getAgentModel(),
  outputType: CompilerOutputSchema,
});
