// In-memory index of every item note and every audience note (type: person or
// type: meeting), kept up to date from Obsidian's metadata cache. Blocks and
// the item window read from it; blocks re-render on its "updated" event.
import { Events, TFile, type App, type CachedMetadata, type Plugin } from "obsidian";
import { activeNames, allNames, toAudience, type Audience } from "./core/audiences.ts";
import { isItem, readList, type Frontmatter } from "./core/item.ts";
import { parseLog } from "./core/log.ts";
import type { ItemRecord } from "./core/query.ts";

export class ItemIndex extends Events {
  private items = new Map<string, ItemRecord>();
  private audiences = new Map<string, Audience>();
  ready = false;

  private readonly app: App;

  constructor(app: App) {
    super();
    this.app = app;
  }

  records(): ItemRecord[] {
    return [...this.items.values()];
  }

  /** Audiences to pick from (active ones), sorted. */
  activeAudiences(): string[] {
    return activeNames(this.audiences.values());
  }

  /** Every audience note's name, inactive ones included. */
  knownAudiences(): string[] {
    return allNames(this.audiences.values());
  }

  audienceAt(path: string): Audience | null {
    return this.audiences.get(path) ?? null;
  }

  register(plugin: Plugin): void {
    plugin.registerEvent(
      this.app.metadataCache.on("changed", (file, data, cache) => this.onChanged(file, data, cache)),
    );
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        const a = this.items.delete(file.path);
        const b = this.audiences.delete(file.path);
        if (a || b) this.trigger("updated");
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        let hit = false;
        const record = this.items.get(oldPath);
        if (record !== undefined) {
          this.items.delete(oldPath);
          this.items.set(file.path, { ...record, path: file.path, title: file.basename });
          hit = true;
        }
        const audience = this.audiences.get(oldPath);
        if (audience !== undefined) {
          this.audiences.delete(oldPath);
          this.audiences.set(file.path, { ...audience, path: file.path, name: file.basename });
          hit = true;
        }
        if (hit) this.trigger("updated");
      }),
    );
  }

  async build(): Promise<void> {
    this.items.clear();
    this.audiences.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const audience = toAudience(file.path, file.basename, fm);
      if (audience !== null) this.audiences.set(file.path, audience);
      if (!isItem(fm)) continue;
      const content = await this.app.vault.cachedRead(file);
      this.items.set(file.path, toRecord(file, fm as Frontmatter, content));
    }
    this.ready = true;
    this.trigger("updated");
  }

  private onChanged(file: TFile, data: string, cache: CachedMetadata): void {
    const fm = cache.frontmatter;
    let hit = false;
    if (isItem(fm)) {
      this.items.set(file.path, toRecord(file, fm as Frontmatter, data));
      hit = true;
    } else if (this.items.delete(file.path)) {
      hit = true;
    }
    const audience = toAudience(file.path, file.basename, fm);
    if (audience !== null) {
      this.audiences.set(file.path, audience);
      hit = true;
    } else if (this.audiences.delete(file.path)) {
      hit = true;
    }
    if (hit) this.trigger("updated");
  }
}

function toRecord(file: TFile, fm: Frontmatter, content: string): ItemRecord {
  return {
    path: file.path,
    title: file.basename,
    created: typeof fm.created === "string" ? fm.created.trim() : "",
    audiences: readList(fm.audiences),
    pending: readList(fm.pending),
    log: parseLog(content),
  };
}
