import { getAgentModel } from "@/lib/agents/model";
import { roomOrchestrator } from "@/lib/agents/orchestrator";

export async function GET() {
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
  const model = getAgentModel();

  return Response.json({
    ok: hasApiKey,
    model,
    orchestrator: roomOrchestrator.name,
    tools: ["run_dialogue_turn", "compile_persona", "generate_idle_motion"],
    message: hasApiKey
      ? "OpenAI API key is configured."
      : "OPENAI_API_KEY is not set. Add it to .env.local.",
  });
}
