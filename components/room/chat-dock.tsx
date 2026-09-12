"use client";

import { FormEvent, useEffect, useRef } from "react";

import type { RoomState } from "@/hooks/use-room";
import { personaById } from "@/lib/room/personas";

export function ChatDock({ room }: { room: RoomState }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [room.messages, room.thinking]);

  const placeholder =
    room.roomClosed
      ? "The room has closed."
      : room.seated.length === 0
        ? "Seat someone before you speak."
        : room.seated.length === 1
          ? `Say something to ${room.seated[0].display_name}.`
          : "Say something to the room.";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    room.send();
  };

  return (
    <section className="chat-dock">
      <header className="rail-head">
        <span>Talk</span>
        <em className="disclosure-inline">generated voices</em>
      </header>

      <div className="thread" ref={scroller}>
        {room.messages.length === 0 && (
          <p className="thread-empty">
            They will answer as themselves. They already know you are
            in the near chair, and they will notice who else sits.
          </p>
        )}
        {room.messages.map((message) => {
          const persona = message.personaId
            ? personaById(message.personaId)
            : null;
          return (
            <article
              key={message.id}
              className={`bubble bubble-${message.role}`}
            >
              <span className="bubble-name">
                {persona ? persona.portrait.initials : "YO"} {message.name}
              </span>
              <p>{message.text}</p>
            </article>
          );
        })}
        {room.thinking && (
          <p className="thinking">{room.thinking}</p>
        )}
      </div>

      {room.distress ? (
        <div className="distress-card">
          <strong>The room has stepped out of character.</strong>
          <p>
            If you are in crisis, call 988 in the US, or local emergency
            services. This parlor is generated. It cannot help.
          </p>
        </div>
      ) : (
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="room-talk">
            Message the room
          </label>
          <textarea
            id="room-talk"
            rows={3}
            value={room.draft}
            placeholder={placeholder}
            disabled={room.roomClosed || room.seated.length === 0}
            onChange={(event) => room.setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                room.send();
              }
            }}
          />
          <button
            type="submit"
            disabled={
              room.roomClosed ||
              room.seated.length === 0 ||
              !room.draft.trim()
            }
          >
            Send
          </button>
        </form>
      )}
    </section>
  );
}
