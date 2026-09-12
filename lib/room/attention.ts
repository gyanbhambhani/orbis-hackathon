export type GazeTarget = "user" | string;

export type AttentionMap = Record<string, GazeTarget>;

export function gazeAfterSit(
  seatedIds: string[],
  newId: string,
): AttentionMap {
  const next: AttentionMap = {};
  for (const id of seatedIds) {
    next[id] = id === newId ? "user" : newId;
  }
  if (seatedIds.length === 1) next[newId] = "user";
  return next;
}

export function gazeOnUser(seatedIds: string[]): AttentionMap {
  return Object.fromEntries(seatedIds.map((id) => [id, "user"]));
}

export function gazeOnSpeaker(
  seatedIds: string[],
  speakerId: string,
): AttentionMap {
  return Object.fromEntries(
    seatedIds.map((id) => [id, id === speakerId ? "user" : speakerId]),
  );
}

export function idleGaze(
  seatedIds: string[],
  tick: number,
): AttentionMap {
  if (seatedIds.length === 0) return {};
  if (seatedIds.length === 1) return { [seatedIds[0]]: "user" };

  const towardUser = seatedIds[tick % seatedIds.length];
  const next: AttentionMap = {};
  for (const [index, id] of seatedIds.entries()) {
    if (id === towardUser) {
      next[id] = "user";
      continue;
    }
    const other = seatedIds[(index + 1) % seatedIds.length];
    next[id] = other === id ? "user" : other;
  }
  return next;
}
