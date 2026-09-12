from __future__ import annotations

import asyncio
import base64
import inspect
import io
import os
import uuid
from collections.abc import Awaitable
from dataclasses import dataclass, field
from typing import Any

from PIL import Image
from reactor_sdk import Reactor, ReactorStatus


class OrbisStreamError(RuntimeError):
    """A Reactor session could not be started or controlled."""


async def _maybe_await(value: Any) -> None:
    if inspect.isawaitable(value):
        await value


@dataclass
class OrbisStream:
    stream_id: str
    prompt: str
    reactor: Reactor | None = None
    status: str = "starting"
    task: asyncio.Task[None] | None = None
    started: asyncio.Future[None] | None = None
    frames: asyncio.Queue[dict[str, str]] = field(
        default_factory=lambda: asyncio.Queue(maxsize=2)
    )

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        self.started = loop.create_future()
        try:
            # REACTOR_API_KEY is the documented name. ORBIS_API_KEY supports
            # the existing local shell configuration for this project.
            api_key = os.environ.get("REACTOR_API_KEY") or os.environ.get("ORBIS_API_KEY")
            if not api_key:
                raise OrbisStreamError(
                    "Set REACTOR_API_KEY (or ORBIS_API_KEY) before starting a stream"
                )

            reactor = Reactor(
                model_name="reactor/visko-orbis-stable",
                api_key=api_key,
            )
            self.reactor = reactor

            @reactor.on_status(ReactorStatus.READY)
            async def on_ready(_: ReactorStatus) -> None:
                try:
                    output = reactor.tracks.with_direction("recvonly").with_kind("video").one()

                    @output.on_frame
                    def on_frame(frame: Any) -> None:
                        payload = self._frame_payload(frame)
                        loop.call_soon_threadsafe(self._enqueue_latest_frame, payload)

                    await reactor.send_command("set_prompt", {"prompt": self.prompt})
                    await reactor.send_command("start", {})
                    self.status = "streaming"
                    if not self.started.done():
                        self.started.set_result(None)
                except Exception as error:
                    self.status = "failed"
                    if not self.started.done():
                        self.started.set_exception(error)

            await reactor.connect()
            # Keep this server-owned session and its frame callbacks alive.
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            raise
        except Exception as error:
            self.status = "failed"
            if self.started and not self.started.done():
                self.started.set_exception(error)
            raise

    @staticmethod
    def _frame_payload(frame: Any) -> dict[str, str]:
        image = Image.fromarray(frame)
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=82)
        return {
            "type": "frame",
            "mime_type": "image/jpeg",
            "data": base64.b64encode(buffer.getvalue()).decode("ascii"),
        }

    def _enqueue_latest_frame(self, payload: dict[str, str]) -> None:
        try:
            self.frames.put_nowait(payload)
        except asyncio.QueueFull:
            # Keep latency low by discarding an older frame.
            self.frames.get_nowait()
            self.frames.put_nowait(payload)

    async def steer(self, prompt: str) -> None:
        if self.status != "streaming" or self.reactor is None:
            raise OrbisStreamError("Stream is not running")
        await self.reactor.send_command("set_prompt", {"prompt": prompt})
        self.prompt = prompt

    async def stop(self) -> None:
        self.status = "stopped"
        if self.reactor is not None:
            disconnect = getattr(self.reactor, "disconnect", None)
            if disconnect is not None:
                await _maybe_await(disconnect())
        if self.task is not None:
            self.task.cancel()
            try:
                await self.task
            except (asyncio.CancelledError, Exception):
                # The caller that started/stopped the stream reports the
                # original Reactor error. Cleanup must not replace it.
                pass


class StreamManager:
    def __init__(self) -> None:
        self._streams: dict[str, OrbisStream] = {}

    async def start(self, prompt: str) -> OrbisStream:
        stream = OrbisStream(stream_id=str(uuid.uuid4()), prompt=prompt)
        stream.task = asyncio.create_task(stream.run())
        # Reactor's initial connection can take time; fail the HTTP request
        # rather than returning an unusable stream ID.
        while stream.started is None:
            await asyncio.sleep(0)
        try:
            await asyncio.wait_for(stream.started, timeout=90)
        except Exception:
            await stream.stop()
            raise
        self._streams[stream.stream_id] = stream
        return stream

    def get(self, stream_id: str) -> OrbisStream:
        try:
            return self._streams[stream_id]
        except KeyError as error:
            raise OrbisStreamError("Unknown stream ID") from error

    async def steer(self, stream_id: str, prompt: str) -> OrbisStream:
        stream = self.get(stream_id)
        await stream.steer(prompt)
        return stream

    async def stop(self, stream_id: str) -> None:
        stream = self.get(stream_id)
        await stream.stop()
        self._streams.pop(stream_id, None)

    async def shutdown(self) -> None:
        await asyncio.gather(
            *(stream.stop() for stream in tuple(self._streams.values())),
            return_exceptions=True,
        )
        self._streams.clear()
