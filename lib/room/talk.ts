import type { RoomPersona } from "@/lib/room/personas";

export type ChatRole = "user" | "persona" | "notice";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  personaId?: string;
  name: string;
  text: string;
  at: number;
};

const YEAR = /(20[2-3]\d)/g;

function clip(text: string, words: number) {
  const parts = text.split(/\s+/);
  if (parts.length <= words + 4) return text;
  return `${parts.slice(0, words).join(" ")}.`;
}

function mentionsYearAfterCutoff(text: string, cutoff: string) {
  const cut = Number(cutoff.slice(0, 4));
  if (!Number.isFinite(cut)) return false;
  const years = [...text.matchAll(YEAR)].map((match) => Number(match[1]));
  return years.some((year) => year > cut);
}

function afterlifeAsk(text: string) {
  return /afterlife|watching over|really here|from the other side|are you real/i
    .test(text);
}

function pickLead(guests: RoomPersona[], utterance: string, turn: number) {
  const named = guests.find((guest) =>
    utterance.toLowerCase().includes(guest.display_name.split(" ")[0]
      .toLowerCase()),
  );
  if (named) return named;
  return guests[turn % guests.length];
}

function leadLine(lead: RoomPersona, utterance: string, others: RoomPersona[]) {
  if (afterlifeAsk(utterance)) {
    return clip(
      `${lead.verbal_tics[0] ?? "mm"}. I'm a generated portrait, not ${
        lead.relationship_to_user
      } in the room. ${lead.unknown_response}`,
      lead.avg_sentence_words + 8,
    );
  }
  if (mentionsYearAfterCutoff(utterance, lead.knowledge_cutoff)) {
    return lead.unknown_response;
  }
  const tic = turnTic(lead, utterance.length);
  const other = others[0];
  if (other && utterance.length % 3 === 0) {
    return clip(
      `${tic}I heard you. ${other.display_name.split(" ")[0]} is here too, ` +
        `so I'll keep this short. ${lead.catchphrases[0] ?? "Go on."}`,
      lead.avg_sentence_words + 6,
    );
  }
  const ask =
    utterance.endsWith("?") ||
    (utterance.length % 10) / 10 < lead.question_return_rate
      ? " What do you need from us right now?"
      : "";
  return clip(
    `${tic}I'm with you in this parlor. ${lead.humor === "needling, fond"
      ? "Don't look at me like that."
      : "Say it again if you want."}${ask}`,
    lead.avg_sentence_words + 8,
  );
}

function turnTic(persona: RoomPersona, salt: number) {
  if (salt % 3 !== 0) return "";
  const tic = persona.verbal_tics[salt % persona.verbal_tics.length];
  return tic ? `${tic}— ` : "";
}

function asideLine(
  aside: RoomPersona,
  lead: RoomPersona,
  utterance: string,
) {
  if (mentionsYearAfterCutoff(utterance, aside.knowledge_cutoff)) {
    return `${aside.unknown_response}`;
  }
  return clip(
    `${aside.verbal_tics[0] ?? "mm"}. I heard ${
      lead.display_name.split(" ")[0]
    }. I'm still here. ${aside.catchphrases[0] ?? ""}`.trim(),
    aside.avg_sentence_words,
  );
}

export function entranceLines(
  arriving: RoomPersona,
  already: RoomPersona[],
): ChatMessage[] {
  const at = Date.now();
  if (already.length === 0) {
    return [
      notice(
        arriving,
        `${arriving.display_name} sits across from you. ` +
          `"I can see you. I'm not alone with a screen — you're in the chair."`,
        at,
      ),
    ];
  }
  const names = already.map((person) => person.display_name).join(" and ");
  const host = already[0];
  return [
    notice(
      arriving,
      `${arriving.display_name} takes a chair. ` +
        `"I see you. I see ${names} as well."`,
      at,
    ),
    {
      id: crypto.randomUUID(),
      role: "persona",
      personaId: host.id,
      name: host.display_name,
      text: clip(
        `${host.verbal_tics[0] ?? "mm"}. That's ${
          arriving.display_name.split(" ")[0]
        }. They'll sit. We don't speak for each other.`,
        host.avg_sentence_words + 4,
      ),
      at: at + 1,
    },
  ];
}

export function exitLines(
  leaving: RoomPersona,
  remaining: RoomPersona[],
): ChatMessage[] {
  const at = Date.now();
  const leave = notice(
    leaving,
    `${leaving.display_name} stands. "I'll leave the chair. ` +
      `I know you were looking."`,
    at,
  );
  if (remaining.length === 0) return [leave];
  const host = remaining[0];
  return [
    leave,
    {
      id: crypto.randomUUID(),
      role: "persona",
      personaId: host.id,
      name: host.display_name,
      text: clip(
        `${host.verbal_tics[0] ?? "mm"}. Empty chair beside me. ` +
          `I'm still looking at you.`,
        host.avg_sentence_words + 2,
      ),
      at: at + 1,
    },
  ];
}

export function roomReplies(
  guests: RoomPersona[],
  utterance: string,
  turn: number,
): ChatMessage[] {
  if (guests.length === 0) return [];
  const lead = pickLead(guests, utterance, turn);
  const others = guests.filter((guest) => guest.id !== lead.id);
  const at = Date.now();
  const messages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: "persona",
      personaId: lead.id,
      name: lead.display_name,
      text: leadLine(lead, utterance, others),
      at,
    },
  ];
  const aside = others[(turn + 1) % Math.max(others.length, 1)];
  if (aside && (utterance.length + turn) % 5 < 2) {
    messages.push({
      id: crypto.randomUUID(),
      role: "persona",
      personaId: aside.id,
      name: aside.display_name,
      text: asideLine(aside, lead, utterance),
      at: at + 1,
    });
  }
  return messages;
}

function notice(
  persona: RoomPersona,
  text: string,
  at: number,
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role: "notice",
    personaId: persona.id,
    name: persona.display_name,
    text,
    at,
  };
}
