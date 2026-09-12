"use client";

import { ReactorProvider } from "@reactor-team/js-sdk";
import { useCallback, useRef } from "react";

import { ChatDock } from "@/components/room/chat-dock";
import { OrbisDrawer } from "@/components/room/orbis-drawer";
import { PersonaRail } from "@/components/room/persona-rail";
import { RoomStage } from "@/components/room/room-stage";
import { useOrbisSession } from "@/hooks/use-orbis-session";
import { useRoom } from "@/hooks/use-room";
import { ROOM_LOCATION } from "@/lib/room/personas";
import { ORBIS_MODEL_NAME, ORBIS_TRACKS, requestReactorJwt } from "@/lib/orbis";

function formatClock(ms: number) {
  const total = Math.min(Math.floor(ms / 1000), 20 * 60);
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function RoomApp() {
  const jwtPromise = useRef<Promise<string> | null>(null);
  const getJwt = useCallback(() => {
    jwtPromise.current ??= requestReactorJwt();
    return jwtPromise.current;
  }, []);
  const clearJwt = useCallback(() => {
    jwtPromise.current = null;
  }, []);

  return (
    <ReactorProvider
      apiUrl="https://api.reactor.inc"
      modelName={ORBIS_MODEL_NAME}
      modelTracks={[...ORBIS_TRACKS]}
      connectOptions={{ autoConnect: false }}
      jwtToken={getJwt}
    >
      <RoomShell clearJwt={clearJwt} />
    </ReactorProvider>
  );
}

function RoomShell({ clearJwt }: { clearJwt: () => void }) {
  const orbis = useOrbisSession(clearJwt);
  const room = useRoom();

  return (
    <div className="room-shell">
      <header className="room-chrome">
        <p className="wordmark">
          Revenant
          <span>personality bank</span>
        </p>
        <p className="chrome-meta">
          <span>{ROOM_LOCATION}</span>
          <span>
            You and {room.seated.length}
          </span>
          <span className={room.capped ? "clock is-capped" : "clock"}>
            {formatClock(room.elapsedMs)} / 20:00
          </span>
        </p>
      </header>

      <div className="room-grid">
        <RoomStage room={room} orbis={orbis} />
        <aside className="room-rail">
          <PersonaRail room={room} />
          <ChatDock room={room} />
          <OrbisDrawer orbis={orbis} room={room} />
        </aside>
      </div>
    </div>
  );
}
