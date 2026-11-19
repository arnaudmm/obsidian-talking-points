// The "## Log" section of an item note: one line per audience ticked off,
// "- YYYY-MM-DD · audience" plus " · outcome" when one was given. Pure.

export interface LogEntry {
  date: string;
  audience: string;
  outcome: string;
}

const SEP = " · ";
const LOG_HEADING = /^##\s+Log\s*$/;
const SECTION_END = /^#{1,2}\s/;
const ENTRY = /^- (\d{4}-\d{2}-\d{2}) · (.+)$/;

export function formatLogLine(e: LogEntry): string {
  const outcome = e.outcome.replace(/\s*[\r\n]+\s*/g, " ").trim();
  return `- ${e.date}${SEP}${e.audience}${outcome === "" ? "" : `${SEP}${outcome}`}`;
}

/** The index of the "## Log" heading and the end (exclusive) of its section, or null. */
function logSection(lines: string[]): { heading: number; end: number } | null {
  const heading = lines.findIndex((l) => LOG_HEADING.test(l));
  if (heading === -1) return null;
  let end = lines.length;
  for (let i = heading + 1; i < lines.length; i++) {
    if (SECTION_END.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { heading, end };
}

export function appendLogLine(content: string, line: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(eol);
  const section = logSection(lines);
  if (section === null) {
    const head = content.replace(/\s+$/, "");
    return `${head === "" ? "" : `${head}${eol}${eol}`}## Log${eol}${line}${eol}`;
  }
  let at = section.heading + 1;
  for (let i = section.end - 1; i > section.heading; i--) {
    if (lines[i].trim() !== "") {
      at = i + 1;
      break;
    }
  }
  lines.splice(at, 0, line);
  if (at === lines.length - 1) lines.push("");
  return lines.join(eol);
}

export function parseLog(content: string): LogEntry[] {
  const lines = content.split(/\r?\n/);
  const section = logSection(lines);
  if (section === null) return [];
  const entries: LogEntry[] = [];
  for (let i = section.heading + 1; i < section.end; i++) {
    const m = ENTRY.exec(lines[i].trimEnd());
    if (m === null) continue;
    const rest = m[2];
    const cut = rest.indexOf(SEP);
    const audience = (cut === -1 ? rest : rest.slice(0, cut)).trim();
    if (audience === "") continue;
    entries.push({ date: m[1], audience, outcome: cut === -1 ? "" : rest.slice(cut + SEP.length).trim() });
  }
  return entries;
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The local calendar date as YYYY-MM-DD (toISOString would give the UTC date). */
export function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Rename the audience field of the Log entries; outcomes and other lines are kept. */
export function renameInLog(content: string, from: string, to: string): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(eol);
  const section = logSection(lines);
  if (section === null) return content;
  for (let i = section.heading + 1; i < section.end; i++) {
    const m = ENTRY.exec(lines[i]);
    if (m === null) continue;
    const rest = m[2];
    const cut = rest.indexOf(SEP);
    const audience = cut === -1 ? rest : rest.slice(0, cut);
    if (audience.trim() !== from) continue;
    lines[i] = `- ${m[1]}${SEP}${to}${cut === -1 ? "" : rest.slice(cut)}`;
  }
  return lines.join(eol);
}

function parseIsoDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (m === null) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Round-trip, so 2026-13-45 or 2026-02-30 are rejected instead of rolled over.
  return new Date(t).toISOString().slice(0, 10) === iso ? t : null;
}

/** Calendar days from `from` to `to`, or null when either is not a real YYYY-MM-DD date. */
export function daysBetween(from: string, to: string): number | null {
  const a = parseIsoDate(from);
  const b = parseIsoDate(to);
  return a === null || b === null ? null : Math.round((b - a) / 86_400_000);
}
