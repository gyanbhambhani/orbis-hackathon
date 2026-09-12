export function getAgentModel(): string {
  return process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
}
