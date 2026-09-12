import { ROOM_LOCATION, type RoomPersona } from "@/lib/room/personas";

export function previewOrbisPrompt(
  guests: RoomPersona[],
  motion: string,
) {
  if (guests.length === 0) {
    return [
      ROOM_LOCATION + ".",
      "Empty guest chairs around a low table.",
      "A listener sits at the near edge, back to camera.",
      "Camera holding steady.",
      motion,
    ].join(" ");
  }

  const cast = guests
    .map(
      (guest) =>
        `${guest.descriptors}, ${guest.wardrobe}, ${guest.location_note}`,
    )
    .join(". ");

  const locks = guests
    .map((guest) => guest.wardrobe)
    .join("; ");

  return [
    `The same parlor. ${ROOM_LOCATION}.`,
    `Seated together: ${cast}.`,
    "A listener at the near chair, back half-turned.",
    `Continuity: ${locks}; same parlor; same table.`,
    "Camera holding steady.",
    motion,
  ].join(" ");
}
