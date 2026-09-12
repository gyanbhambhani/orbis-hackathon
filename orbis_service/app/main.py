from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect

from .models import StartStreamRequest, SteerStreamRequest, StreamResponse
from .stream_manager import OrbisStreamError, StreamManager

manager = StreamManager()


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await manager.shutdown()


app = FastAPI(title="Orbis Reactor Service", lifespan=lifespan)


def stream_response(stream_id: str, status: str) -> StreamResponse:
    return StreamResponse(
        stream_id=stream_id,
        status=status,  # type: ignore[arg-type]
        ws_url=f"/v1/orbis/streams/{stream_id}/frames",
    )


@app.post("/v1/orbis/streams", response_model=StreamResponse, status_code=201)
async def start_stream(request: StartStreamRequest) -> StreamResponse:
    try:
        stream = await manager.start(request.prompt)
        return stream_response(stream.stream_id, stream.status)
    except OrbisStreamError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Reactor failed to start: {error}") from error


@app.post("/v1/orbis/streams/{stream_id}/prompts", response_model=StreamResponse)
async def steer_stream(stream_id: str, request: SteerStreamRequest) -> StreamResponse:
    try:
        stream = await manager.steer(stream_id, request.prompt)
        return stream_response(stream.stream_id, stream.status)
    except OrbisStreamError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/v1/orbis/streams/{stream_id}", status_code=204)
async def stop_stream(stream_id: str) -> None:
    try:
        await manager.stop(stream_id)
    except OrbisStreamError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.websocket("/v1/orbis/streams/{stream_id}/frames")
async def stream_frames(websocket: WebSocket, stream_id: str) -> None:
    try:
        stream = manager.get(stream_id)
    except OrbisStreamError:
        await websocket.close(code=4404, reason="Unknown stream ID")
        return

    await websocket.accept()
    try:
        while stream.status == "streaming":
            frame = await stream.frames.get()
            await websocket.send_json(frame)
    except WebSocketDisconnect:
        return
