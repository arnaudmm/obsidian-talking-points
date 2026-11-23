// Settings: only the folder new items go in. Stored in the plugin's data.json.
// Audiences are not stored here: they are the notes with type: person or
// type: meeting. Declared with Obsidian's settings definitions (1.13+), so they
// appear in the settings search.
import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_FOLDER } from "./actions.ts";
import type TalkingPointsPlugin from "./main.ts";

export interface AgendaSettings {
  folder: string;
}

export const DEFAULT_SETTINGS: AgendaSettings = { folder: DEFAULT_FOLDER };

export class AgendaSettingTab extends PluginSettingTab {
  private readonly plugin: TalkingPointsPlugin;

  constructor(app: App, plugin: TalkingPointsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
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
}
