import { runRoomTurn } from "@/lib/agents/run";
import { parseTurnRequest } from "@/lib/schemas/turn";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const turnRequest = parseTurnRequest(body);
    const result = await runRoomTurn(turnRequest);

    return Response.json({
      ok: true,
      result: result.finalOutput,
      output: result.output,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Turn request failed.";

    const status = message.includes("required") ? 400 : 500;

    return Response.json({ ok: false, error: message }, { status });
  }
}
