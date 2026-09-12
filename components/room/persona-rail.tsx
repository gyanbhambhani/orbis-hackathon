"use client";

import { useState } from "react";

import type { RoomState } from "@/hooks/use-room";
import type { RoomPersona } from "@/lib/room/personas";

export function PersonaRail({ room }: { room: RoomState }) {
  return (
    <div className="rail-people">
      <section className="rail-block">
        <header className="rail-head">
          <span>In the room</span>
          <em>
            You and {room.seated.length}
          </em>
        </header>
        <ol className="seat-list">
          <li className="seat-row you">
            <Token initials="YO" cloth="#2a2420" skin="#c9b09a" />
            <div>
              <strong>You</strong>
              <small>near chair · cannot leave</small>
            </div>
          </li>
          {room.seated.map((persona) => (
            <SeatedRow
              key={persona.id}
              persona={persona}
              speaking={room.speakingId === persona.id}
              onLeave={() => room.toggleSeat(persona.id)}
              disabled={room.roomClosed}
            />
          ))}
        </ol>
      </section>

      <section className="rail-block">
        <header className="rail-head">
          <span>Bank</span>
          <em>click to seat</em>
        </header>
        <ul className="polaroid-list">
          {room.bank.map((persona) => {
            const seated = room.seatedIds.includes(persona.id);
            const blocked = !seated && room.full;
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  className={`polaroid ${seated ? "is-seated" : ""}`}
                  disabled={room.roomClosed || blocked}
                  onClick={() => room.toggleSeat(persona.id)}
                  aria-pressed={seated}
                >
                  <Token
                    initials={persona.portrait.initials}
                    cloth={persona.portrait.cloth}
                    skin={persona.portrait.skin}
                    hair={persona.portrait.hair}
                  />
                  <span className="polaroid-copy">
                    <strong>{persona.display_name}</strong>
                    <small>
                      {persona.relationship_to_user}
                      {" · "}
                      cutoff {persona.knowledge_cutoff}
                    </small>
                    <b>{persona.consent_basis}</b>
                  </span>
                  <span className="polaroid-action">
                    {seated ? "Leave" : blocked ? "Table full" : "Seat"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {room.full && (
          <p className="rail-note">The table holds four.</p>
        )}
      </section>
    </div>
  );
}

function SeatedRow({
  persona,
  speaking,
  onLeave,
  disabled,
}: {
  persona: RoomPersona;
  speaking: boolean;
  onLeave: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`seat-row ${speaking ? "is-speaking" : ""}`}>
      <Token
        initials={persona.portrait.initials}
        cloth={persona.portrait.cloth}
        skin={persona.portrait.skin}
        hair={persona.portrait.hair}
      />
      <div>
        <strong>{persona.display_name}</strong>
        <small>{persona.wardrobe}</small>
        <button
          type="button"
          className="textish"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide memories" : "Memories"}
        </button>
        {open && (
          <ul className="memory-peek">
            {persona.memories.map((memory) => (
              <li key={memory.fact}>
                {memory.fact}
                <em>{memory.source_label}</em>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button
        type="button"
        className="textish"
        disabled={disabled}
        onClick={onLeave}
      >
        Unseat
      </button>
    </li>
  );
}

function Token({
  initials,
  cloth,
  skin,
  hair,
}: {
  initials: string;
  cloth: string;
  skin: string;
  hair?: string;
}) {
  return (
    <span className="token" style={{ background: cloth }} aria-hidden="true">
      <span className="token-face" style={{ background: skin }}>
        {hair && <i style={{ background: hair }} />}
        {initials}
      </span>
    </span>
  );
}
