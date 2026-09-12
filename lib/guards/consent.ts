import {
  CONSENT_BASES,
  type ConsentBasis,
  type PersonaConsent,
} from "@/lib/schemas/persona";

export function parseConsentBasis(value: unknown): ConsentBasis | null {
  if (typeof value !== "string") return null;
  return CONSENT_BASES.includes(value as ConsentBasis)
    ? (value as ConsentBasis)
    : null;
}

export function requireConsent(input: {
  basis: unknown;
  attested_by: unknown;
}): PersonaConsent {
  const basis = parseConsentBasis(input.basis);
  const attested_by =
    typeof input.attested_by === "string" ? input.attested_by.trim() : "";
  if (!basis) {
    throw new Error("Choose a consent basis before compiling.");
  }
  if (!attested_by) {
    throw new Error("Type your name to attest this persona.");
  }
  return {
    basis,
    attested_by,
    attested_at: new Date().toISOString(),
  };
}
