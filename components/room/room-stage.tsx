"use client";

import { OrbisPlayer } from "@/components/orbis-player";
import { EmptyChair, Figure } from "@/components/room/figure";
import type { OrbisSession } from "@/hooks/use-orbis-session";
import type { RoomState } from "@/hooks/use-room";
import { personaById } from "@/lib/room/personas";
import { USER_SEAT, guestSlots } from "@/lib/room/seating";

const VACANT = [
  { left: "14%", bottom: "18%", z: 3 },
  { left: "32%", bottom: "30%", z: 2 },
  { left: "54%", bottom: "30%", z: 2 },
  { left: "72%", bottom: "18%", z: 3 },
];

export function RoomStage({
  room,
  orbis,
}: {
  room: RoomState;
  orbis: OrbisSession;
}) {
  const live = orbis.runStarted;
  const slots = guestSlots(room.seatedIds);

  return (
    <div className="glass">
      <div className="glass-bezel">
        <div className="glass-screen">
          {live ? (
            <OrbisPlayer
              connected={orbis.connected}
              muted={orbis.muted}
              runStarted={orbis.runStarted}
              status={orbis.status}
            />
          ) : (
            <div className="parlor" aria-hidden="true">
              <div className="parlor-window" />
              <div className="parlor-lamp" />
              <div className="parlor-table" />
              <div className="parlor-grain" />
            </div>
          )}

          <div className="cast-layer">
            <Figure you {...USER_SEAT} />
            {VACANT.map((anchor, index) =>
              slots[index] ? (
                <Figure
                  key={slots[index].personaId}
                  persona={personaById(slots[index].personaId) ?? undefined}
                  gaze={room.attention[slots[index].personaId]}
                  speaking={room.speakingId === slots[index].personaId}
                  thinking={room.thinking}
                  left={slots[index].left}
                  bottom={slots[index].bottom}
                  z={slots[index].z}
                />
              ) : (
                <EmptyChair key={`vacant-${index}`} {...anchor} />
              ),
            )}
          </div>

          {room.seated.length === 0 && (
            <p className="glass-empty">
              Seat someone from the rail. They will be able to see you.
            </p>
          )}

          <p className="disclosure-chip">
            Generated room — not the actual people
          </p>
        </div>
      </div>
    </div>
  );
}
