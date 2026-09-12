import { MAX_GUESTS } from "@/lib/room/personas";

export type SeatId = 0 | 1 | 2 | 3 | 4;

export type SeatSlot = {
  seat: SeatId;
  personaId: string | "user";
  left: string;
  bottom: string;
  z: number;
};

const GUEST_ANCHORS: Array<Pick<SeatSlot, "left" | "bottom" | "z">> = [
  { left: "14%", bottom: "18%", z: 3 },
  { left: "32%", bottom: "30%", z: 2 },
  { left: "54%", bottom: "30%", z: 2 },
  { left: "72%", bottom: "18%", z: 3 },
];

export const USER_SEAT: SeatSlot = {
  seat: 0,
  personaId: "user",
  left: "43%",
  bottom: "4%",
  z: 4,
};

export function canSeatMore(seatedIds: string[]) {
  return seatedIds.length < MAX_GUESTS;
}

export function nextSeatedIds(seatedIds: string[], id: string) {
  if (seatedIds.includes(id)) {
    return seatedIds.filter((seated) => seated !== id);
  }
  if (!canSeatMore(seatedIds)) return seatedIds;
  return [...seatedIds, id];
}

export function guestSlots(seatedIds: string[]): SeatSlot[] {
  return seatedIds.map((personaId, index) => ({
    seat: (index + 1) as SeatId,
    personaId,
    ...GUEST_ANCHORS[index],
  }));
}
