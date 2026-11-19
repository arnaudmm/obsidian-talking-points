// In-memory index of every item note, kept up to date from Obsidian's
// metadata cache. Blocks read from it and re-render on its "updated" event.
import { Events, TFile, type App, type CachedMetadata, type Plugin } from "obsidian";
import { isItem, readList, type Frontmatter } from "./core/item.ts";
import { parseLog } from "./core/log.ts";
import type { ItemRecord } from "./core/query.ts";

export class ItemIndex extends Events {
  private items = new Map<string, ItemRecord>();
  ready = false;

  private readonly app: App;

  constructor(app: App) {
    super();
    this.app = app;
  }

  records(): ItemRecord[] {
    return [...this.items.values()];
  }

  register(plugin: Plugin): void {
    plugin.registerEvent(
      this.app.metadataCache.on("changed", (file, data, cache) => this.onChanged(file, data, cache)),
    );
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.items.delete(file.path)) this.trigger("updated");
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        const record = this.items.get(oldPath);
        if (record === undefined || !(file instanceof TFile)) return;
        this.items.delete(oldPath);
        this.items.set(file.path, { ...record, path: file.path, title: file.basename });
        this.trigger("updated");
      }),
    );
  }

  async build(): Promise<void> {
    this.items.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isItem(fm)) continue;
      const content = await this.app.vault.cachedRead(file);
      this.items.set(file.path, toRecord(file, fm as Frontmatter, content));
    }
    this.ready = true;
    this.trigger("updated");
  }

  private onChanged(file: TFile, data: string, cache: CachedMetadata): void {
    if (isItem(cache.frontmatter)) {
      this.items.set(file.path, toRecord(file, cache.frontmatter as Frontmatter, data));
    } else if (!this.items.delete(file.path)) {
      return;
    }
    this.trigger("updated");
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
