// Renders an ```agenda block. With one audience: what is pending for it, a box
// to tick each item off, and the items ticked off in the last 30 days. With
// `audience: all`: everything pending, grouped by audience or as a table of
// items × audiences (`layout: items`).
import { MarkdownRenderChild, Notice } from "obsidian";
import { parseBlockSource, resolveAudience } from "./core/block.ts";
import {
  ageLabel,
  doneFor,
  groupByAudience,
  itemMatrix,
  pendingFor,
  pendingItemCount,
  type AudienceColumn,
  type ItemRecord,
} from "./core/query.ts";
import type TalkingPointsPlugin from "./main.ts";
import { PromptModal } from "./modals.ts";

const NO_NOTE = "(no note)";

export class AgendaBlock extends MarkdownRenderChild {
  private readonly plugin: TalkingPointsPlugin;
  private readonly source: string;
  private sourcePath: string;
  private showDone = false;

  constructor(containerEl: HTMLElement, plugin: TalkingPointsPlugin, source: string, sourcePath: string) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
    this.sourcePath = sourcePath;
  }

  onload(): void {
    this.registerEvent(this.plugin.index.on("updated", () => this.render()));
    // Follow the note this block is in, so a block with no audience line keeps its audience after a rename.
    this.registerEvent(
      this.plugin.app.vault.on("rename", (file, oldPath) => {
        if (oldPath === this.sourcePath) this.sourcePath = file.path;
      }),
    );
    this.render();
  }

  private render(): void {
    const el = this.containerEl;
    el.empty();
    el.addClass("agenda-block");

    const spec = parseBlockSource(this.source);
    if ("error" in spec) {
      el.createDiv({ cls: "agenda-error", text: spec.error });
      return;
    }
    const index = this.plugin.index;
    if (!index.ready) {
      el.createDiv({ cls: "agenda-muted", text: "Loading…" });
      return;
    }
    const audience = resolveAudience(spec, index.audienceAt(this.sourcePath)?.name ?? null);
    if (typeof audience !== "string") {
      el.createDiv({ cls: "agenda-error", text: audience.error });
      return;
    }
    if (!spec.all && !index.knownAudiences().includes(audience)) {
      el.createDiv({ cls: "agenda-error", text: `No note named "${audience}" has type: person or type: meeting.` });
      return;
    }

    const records = index.records();
    if (!spec.all) this.renderAudience(el, records, audience);
    else if (spec.layout === "items") this.renderTable(el, records);
    else this.renderGroups(el, records);
    this.renderDone(el, records, spec.all ? null : audience);
  }

  private renderAudience(el: HTMLElement, records: ItemRecord[], audience: string): void {
    const pending = pendingFor(records, audience);
    el.createDiv({ cls: "agenda-header", text: `Pending for ${audience} (${pending.length})` });
    if (pending.length === 0) el.createDiv({ cls: "agenda-muted", text: `Nothing pending for ${audience}.` });
    for (const item of pending) this.row(el, item, audience);
  }

  private renderGroups(el: HTMLElement, records: ItemRecord[]): void {
    el.createDiv({ cls: "agenda-header", text: `All pending (${pendingItemCount(records)} items)` });
    const groups = groupByAudience(records, this.plugin.index.knownAudiences());
    if (groups.length === 0) el.createDiv({ cls: "agenda-muted", text: "Nothing pending." });
    for (const { column, items } of groups) {
      el.createDiv({ cls: "agenda-group", text: `${columnName(column)} (${items.length})` });
      for (const item of items) this.row(el, item, column.audience);
    }
  }

  private renderTable(el: HTMLElement, records: ItemRecord[]): void {
    el.createDiv({ cls: "agenda-header", text: `All pending (${pendingItemCount(records)} items)` });
    const { columns, rows } = itemMatrix(records, this.plugin.index.knownAudiences());
    if (rows.length === 0) {
      el.createDiv({ cls: "agenda-muted", text: "Nothing pending." });
      return;
    }
    const table = el.createDiv({ cls: "agenda-table-wrap" }).createEl("table", { cls: "agenda-table" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th");
    for (const column of columns) {
      const th = head.createEl("th", { text: column.known ? column.audience : `${column.audience}*` });
      if (!column.known) th.title = `${column.audience} ${NO_NOTE}`;
    }
    head.createEl("th");

    const body = table.createEl("tbody");
    const today = this.plugin.today();
    for (const { item, cells } of rows) {
      const tr = body.createEl("tr");
      this.link(tr.createEl("td", { cls: "agenda-table-title" }), item.path, item.title);
      cells.forEach((cell, i) => {
        const td = tr.createEl("td");
        const audience = columns[i].audience;
        if (cell === "done") {
          td.createSpan({ cls: "agenda-cell-done", text: "✓", attr: { "aria-label": `${audience}: told` } });
        } else if (cell === "pending") {
          const button = td.createEl("button", { cls: "agenda-cell", text: "●", attr: { "aria-label": `Tick ${audience}` } });
          button.onclick = () => {
            button.disabled = true;
            void this.tick(item, audience, () => (button.disabled = false));
          };
        }
      });
      tr.createEl("td", { cls: "agenda-age", text: ageLabel(item.created, today) });
    }
  }

  /** One pending row: checkbox, title link, age. */
  private row(parent: HTMLElement, item: ItemRecord, audience: string): void {
    const row = parent.createDiv({ cls: "agenda-row" });
    const box = row.createEl("input", { type: "checkbox" });
    box.onchange = () => {
      if (!box.checked) return;
      box.disabled = true;
      void this.tick(item, audience, () => {
        box.checked = false;
        box.disabled = false;
      });
    };
    this.link(row, item.path, item.title);
    row.createSpan({ cls: "agenda-age", text: ageLabel(item.created, this.plugin.today()) });
  }

  /** `audience` null: every audience (the overview block). */
  private renderDone(el: HTMLElement, records: ItemRecord[], audience: string | null): void {
    const toggle = el.createEl("a", { cls: "agenda-toggle", text: this.showDone ? "Hide done" : "Show done (last 30 days)" });
    toggle.onclick = () => {
      this.showDone = !this.showDone;
      this.render();
    };
    if (!this.showDone) return;

    const rows = doneFor(records, audience, this.plugin.today());
    if (rows.length === 0) el.createDiv({ cls: "agenda-muted", text: "Nothing done in the last 30 days." });
    for (const { item, entry } of rows) {
      const row = el.createDiv({ cls: "agenda-done" });
      row.appendText(audience === null ? `${entry.date} · ${entry.audience} · ` : `${entry.date} · `);
      this.link(row, item.path, item.title);
      if (entry.outcome !== "") row.appendText(` · ${entry.outcome}`);
    }
  }

  private link(parent: HTMLElement, path: string, title: string): void {
    const a = parent.createEl("a", { cls: "internal-link", text: title, href: path });
    a.onclick = (ev) => {
      // Stop here, or Obsidian's own internal-link handler opens the note a second time.
      ev.preventDefault();
      ev.stopPropagation();
      void this.plugin.app.workspace.openLinkText(path, this.sourcePath, ev.ctrlKey || ev.metaKey);
    };
  }

  /** Ask for the outcome and tick the item off for one audience; `restore` resets the control on cancel or error. */
  private async tick(item: ItemRecord, audience: string, restore: () => void): Promise<void> {
    const outcome = await PromptModal.ask(this.plugin.app, `${item.title} → ${audience}`);
    if (outcome === null) {
      restore();
      return;
    }
    try {
      await this.plugin.share(item.path, audience, outcome);
    } catch (e) {
      new Notice(e instanceof Error ? e.message : String(e));
      restore();
    }
  }
}

function columnName(column: AudienceColumn): string {
  return column.known ? column.audience : `${column.audience} ${NO_NOTE}`;
}
