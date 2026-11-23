// Every write the plugin makes, written against a small Store port so the
// logic runs in Node tests. The Obsidian side implements Store in store.ts.
import { markShared, newItemProps, renderItemNote, sanitizeTitle, setPending, uniquePath, type Frontmatter } from "./core/item.ts";
import { appendLogLine, formatLogLine } from "./core/log.ts";

export interface Store {
  exists(path: string): boolean;
  /** Create the folder if needed; returns its real path (an existing folder's case wins). */
  ensureFolder(path: string): Promise<string>;
  create(path: string, content: string): Promise<void>;
  /** Edit the note's properties in place (Obsidian: processFrontMatter). */
  editFrontmatter(path: string, fn: (fm: Frontmatter) => void): Promise<void>;
  /** Rewrite the note's text (Obsidian: vault.process). */
  editContent(path: string, fn: (content: string) => string): Promise<void>;
}

export const DEFAULT_FOLDER = "Agenda";

export async function createItem(
  store: Store,
  folder: string,
  title: string,
  details: string,
  audiences: string[],
  today: string,
): Promise<string> {
  const base = sanitizeTitle(title);
  if (base === "") throw new Error("Title is empty.");
  if (audiences.length === 0) throw new Error("Pick at least one audience.");
  const dir = folder.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_FOLDER;
  const realDir = await store.ensureFolder(dir);
  const path = uniquePath(realDir, base, (p) => store.exists(p));
  await store.create(path, renderItemNote(newItemProps(audiences, today), details));
  return path;
}

export async function shareItem(store: Store, path: string, audience: string, outcome: string, today: string): Promise<boolean> {
  let wasPending = false;
  await store.editFrontmatter(path, (fm) => {
    wasPending = markShared(fm, audience);
  });
  if (!wasPending) return false;
  const line = formatLogLine({ date: today, audience, outcome });
  await store.editContent(path, (content) => appendLogLine(content, line));
  return true;
}

/** `initial` is what the edit window showed ticked; only the changes made in the window are applied. */
export async function editAudiences(store: Store, path: string, selected: string[], initial: string[]): Promise<void> {
  await store.editFrontmatter(path, (fm) => setPending(fm, selected, initial));
}
