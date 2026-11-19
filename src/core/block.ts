// The ```agenda code block placed in person and meeting notes, and the rules
// for audience names. Pure: no obsidian import.

const MISSING = 'Missing "audience:" line, e.g. `audience: daily`.';
const AUDIENCE_LINE = /^(\s*audience\s*:\s*)(.*?)(\s*)$/i;
const LAYOUT_LINE = /^\s*layout\s*:(.*)$/i;

/** `audience: all` makes the overview block; the name is reserved. */
export const ALL = "all";

export type Layout = "audience" | "items";

export interface BlockSpec {
  audience: string;
  all: boolean;
  layout: Layout;
}

/** Drop a trailing "# comment" (a "#" preceded by whitespace), as in YAML. */
function stripComment(value: string): string {
  const m = /\s#/.exec(value);
  return (m === null ? value : value.slice(0, m.index)).trim();
}

function unquote(value: string): string {
  const m = /^(['"])(.*)\1$/.exec(value);
  return m === null ? value : m[2];
}

export function parseBlockSource(src: string): BlockSpec | { error: string } {
  let audience: string | null = null;
  let layout: string | null = null;
  for (const line of src.split(/\r?\n/)) {
    const a = AUDIENCE_LINE.exec(line);
    if (a !== null) {
      if (audience === null) audience = unquote(stripComment(a[2])).trim();
      continue;
    }
    const l = LAYOUT_LINE.exec(line);
    if (l !== null && layout === null) layout = unquote(stripComment(l[1])).trim();
  }
  if (audience === null || audience === "") return { error: MISSING };
  const all = audience.toLowerCase() === ALL;
  // The layout only matters for the overview block; a single-audience block ignores it.
  if (!all) return { audience, all, layout: "audience" };
  const lower = (layout ?? "").toLowerCase();
  if (lower === "" || lower === "audience") return { audience: ALL, all, layout: "audience" };
  if (lower === "items") return { audience: ALL, all, layout: "items" };
  return { error: `Unknown layout "${layout}". Use "audience" or "items".` };
}

const OPEN = /^\s*(`{3,}|~{3,})\s*agenda\s*$/;

/** Rewrite `audience: <from>` to `<to>` inside agenda blocks only. */
export function renameInBlocks(content: string, from: string, to: string): string {
  const lines = content.split("\n");
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    const cr = lines[i].endsWith("\r") ? "\r" : "";
    if (fence === null) {
      const open = OPEN.exec(line);
      if (open !== null) fence = open[1];
      continue;
    }
    const trimmed = line.trim();
    if (trimmed.length >= fence.length && trimmed === fence[0].repeat(trimmed.length)) {
      fence = null;
      continue;
    }
    const m = AUDIENCE_LINE.exec(line);
    if (m === null) continue;
    const raw = m[2];
    const quote = /^(['"]).*\1$/.test(raw) ? raw[0] : "";
    if (unquote(raw).trim() !== from) continue;
    lines[i] = `${m[1]}${quote}${to}${quote}${m[3]}${cr}`;
  }
  return lines.join("\n");
}

export function validateAudienceName(name: string, existing: string[], renamingFrom?: string): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Name can't be empty.";
  if (/[,·\r\n]/.test(trimmed)) return 'Name can\'t contain "," or "·".';
  if (trimmed.toLowerCase() === ALL) return `"${ALL}" is reserved for the overview block.`;
  const lower = trimmed.toLowerCase();
  const clash = existing.some((e) => e !== renamingFrom && e.toLowerCase() === lower);
  return clash ? `"${trimmed}" already exists.` : null;
}
