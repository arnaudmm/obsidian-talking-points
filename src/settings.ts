// Settings: the fixed list of audiences (people and meetings) and the folder
// new items go in. Stored in the plugin's data.json, never in the repo.
// Declared with Obsidian's settings definitions (1.13+), so they appear in the
// settings search.
import { Notice, PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_FOLDER } from "./actions.ts";
import { validateAudienceName } from "./core/block.ts";
import { pendingCount } from "./core/query.ts";
import type TalkingPointsPlugin from "./main.ts";
import { ConfirmModal, PromptModal } from "./modals.ts";

export interface AgendaSettings {
  audiences: string[];
  folder: string;
}

export const DEFAULT_SETTINGS: AgendaSettings = { audiences: [], folder: DEFAULT_FOLDER };

export class AgendaSettingTab extends PluginSettingTab {
  private readonly plugin: TalkingPointsPlugin;
  /** True while a change to the audience list runs. */
  private busy = false;

  constructor(app: App, plugin: TalkingPointsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const audiences = this.plugin.settings.audiences;
    return [
      {
        type: "list",
        heading: "Audiences",
        emptyState: "No audiences yet. Add the people and meetings you raise agenda items with.",
        addItem: { name: "Add audience", action: () => void this.add() },
        onReorder: (from, to) => void this.reorder(from, to),
        onDelete: (index) => void this.remove(audiences[index]),
        items: audiences.map((name) => ({
          name,
          desc: "Renaming updates the item notes, their logs and the agenda blocks.",
          render: (setting) => {
            setting.addExtraButton((b) =>
              b.setIcon("pencil").setTooltip("Rename").onClick(() => void this.rename(name)),
            );
          },
        })),
      },
      {
        type: "group",
        heading: "Items",
        items: [
          {
            name: "Item folder",
            desc: "Where new items are created. Items are found by their type property, wherever they are.",
            control: { type: "folder", key: "folder", placeholder: DEFAULT_FOLDER },
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return key === "folder" ? this.plugin.settings.folder : undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key !== "folder") return;
    this.plugin.settings.folder = typeof value === "string" ? value.trim() : DEFAULT_FOLDER;
    await this.plugin.saveSettings();
  }

  /** Run one change to the audience list at a time, then rebuild the list. */
  private async exclusive(job: () => Promise<void>): Promise<void> {
    if (this.busy) {
      new Notice("Wait for the current change to finish.");
      return;
    }
    this.busy = true;
    try {
      await job();
    } catch (e) {
      new Notice(e instanceof Error ? e.message : String(e));
    } finally {
      this.busy = false;
      this.update();
    }
  }

  private async add(): Promise<void> {
    const name = await PromptModal.ask(this.app, "Add audience", "Name, e.g. daily — Enter to add, Esc to cancel");
    if (name === null) return;
    await this.exclusive(async () => {
      const error = validateAudienceName(name, this.plugin.settings.audiences);
      if (error !== null) throw new Error(error);
      this.plugin.settings.audiences.push(name.trim());
      await this.plugin.saveSettings();
    });
  }

  private async rename(from: string): Promise<void> {
    const value = await PromptModal.ask(this.app, `Rename "${from}"`, "New name — Enter to rename, Esc to cancel", from);
    if (value === null || value.trim() === from) return;
    await this.exclusive(async () => {
      const to = value.trim();
      const error = validateAudienceName(to, this.plugin.settings.audiences, from);
      if (error !== null) throw new Error(error);
      const { changed, failed } = await this.plugin.renameAudience(from, to);
      const failures = failed.length === 0 ? "" : ` Couldn't update ${failed.length}: ${failed.join(", ")}. Fix them by hand.`;
      new Notice(`Renamed in ${changed} file(s).${failures}`, failed.length === 0 ? undefined : 0);
    });
  }

  private async reorder(from: number, to: number): Promise<void> {
    await this.exclusive(async () => {
      const list = this.plugin.settings.audiences;
      if (from < 0 || from >= list.length || to < 0 || to >= list.length) return;
      const [name] = list.splice(from, 1);
      list.splice(to, 0, name);
      await this.plugin.saveSettings();
    });
  }

  private async remove(name: string | undefined): Promise<void> {
    if (name === undefined) return;
    await this.exclusive(async () => {
      const n = pendingCount(this.plugin.index.records(), name);
      if (n > 0) {
        const message = `"${name}" still has ${n} pending item(s). Remove it from the list anyway? Item notes are not changed.`;
        if (!(await ConfirmModal.ask(this.app, message))) return;
      }
      this.plugin.settings.audiences = this.plugin.settings.audiences.filter((a) => a !== name);
      await this.plugin.saveSettings();
    });
  }
}
