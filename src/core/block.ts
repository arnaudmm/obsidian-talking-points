// The ```agenda code block placed in person and meeting notes. Pure: no
// obsidian import.
import { audienceName } from "./item.ts";

const NO_AUDIENCE = 'Add "audience:" (e.g. `audience: Marc`), or put this block in a note with type: person or type: meeting.';
const AUDIENCE_LINE = /^(\s*audience\s*:\s*)(.*?)(\s*)$/i;
const LAYOUT_LINE = /^\s*layout\s*:(.*)$/i;

/** `audience: all` makes the overview block; the name is reserved. */
export const ALL = "all";

export type Layout = "audience" | "items";

export interface BlockSpec {
  /** Null when the block has no audience line: it is the note's own audience. */
  audience: string | null;
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
      if (audience === null) audience = audienceName(unquote(stripComment(a[2])));
      continue;
    }
    const l = LAYOUT_LINE.exec(line);
    if (l !== null && layout === null) layout = unquote(stripComment(l[1])).trim();
  }
  if (audience === null || audience === "") return { audience: null, all: false, layout: "audience" };
  const all = audience.toLowerCase() === ALL;
  // The layout only matters for the overview block; a single-audience block ignores it.
  if (!all) return { audience, all, layout: "audience" };
  const lower = (layout ?? "").toLowerCase();
  if (lower === "" || lower === "audience") return { audience: ALL, all, layout: "audience" };
  if (lower === "items") return { audience: ALL, all, layout: "items" };
  return { error: `Unknown layout "${layout}". Use "audience" or "items".` };
}

/** The block's audience: its own line, else the audience note it sits in. */
export function resolveAudience(spec: BlockSpec, noteAudience: string | null): string | { error: string } {
  return spec.audience ?? noteAudience ?? { error: NO_AUDIENCE };
}
