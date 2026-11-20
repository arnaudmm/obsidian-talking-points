// Settings: the fixed list of audiences (people and meetings) and the folder
// new items go in. Stored in the plugin's data.json, never in the repo.
import { Notice, PluginSettingTab, Setting, type App } from "obsidian";
import { DEFAULT_FOLDER } from "./actions.ts";
import { validateAudienceName } from "./core/block.ts";
import { pendingCount } from "./core/query.ts";
import type TalkingPointsPlugin from "./main.ts";
import { ConfirmModal } from "./modals.ts";

export interface AgendaSettings {
  audiences: string[];
  folder: string;
}

export const DEFAULT_SETTINGS: AgendaSettings = { audiences: [], folder: DEFAULT_FOLDER };

export class AgendaSettingTab extends PluginSettingTab {
  private readonly plugin: TalkingPointsPlugin;
  /** True while a rename, move or removal runs: the rows are stale until redrawn. */
  private busy = false;

  constructor(app: App, plugin: TalkingPointsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl, plugin } = this;
    containerEl.empty();
    const audiences = plugin.settings.audiences;

    new Setting(containerEl)
      .setName("Audiences")
      .setDesc("People and meetings you raise items with. Renaming one updates your item notes and agenda blocks.")
      .setHeading();

    audiences.forEach((name, i) => {
      new Setting(containerEl)
        .addText((text) => {
          text.setValue(name);
          text.inputEl.addEventListener("change", () => void this.rename(name, text.getValue(), () => text.setValue(name)));
        })
        .addExtraButton((b) =>
          b.setIcon("arrow-up").setTooltip("Move up").setDisabled(i === 0).onClick(() => void this.move(i, -1)),
        )
        .addExtraButton((b) =>
          b.setIcon("arrow-down").setTooltip("Move down").setDisabled(i === audiences.length - 1).onClick(() => void this.move(i, 1)),
        )
        .addExtraButton((b) => b.setIcon("trash").setTooltip("Remove").onClick(() => void this.remove(name)));
    });

    let draft = "";
    const add = async () => {
      const error = validateAudienceName(draft, plugin.settings.audiences);
      if (error !== null) {
        new Notice(error);
        return;
      }
      plugin.settings.audiences.push(draft.trim());
      await plugin.saveSettings();
      this.display();
    };
    new Setting(containerEl)
      .addText((text) => {
        text.setPlaceholder("New audience, e.g. daily").onChange((v) => (draft = v));
        text.inputEl.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") void add();
        });
      })
      .addButton((b) => b.setButtonText("Add").setCta().onClick(() => void add()));

    new Setting(containerEl).setName("Items").setHeading();
    new Setting(containerEl)
      .setName("Item folder")
      .setDesc("Where new items are created. Items are found by their type property, wherever they are.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_FOLDER)
          .setValue(plugin.settings.folder)
          .onChange(async (v) => {
            plugin.settings.folder = v.trim();
            await plugin.saveSettings();
          }),
      );
  }

  /** Run one change at a time, then redraw so no row keeps a stale name. */
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
      this.display();
    }
  }

  private async rename(from: string, value: string, restore: () => void): Promise<void> {
    const to = value.trim();
    if (to === from) return;
    const error = validateAudienceName(to, this.plugin.settings.audiences, from);
    if (error !== null) {
      new Notice(error);
      restore();
      return;
    }
    await this.exclusive(async () => {
      const { changed, failed } = await this.plugin.renameAudience(from, to);
      const failures = failed.length === 0 ? "" : ` Couldn't update ${failed.length}: ${failed.join(", ")}. Fix them by hand.`;
      new Notice(`Renamed in ${changed} file(s).${failures}`, failed.length === 0 ? undefined : 0);
    });
  }

  private async move(i: number, delta: number): Promise<void> {
    await this.exclusive(async () => {
      const list = this.plugin.settings.audiences;
      const j = i + delta;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await this.plugin.saveSettings();
    });
  }

  private async remove(name: string): Promise<void> {
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
