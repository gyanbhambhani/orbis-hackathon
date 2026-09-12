from __future__ import annotations

from dataclasses import dataclass

from agents import RunContextWrapper, function_tool

from .models import ToolResult
from .stream_manager import StreamManager


@dataclass
class OrbisToolContext:
    stream_manager: StreamManager


@function_tool(name_override="start_orbis_stream")
async def start_orbis_stream(
    ctx: RunContextWrapper[OrbisToolContext], prompt: str
) -> str:
    """Start a server-owned Visko Orbis video stream for a completed video prompt."""
    stream = await ctx.context.stream_manager.start(prompt)
    return ToolResult(
        stream_id=stream.stream_id,
        status=stream.status,
        message="Orbis stream started. Relay its frames using the stream ID.",
    ).model_dump_json()


@function_tool(name_override="steer_orbis_stream")
async def steer_orbis_stream(
    ctx: RunContextWrapper[OrbisToolContext], stream_id: str, prompt: str
) -> str:
    """Steer a running Visko Orbis stream without restarting it."""
    stream = await ctx.context.stream_manager.steer(stream_id, prompt)
    return ToolResult(
        stream_id=stream.stream_id,
        status=stream.status,
        message="Prompt accepted; Orbis will apply the change at the next chunk boundary.",
    ).model_dump_json()
