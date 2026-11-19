import { test } from "node:test";
import assert from "node:assert/strict";
import { createItem, editAudiences, renameAudience, shareItem, type Store } from "../src/actions.ts";
import { isItem, type Frontmatter } from "../src/core/item.ts";

/** In-memory vault. Frontmatter and body are kept apart, as Obsidian's two edit APIs see them. */
class FakeStore implements Store {
  files = new Map<string, { fm: Frontmatter | null; body: string }>();
  folders: string[] = [];

  put(path: string, fm: Frontmatter | null, body: string): void {
    this.files.set(path, { fm, body });
  }
  exists(path: string): boolean {
    return this.files.has(path);
  }
  existingFolders: string[] = [];
  failOn = new Set<string>();
  async ensureFolder(path: string): Promise<string> {
    this.folders.push(path);
    return this.existingFolders.find((f) => f.toLowerCase() === path.toLowerCase()) ?? path;
  }
  async create(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`exists: ${path}`);
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);
    if (m === null) return this.put(path, null, content);
    const fm: Frontmatter = {};
    for (const line of m[1].split("\n")) {
      const [key, ...rest] = line.split(": ");
      const value = rest.join(": ");
      fm[key] = value.startsWith("[") ? JSON.parse(value) : value;
    }
    this.put(path, fm, m[2]);
  }
  async editFrontmatter(path: string, fn: (fm: Frontmatter) => void): Promise<void> {
    if (this.failOn.has(path)) throw new Error(`YAML error in ${path}`);
    const file = this.files.get(path);
    if (file === undefined) throw new Error(`missing: ${path}`);
    file.fm ??= {};
    fn(file.fm);
  }
  async editContent(path: string, fn: (content: string) => string): Promise<void> {
    const file = this.files.get(path);
    if (file === undefined) throw new Error(`missing: ${path}`);
    file.body = fn(file.body);
  }
  itemPaths(): string[] {
    return [...this.files].filter(([, f]) => isItem(f.fm)).map(([p]) => p);
  }
  frontmatter(path: string): Frontmatter | null {
    const fm = this.files.get(path)?.fm;
    return fm == null ? null : structuredClone(fm);
  }
  async notesContaining(text: string): Promise<string[]> {
    return [...this.files].filter(([, f]) => f.body.includes(text)).map(([p]) => p);
  }
}

test("createItem writes a note with every audience pending", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Plan", "details", ["daily", "bob"], "2026-11-19");
  assert.equal(path, "Agenda/Plan.md");
  const fm = store.frontmatter(path);
  assert.deepEqual(fm, { type: "agenda", created: "2026-11-19", audiences: ["daily", "bob"], pending: ["daily", "bob"] });
  assert.equal(store.files.get(path)?.body, "details\n\n## Log\n");
  assert.deepEqual(store.folders, ["Agenda"]);
});

test("createItem with the same title twice gets a numbered name", async () => {
  const store = new FakeStore();
  await createItem(store, "Agenda", "Plan", "", ["daily"], "2026-11-19");
  assert.equal(await createItem(store, "Agenda", "Plan", "", ["daily"], "2026-11-19"), "Agenda/Plan 2.md");
});

test("createItem rejects an empty title and an empty audience list", async () => {
  const store = new FakeStore();
  await assert.rejects(createItem(store, "Agenda", " /// ", "", ["daily"], "2026-11-19"), { message: "Title is empty." });
  await assert.rejects(createItem(store, "Agenda", "Plan", "", [], "2026-11-19"), { message: "Pick at least one audience." });
  assert.equal(store.files.size, 0);
});

test("createItem trims slashes from the folder and defaults it to Agenda", async () => {
  const store = new FakeStore();
  assert.equal(await createItem(store, "/Work/Agenda/", "Plan", "", ["daily"], "2026-11-19"), "Work/Agenda/Plan.md");
  assert.deepEqual(store.folders, ["Work/Agenda"]);
  assert.equal(await createItem(store, "  ", "Plan", "", ["daily"], "2026-11-19"), "Agenda/Plan.md");
});

