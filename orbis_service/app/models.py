from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StartStreamRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4_000)


class SteerStreamRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4_000)


class StreamResponse(BaseModel):
    stream_id: str
    status: Literal["starting", "streaming", "stopped", "failed"]
    ws_url: str


class ToolResult(BaseModel):
    stream_id: str
    status: Literal["starting", "streaming", "stopped", "failed"]
    message: str
