import { readFileSync } from "node:fs";
import { join } from "node:path";

export function loadPrompt(filename: string): string {
  return readFileSync(join(process.cwd(), "prompts", filename), "utf-8");
}
