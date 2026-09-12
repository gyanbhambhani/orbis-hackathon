"use client";

import { OrbisControls } from "@/components/orbis-controls";
import type { OrbisSession } from "@/hooks/use-orbis-session";
import type { RoomState } from "@/hooks/use-room";

export function OrbisDrawer({
  orbis,
  room,
}: {
  orbis: OrbisSession;
  room: RoomState;
}) {
  return (
    <details className="world-drawer">
      <summary>World feed · {orbis.status}</summary>
      <p className="rail-note">
        One Orbis session fills the glass. Seating still uses the
        painted cast until the feed can hold the faces.
      </p>
      <label className="prompt-preview">
        <span>Prompt we would send</span>
        <textarea readOnly rows={5} value={room.prompt} />
      </label>
      <OrbisControls session={orbis} />
    </details>
  );
}
