import type { PersonaCard } from "@/lib/schemas/persona";

export function buildOrbisSeed(persona: PersonaCard) {
  const scene = persona.default_scene;
  const locks = scene.continuity_locks.join(", ");
  return [
    persona.appearance.descriptors,
    persona.appearance.wardrobe,
    scene.location,
    scene.subject_pose,
    scene.lighting,
    scene.props.length ? `Props: ${scene.props.join(", ")}.` : "",
    locks ? `Keep constant: ${locks}.` : "",
    "Same person throughout. Continuous shot, no cuts.",
    "Subtle natural motion, camera holding steady.",
  ]
    .filter((part) => part.trim())
    .join(" ");
}
