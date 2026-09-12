"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type AttentionMap,
  gazeAfterSit,
  gazeOnSpeaker,
  gazeOnUser,
  idleGaze,
} from "@/lib/room/attention";
import {
  BANK,
  MAX_GUESTS,
  personasByIds,
  type RoomPersona,
} from "@/lib/room/personas";
import { previewOrbisPrompt } from "@/lib/room/prompt";
import { canSeatMore, nextSeatedIds } from "@/lib/room/seating";
import {
  type ChatMessage,
  entranceLines,
  exitLines,
  roomReplies,
} from "@/lib/room/talk";

const SESSION_CAP_MS = 20 * 60 * 1000;
const IDLE_MS = 6000;

export function useRoom() {
  const [seatedIds, setSeatedIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attention, setAttention] = useState<AttentionMap>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [distress, setDistress] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const turn = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(Date.now());

  const seated = useMemo(() => personasByIds(seatedIds), [seatedIds]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setElapsedMs(Date.now() - started.current);
    }, 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setAttention((current) => {
        if (thinking) return current;
        return idleGaze(seatedIds, Math.floor(Date.now() / IDLE_MS));
      });
    }, IDLE_MS);
    return () => window.clearInterval(tick);
  }, [seatedIds, thinking]);

  const capped = elapsedMs >= SESSION_CAP_MS;
  const roomClosed = capped || distress;

  const toggleSeat = (id: string) => {
    if (roomClosed) return;
    const seatedAlready = seatedIds.includes(id);
    if (!seatedAlready && !canSeatMore(seatedIds)) return;

    const nextIds = nextSeatedIds(seatedIds, id);
    const nextPeople = personasByIds(nextIds);
    setSeatedIds(nextIds);

    if (seatedAlready) {
      const leaving = seated.find((person) => person.id === id);
      const remaining = nextPeople;
      if (leaving) {
        setMessages((current) => [
          ...current,
          ...exitLines(leaving, remaining),
        ]);
      }
      setAttention(gazeOnUser(nextIds));
      if (speakingId === id) setSpeakingId(null);
      return;
    }

    const arriving = nextPeople.find((person) => person.id === id);
    const already = nextPeople.filter((person) => person.id !== id);
    if (arriving) {
      setMessages((current) => [
        ...current,
        ...entranceLines(arriving, already),
      ]);
      setAttention(gazeAfterSit(nextIds, id));
      setSpeakingId(id);
    }
  };

  const cancelPending = () => {
    if (pending.current) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    setThinking(null);
  };

  const send = (text?: string) => {
    if (roomClosed) return;
    const utterance = (text ?? draft).trim();
    if (!utterance || seated.length === 0) return;

    if (/i want to die|kill myself|don't want to be here/i.test(utterance)) {
      setDistress(true);
      setDraft("");
      return;
    }

    cancelPending();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      name: "You",
      text: utterance,
      at: Date.now(),
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setAttention(gazeOnUser(seatedIds));

    const lead = seated[turn.current % seated.length];
    setThinking(lead.thinking_sounds[0] ?? "…");
    setSpeakingId(lead.id);

    pending.current = setTimeout(() => {
      const replies = roomReplies(seated, utterance, turn.current);
      turn.current += 1;
      const speaker = replies.find((message) => message.role === "persona");
      setMessages((current) => [...current, ...replies]);
      if (speaker?.personaId) {
        setSpeakingId(speaker.personaId);
        setAttention(gazeOnSpeaker(seatedIds, speaker.personaId));
      }
      setThinking(null);
      pending.current = null;
    }, 520);
  };

  const motion = thinking
    ? `${seated.find((person) => person.id === speakingId)
      ?.display_name ?? "Someone"} listens, eyes on you.`
    : speakingId
      ? `${seated.find((person) => person.id === speakingId)
        ?.display_name ?? "Someone"} has just spoken.`
      : "Small parlor motion, steam, a glance.";

  return {
    bank: BANK,
    seatedIds,
    seated,
    messages,
    draft,
    setDraft,
    attention,
    speakingId,
    thinking,
    elapsedMs,
    capped,
    distress,
    roomClosed,
    promptOpen,
    setPromptOpen,
    maxGuests: MAX_GUESTS,
    full: !canSeatMore(seatedIds),
    prompt: previewOrbisPrompt(seated, motion),
    toggleSeat,
    send,
    cancelPending,
  };
}

export type RoomState = ReturnType<typeof useRoom>;
export type { RoomPersona };
