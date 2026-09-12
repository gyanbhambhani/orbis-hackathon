import type { SceneState } from "@/lib/schemas/scene";

export const CONSENT_BASES = [
  "self",
  "deceased_family_member",
  "fictional",
  "licensed",
] as const;

export type ConsentBasis = (typeof CONSENT_BASES)[number];

export type PersonaConsent = {
  basis: ConsentBasis;
  attested_by: string;
  attested_at: string;
};

export type PersonaCard = {
  id: string;
  display_name: string;
  relationship_to_user: string;
  consent: PersonaConsent;
  temporal_anchor: {
    knowledge_cutoff: string;
    apparent_age: number;
    era_markers: string[];
  };
  appearance: {
    reference_images: string[];
    descriptors: string;
    wardrobe: string;
  };
  voice: {
    tts_voice_id: string;
    pace_wpm: number;
    accent: string;
    verbal_tics: string[];
    thinking_sounds: string[];
  };
  speech: {
    avg_sentence_words: number;
    register: "plain" | "formal" | "technical" | "ornate";
    catchphrases: string[];
    humor: string;
    question_return_rate: number;
  };
  affect: {
    baseline: string;
    range: string[];
    softens_on: string[];
    bristles_on: string[];
  };
  relationship_memory: Array<{
    fact: string;
    source: "user_text" | "image_caption";
    confidence: number;
  }>;
  default_scene: SceneState;
  boundaries: {
    will_not_discuss: string[];
    unknown_response: string;
  };
};

export type PersonaSummary = {
  id: string;
  display_name: string;
  relationship_to_user: string;
  knowledge_cutoff: string;
  image_count: number;
  consent_basis: ConsentBasis;
};
