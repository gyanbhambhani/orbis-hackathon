"use client";

import type { GazeTarget } from "@/lib/room/attention";
import type { RoomPersona } from "@/lib/room/personas";

type FigureProps = {
  persona?: RoomPersona;
  you?: boolean;
  gaze?: GazeTarget;
  speaking?: boolean;
  thinking?: string | null;
  left: string;
  bottom: string;
  z: number;
};

export function Figure({
  persona,
  you,
  gaze,
  speaking,
  thinking,
  left,
  bottom,
  z,
}: FigureProps) {
  const cloth = you ? "#2a2420" : persona?.portrait.cloth ?? "#444";
  const hair = persona?.portrait.hair ?? "#1a1512";
  const skin = you ? "#c9b09a" : persona?.portrait.skin ?? "#c9b09a";
  const label = you ? "You" : persona?.display_name ?? "";
  const gazeLabel = you
    ? "in the near chair"
    : gaze === "user"
      ? "looking at you"
      : gaze
        ? "looking across the table"
        : "seated";

  return (
    <div
      className={`figure ${you ? "figure-you" : ""} ${
        speaking ? "is-speaking" : ""
      }`}
      style={{ left, bottom, zIndex: z }}
    >
      <div className="figure-body" style={{ background: cloth }}>
        <div className="figure-head" style={{ background: skin }}>
          <span className="figure-hair" style={{ background: hair }} />
          <span
            className={`figure-gaze ${gaze === "user" ? "gaze-you" : "gaze-side"}`}
          />
        </div>
      </div>
      <div className="figure-plate">
        <strong>{label}</strong>
        <span>{thinking && speaking ? thinking : gazeLabel}</span>
      </div>
    </div>
  );
}

export function EmptyChair({
  left,
  bottom,
  z,
}: {
  left: string;
  bottom: string;
  z: number;
}) {
  return (
    <div className="figure figure-empty" style={{ left, bottom, zIndex: z }}>
      <div className="figure-body empty-chair" />
      <div className="figure-plate muted sr-only">
        <strong>Empty chair</strong>
        <span>open seat</span>
      </div>
    </div>
  );
}
