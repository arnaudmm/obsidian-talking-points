// The ```agenda code block placed in person and meeting notes. Its options are
// read the same way as Open Threads' threads block. Pure: no obsidian import.
import { audienceName } from "./item.ts";

/** `with: all` makes the overview block. */
export const ALL = "all";

export type Layout = "audience" | "items";

export interface BlockSpec {
  /** A name, "all", or null when not given: then it is the note's own audience. */
  audience: string | null;
  /** Only used by the overview block. */
  layout: Layout;
}

/** Older option names still accepted. */
const KEY_ALIASES: Record<string, string> = { audience: "with" };

/**
 * The block's `key: value` lines, with keys lower-cased. Blank lines and
 * `# comments` are skipped, and quotes around a value are dropped.
 */
export function readOptions(src: string, keys: readonly string[]): Map<string, string> | { error: string } {
  const options = new Map<string, string>();
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (line === "") continue;
    const m = /^([^:]+):(.*)$/.exec(line);
    if (m === null) return { error: `Expected "key: value", got "${line}".` };
    const typed = m[1].trim().toLowerCase();
    const key = KEY_ALIASES[typed] ?? typed;
    if (!keys.includes(key)) return { error: `Unknown option "${m[1].trim()}". Use ${keys.join(" or ")}.` };
    const value = m[2].trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    options.set(key, (quoted === null ? value : quoted[2]).trim());
  }
  return options;
}

export function parseBlockSource(src: string): BlockSpec | { error: string } {
  const options = readOptions(src, ["with", "layout"]);
  if ("error" in options) return options;
  const who = options.get("with") ?? "";
  const audience = who === "" ? null : who.toLowerCase() === ALL ? ALL : audienceName(who) || null;
  const layout = (options.get("layout") ?? "").toLowerCase();
  if (layout !== "" && layout !== "audience" && layout !== "items") {
    return { error: `Unknown layout "${options.get("layout")}". Use audience or items.` };
  }
  return { audience, layout: layout === "items" ? "items" : "audience" };
}

/** The block's audience: its own `with:`, else the audience note it sits in, else everyone. */
export function resolveAudience(spec: BlockSpec, noteAudience: string | null): string {
  return spec.audience ?? noteAudience ?? ALL;
}

export function headerText(scope: string, pending: number): string {
  return `${scope === ALL ? "Everyone" : scope} · ${pending} pending`;
}
