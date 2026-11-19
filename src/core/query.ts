// What a block shows: the items pending for an audience and those recently
// ticked off for it. Pure: no obsidian import.
import { addDays, daysBetween, type LogEntry } from "./log.ts";

export interface ItemRecord {
  path: string;
  title: string;
  created: string;
  audiences: string[];
  pending: string[];
  log: LogEntry[];
}

export interface DoneRow {
  item: ItemRecord;
  entry: LogEntry;
}

/** Oldest `created` first, undated last, then by path. */
function byAge(a: ItemRecord, b: ItemRecord): number {
  const key = (i: ItemRecord) => (i.created === "" ? "\uffff" : i.created);
  return key(a).localeCompare(key(b)) || a.path.localeCompare(b.path);
}

export function pendingFor(items: ItemRecord[], audience: string): ItemRecord[] {
  return items.filter((i) => i.pending.includes(audience)).sort(byAge);
}

/** Log entries of the last `days` days (today included), newest first; `audience` null means all. */
export function doneFor(items: ItemRecord[], audience: string | null, today: string, days = 30): DoneRow[] {
  const since = addDays(today, -(days - 1));
  const rows: DoneRow[] = [];
  for (const item of items) {
    for (const entry of item.log) {
      if ((audience === null || entry.audience === audience) && entry.date >= since) rows.push({ item, entry });
    }
  }
  return rows.sort((a, b) => b.entry.date.localeCompare(a.entry.date) || a.item.path.localeCompare(b.item.path));
}

export function pendingCount(items: ItemRecord[], audience: string): number {
  return items.filter((i) => i.pending.includes(audience)).length;
}

/** "today", "<n> d", or "" when `created` is missing or not a real date. A future date reads "today". */
export function ageLabel(created: string, today: string): string {
  const days = daysBetween(created, today);
  if (days === null) return "";
  return days <= 0 ? "today" : `${days} d`;
}

export interface AudienceColumn {
  audience: string;
  /** False when the audience is no longer in the settings. */
  known: boolean;
}

/** Audiences with something pending: those in the settings first, in their order, then the others alphabetically. */
export function overviewAudiences(items: ItemRecord[], known: string[]): AudienceColumn[] {
  const pending = new Set(items.flatMap((i) => i.pending));
  const columns = known.filter((a) => pending.has(a)).map((audience) => ({ audience, known: true }));
  const unknown = [...pending].filter((a) => !known.includes(a)).sort((a, b) => a.localeCompare(b));
  return [...columns, ...unknown.map((audience) => ({ audience, known: false }))];
}

export interface Group {
  column: AudienceColumn;
  items: ItemRecord[];
}

export function groupByAudience(items: ItemRecord[], known: string[]): Group[] {
  return overviewAudiences(items, known).map((column) => ({ column, items: pendingFor(items, column.audience) }));
}

export type Cell = "pending" | "done" | "none";

export interface MatrixRow {
  item: ItemRecord;
  cells: Cell[];
}

export function itemMatrix(items: ItemRecord[], known: string[]): { columns: AudienceColumn[]; rows: MatrixRow[] } {
  const columns = overviewAudiences(items, known);
  const rows = items
    .filter((i) => i.pending.length > 0)
    .sort(byAge)
    .map((item) => ({
      item,
      cells: columns.map(({ audience }): Cell =>
        item.pending.includes(audience) ? "pending" : item.log.some((e) => e.audience === audience) ? "done" : "none",
      ),
    }));
  return { columns, rows };
}

export function pendingItemCount(items: ItemRecord[]): number {
  return items.filter((i) => i.pending.length > 0).length;
}
