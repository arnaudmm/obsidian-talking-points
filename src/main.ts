import { Events, Notice, Plugin } from "obsidian";
import { createItem, editAudiences, renameAudience, shareItem, type RenameResult } from "./actions.ts";
import { AgendaBlock } from "./block.ts";
import { isItem, readList, renameInList } from "./core/item.ts";
import { localDate } from "./core/log.ts";
import { ItemIndex } from "./index.ts";
import { ItemModal } from "./modals.ts";
import { AgendaSettingTab, DEFAULT_SETTINGS, type AgendaSettings } from "./settings.ts";
import { ObsidianStore } from "./store.ts";

export default class AgendaPlugin extends Plugin {
  settings: AgendaSettings = { ...DEFAULT_SETTINGS };
  /** Emits "settings-changed" after every settings save. */
  events = new Events();
  index!: ItemIndex;
  store!: ObsidianStore;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new ObsidianStore(this.app);
    this.index = new ItemIndex(this.app);
    this.index.register(this);
    this.addSettingTab(new AgendaSettingTab(this.app, this));

    this.addCommand({ id: "agenda-new-item", name: "New item", callback: () => this.newItem() });
    this.addCommand({
      id: "agenda-edit-audiences",
      name: "Edit audiences of this item",
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
    console.log("agenda loaded");
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as Partial<AgendaSettings>;
    this.settings = {
      audiences: readList(data.audiences),
      folder: typeof data.folder === "string" ? data.folder : DEFAULT_SETTINGS.folder,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.events.trigger("settings-changed");
  }

  today(): string {
    return localDate(new Date());
  }

  private newItem(): void {
    if (this.settings.audiences.length === 0) {
      new Notice("Add audiences in Settings → Agenda first.");
      return;
    }
    new ItemModal(this.app, {
      mode: "create",
      audiences: this.settings.audiences,
      checked: [],
      submit: async (v) => {
        await createItem(this.store, this.settings.folder, v.title, v.details, v.selected, this.today());
      },
    }).open();
  }

  private editItem(path: string, pending: string[]): void {
    new ItemModal(this.app, {
      mode: "edit",
      audiences: this.settings.audiences,
      checked: pending,
      submit: (v) => editAudiences(this.store, path, v.selected, pending),
    }).open();
  }

  share(path: string, audience: string, outcome: string): Promise<boolean> {
    return shareItem(this.store, path, audience, outcome, this.today());
  }

  /**
   * Rename in the settings first, so blocks rewritten to the new name find it.
   * Throws when `from` is no longer in the settings (a rename already ran).
   */
  async renameAudience(from: string, to: string): Promise<RenameResult> {
    this.settings.audiences = renameInList(this.settings.audiences, from, to);
    await this.saveSettings();
    return renameAudience(this.store, from, to);
  }
}
