// Audiences are notes: a person (type: person) or a meeting (type: meeting),
// named after the note. Nothing is kept in the settings. Pure.

export interface Audience {
  name: string;
  path: string;
  /** False with `active: false`: hidden from the pickers, still shown where it has items. */
  active: boolean;
}

export const NO_AUDIENCES = "No audiences yet. Add type: person or type: meeting to a person's or a meeting's note.";

const TYPES = ["person", "meeting"];

export function toAudience(path: string, basename: string, fm: unknown): Audience | null {
  if (typeof fm !== "object" || fm === null) return null;
  const f = fm as Record<string, unknown>;
  if (typeof f.type !== "string" || !TYPES.includes(f.type)) return null;
  const inactive = f.active === false || (typeof f.active === "string" && f.active.trim().toLowerCase() === "false");
  return { name: basename, path, active: !inactive };
}

function sortedNames(list: Audience[]): string[] {
  return [...new Set(list.map((a) => a.name))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

/** Names to pick from: active audiences, sorted, one per name. */
export function activeNames(list: Iterable<Audience>): string[] {
  return sortedNames([...list].filter((a) => a.active));
}

/** Every audience note's name, inactive ones included, sorted. */
export function allNames(list: Iterable<Audience>): string[] {
  return sortedNames([...list]);
}
