import type { PersonaCard } from "@/lib/schemas/persona";

export type StoredImage = {
  mimeType: string;
  bytes: Buffer;
};

export type StoredPersona = {
  card: PersonaCard;
  images: StoredImage[];
};

export type PersonaDraft = {
  images: StoredImage[];
  created_at: number;
};

const personas = new Map<string, StoredPersona>();
const drafts = new Map<string, PersonaDraft>();

const DRAFT_TTL_MS = 30 * 60 * 1000;

function pruneDrafts() {
  const now = Date.now();
  for (const [id, draft] of drafts) {
    if (now - draft.created_at > DRAFT_TTL_MS) drafts.delete(id);
  }
}

export function createDraft(images: StoredImage[]) {
  pruneDrafts();
  const id = crypto.randomUUID();
  drafts.set(id, { images, created_at: Date.now() });
  return id;
}

export function getDraft(id: string) {
  pruneDrafts();
  return drafts.get(id) ?? null;
}

export function savePersona(card: PersonaCard, images: StoredImage[]) {
  personas.set(card.id, { card, images });
  return card;
}

export function listPersonas() {
  return [...personas.values()].map(({ card, images }) => ({
    id: card.id,
    display_name: card.display_name,
    relationship_to_user: card.relationship_to_user,
    knowledge_cutoff: card.temporal_anchor.knowledge_cutoff,
    image_count: images.length,
    consent_basis: card.consent.basis,
  }));
}

export function getPersona(id: string) {
  return personas.get(id) ?? null;
}

export function getPersonaImage(id: string, index: number) {
  const stored = personas.get(id);
  if (!stored) return null;
  return stored.images[index] ?? null;
}
