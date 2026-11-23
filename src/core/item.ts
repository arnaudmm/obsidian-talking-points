// The item note model: its properties, how they are read when edited by
// hand, and how a new note is written. Pure: no obsidian import.

export type Frontmatter = Record<string, unknown>;

export interface ItemProps {
  type: "agenda";
  created: string;
  audiences: string[];
  pending: string[];
}

export function isItem(fm: unknown): boolean {
  return typeof fm === "object" && fm !== null && (fm as Frontmatter).type === "agenda";
}

/**
 * The audience's name from a link to its note ("[[Marc]]", "[[People/Marc|Marc D.]]")
 * or a plain name. Unquoted [[Marc]] is YAML for a nested list, [["Marc"]].
 */
export function audienceName(v: unknown): string {
  let raw = v;
  while (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  const link = /^\[\[([^\]]*)\]\]$/.exec(s);
  if (link === null) return s;
  const target = link[1].split("|")[0];
  return (target.split("/").pop() ?? "").replace(/\.md$/i, "").trim();
}

export function audienceLink(name: string): string {
  return `[[${name}]]`;
}

/** Read a list of audiences the way a person may have typed it: a list, a single string, or nothing. Names, not links. */
export function readList(v: unknown): string[] {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const out: string[] = [];
  for (const entry of raw) {
    const name = audienceName(entry);
    if (name !== "" && !out.includes(name)) out.push(name);
  }
  return out;
}

/** The property value for a list of names: links, so renaming a note updates them. */
function writeList(names: string[]): string[] {
  return names.map(audienceLink);
}

export function newItemProps(audiences: string[], created: string): ItemProps {
  const list = readList(audiences);
  return { type: "agenda", created, audiences: list, pending: [...list] };
}

function yamlList(names: string[]): string {
  return `[${writeList(names).map((n) => JSON.stringify(n)).join(", ")}]`;
}

export function renderItemNote(props: ItemProps, details: string): string {
  const head = [
    "---",
    `type: ${props.type}`,
    `created: ${props.created}`,
    `audiences: ${yamlList(props.audiences)}`,
    `pending: ${yamlList(props.pending)}`,
    "---",
  ].join("\n");
  const body = details.trim();
  return `${head}\n${body === "" ? "" : `${body}\n\n`}## Log\n`;
}

export function markShared(fm: Frontmatter, audience: string): boolean {
  const pending = readList(fm.pending);
  const i = pending.indexOf(audience);
  if (i === -1) return false;
  pending.splice(i, 1);
  fm.pending = writeList(pending);
  return true;
}

/**
 * Set the pending list from the edit window. With `initial` (the boxes ticked
 * when the window opened), only what was changed in the window is applied, so
 * an edit made meanwhile to the live list is kept.
 */
export function setPending(fm: Frontmatter, selected: string[], initial?: string[]): void {
  const chosen = readList(selected);
  let pending = chosen;
  if (initial !== undefined) {
    const before = readList(initial);
    const removed = before.filter((n) => !chosen.includes(n));
    const added = chosen.filter((n) => !before.includes(n));
    pending = readList([...readList(fm.pending).filter((n) => !removed.includes(n)), ...added]);
  }
  const audiences = readList(fm.audiences);
  for (const name of pending) if (!audiences.includes(name)) audiences.push(name);
  fm.audiences = writeList(audiences);
  fm.pending = writeList(pending);
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100)
    .trim();
}

export function uniquePath(folder: string, base: string, exists: (path: string) => boolean): string {
  const prefix = folder === "" ? "" : `${folder}/`;
  let path = `${prefix}${base}.md`;
  for (let n = 2; exists(path); n++) path = `${prefix}${base} ${n}.md`;
  return path;
}

/**
 * A lookup that finds an existing path whatever its case, returning its real
 * spelling. macOS and Windows disks treat "Budget.md" and "budget.md" as the
 * same file, while Obsidian's path lookups are case-sensitive.
 */
export function caseInsensitiveLookup(paths: Iterable<string>): (path: string) => string | undefined {
  const byLower = new Map<string, string>();
  for (const p of paths) byLower.set(p.toLowerCase(), p);
  return (path) => byLower.get(path.toLowerCase());
}
