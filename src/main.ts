import { Notice, Plugin } from "obsidian";
import { createItem, editAudiences, shareItem } from "./actions.ts";
import { AgendaBlock } from "./block.ts";
import { NO_AUDIENCES } from "./core/audiences.ts";
import { isItem, readList } from "./core/item.ts";
import { localDate } from "./core/log.ts";
import { ItemIndex } from "./index.ts";
import { ItemModal } from "./modals.ts";
import { AgendaSettingTab, DEFAULT_SETTINGS, type AgendaSettings } from "./settings.ts";
import { ObsidianStore } from "./store.ts";

export default class TalkingPointsPlugin extends Plugin {
  settings: AgendaSettings = { ...DEFAULT_SETTINGS };
  index!: ItemIndex;
  store!: ObsidianStore;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new ObsidianStore(this.app);
    this.index = new ItemIndex(this.app);
    this.index.register(this);
    this.addSettingTab(new AgendaSettingTab(this.app, this));

    this.addCommand({ id: "agenda-new-item", name: "New agenda item", callback: () => this.newItem() });
    this.addCommand({
      id: "agenda-edit-audiences",
      name: "Edit audiences of this agenda item",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!file || !isItem(fm)) return false;
        if (!checking) this.editItem(file.path, readList((fm as Record<string, unknown>).pending));
        return true;
      },
    });

    this.registerMarkdownCodeBlockProcessor("agenda", (source, el, ctx) => {
      ctx.addChild(new AgendaBlock(el, this, source, ctx.sourcePath));
    });

    this.app.workspace.onLayoutReady(() => void this.index.build());
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as Partial<AgendaSettings>;
    // Earlier versions also kept an audience list here; it is ignored and dropped on the next save.
    this.settings = { folder: typeof data.folder === "string" ? data.folder : DEFAULT_SETTINGS.folder };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  today(): string {
    return localDate(new Date());
  }

  private newItem(): void {
    const audiences = this.index.activeAudiences();
    if (audiences.length === 0) {
      new Notice(NO_AUDIENCES);
      return;
    }
    // Run from a person's or a meeting's note, the item starts with that audience.
    const active = this.app.workspace.getActiveFile();
    const here = active === null ? null : this.index.audienceAt(active.path);
    new ItemModal(this.app, {
      mode: "create",
      audiences,
      known: this.index.knownAudiences(),
      checked: here !== null && here.active ? [here.name] : [],
      submit: async (v) => {
        await createItem(this.store, this.settings.folder, v.title, v.details, v.selected, this.today());
      },
    }).open();
  }

  private editItem(path: string, pending: string[]): void {
    new ItemModal(this.app, {
      mode: "edit",
      audiences: this.index.activeAudiences(),
      known: this.index.knownAudiences(),
      checked: pending,
      submit: (v) => editAudiences(this.store, path, v.selected, pending),
    }).open();
  }

  share(path: string, audience: string, outcome: string): Promise<boolean> {
    return shareItem(this.store, path, audience, outcome, this.today());
  }
}
