import { run } from "@openai/agents";

import { roomOrchestrator } from "@/lib/agents/orchestrator";
import type { TurnRequest } from "@/lib/schemas/turn";

export async function runRoomTurn(req: TurnRequest) {
  const contextJson = JSON.stringify(
    {
      seatedIds: req.seatedIds,
      addressee: req.addressee ?? "room",
      messages: req.messages ?? [],
      scene: req.scene ?? {},
      roomWorkingMemory: req.roomWorkingMemory ?? [],
    },
    null,
    2,
  );

  return run(
    roomOrchestrator,
    `Dialogue turn: "${req.utterance}". Delegate to run_dialogue_turn.`,
    {
      context: {
        utterance: req.utterance,
        context_json: contextJson,
      },
    },
  );
}