test("shareItem ticks off one audience and logs the outcome", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Merge", "", ["biweekly", "daily"], "2026-11-19");
  assert.equal(await shareItem(store, path, "biweekly", "yes", "2026-11-20"), true);
  assert.deepEqual(store.frontmatter(path)?.pending, ["daily"]);
  assert.equal(store.files.get(path)?.body, "## Log\n- 2026-11-20 · biweekly · yes\n");
});

test("shareItem twice for the same audience changes nothing the second time", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Merge", "", ["biweekly"], "2026-11-19");
  await shareItem(store, path, "biweekly", "yes", "2026-11-20");
  assert.equal(await shareItem(store, path, "biweekly", "yes", "2026-11-20"), false);
  assert.equal(store.files.get(path)?.body, "## Log\n- 2026-11-20 · biweekly · yes\n");
});

test("editAudiences adds new audiences and drops unticked ones from pending only", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Plan", "", ["daily", "bob"], "2026-11-19");
  await editAudiences(store, path, ["daily", "alice"], ["daily", "bob"]);
  const fm = store.frontmatter(path);
  assert.deepEqual(fm?.audiences, ["daily", "bob", "alice"]);
  assert.deepEqual(fm?.pending, ["daily", "alice"]);
});

test("renameAudience rewrites items and blocks, and counts changed files", async () => {
  const store = new FakeStore();
  const item = await createItem(store, "Agenda", "Plan", "", ["bob", "daily"], "2026-11-19");
  store.put("People/Bob.md", null, "# Bob\n\n```agenda\naudience: bob\n```\n");
  store.put("Meetings/Daily.md", null, "agenda for today\n\n```agenda\naudience: daily\n```\n");
  assert.deepEqual(await renameAudience(store, "bob", "robert"), { changed: 2, failed: [] });
  assert.deepEqual(store.frontmatter(item)?.audiences, ["robert", "daily"]);
  assert.equal(store.files.get("People/Bob.md")?.body, "# Bob\n\n```agenda\naudience: robert\n```\n");
  assert.equal(store.files.get("Meetings/Daily.md")?.body, "agenda for today\n\n```agenda\naudience: daily\n```\n");
});

test("createItem uses the existing folder's case", async () => {
  const store = new FakeStore();
  store.existingFolders = ["Agenda"];
  assert.equal(await createItem(store, "agenda", "Plan", "", ["daily"], "2026-11-19"), "Agenda/Plan.md");
});

test("renameAudience also renames the audience in the items' Log", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Plan", "", ["bob", "daily"], "2026-11-19");
  await shareItem(store, path, "bob", "ok", "2026-11-20");
  await renameAudience(store, "bob", "robert");
  assert.equal(store.files.get(path)?.body, "## Log\n- 2026-11-20 · robert · ok\n");
});

test("renameAudience keeps going past a note that fails and reports it", async () => {
  const store = new FakeStore();
  const bad = await createItem(store, "Agenda", "Bad", "", ["bob"], "2026-11-19");
  const good = await createItem(store, "Agenda", "Good", "", ["bob"], "2026-11-19");
  store.failOn.add(bad);
  assert.deepEqual(await renameAudience(store, "bob", "robert"), { changed: 1, failed: [bad] });
  assert.deepEqual(store.frontmatter(good)?.pending, ["robert"]);
});

test("editAudiences applies only the window's changes to the live pending list", async () => {
  const store = new FakeStore();
  const path = await createItem(store, "Agenda", "Plan", "", ["daily", "bob"], "2026-11-19");
  await store.editFrontmatter(path, (fm) => {
    fm.pending = ["daily", "bob", "carol"];
  });
  await editAudiences(store, path, ["daily"], ["daily", "bob"]);
  assert.deepEqual(store.frontmatter(path)?.pending, ["daily", "carol"]);
});
