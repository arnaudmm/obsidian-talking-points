// The capture / edit-audiences window, the audience picker and the outcome prompt.
import { FuzzySuggestModal, Modal, Notice, Platform, setIcon, type App } from "obsidian";
import { NO_AUDIENCES } from "./core/audiences.ts";

export interface ItemValues {
  title: string;
  details: string;
  selected: string[];
}

export interface ItemModalOptions {
  mode: "create" | "edit";
  /** Audiences to pick from (the active audience notes), sorted. */
  audiences: string[];
  /** Every audience note's name, inactive ones included. */
  known: string[];
  /** Audiences chosen when the window opens (create: the current note's; edit: the item's pending list). */
  checked: string[];
  submit: (values: ItemValues) => Promise<void>;
}

export class ItemModal extends Modal {
  private readonly opts: ItemModalOptions;
  private titleInput: HTMLInputElement | null = null;
  private detailsInput: HTMLTextAreaElement | null = null;
  private selected: string[] = [];
  private chips: HTMLElement | null = null;
  private saved = 0;
  private saving = false;
  private status: HTMLElement | null = null;

  constructor(app: App, opts: ItemModalOptions) {
    super(app);
    this.opts = opts;
  }

  onOpen(): void {
    const { contentEl, opts } = this;
    this.modalEl.addClass("agenda-modal");
    this.titleEl.setText(opts.mode === "create" ? "New agenda item" : "Edit audiences");

    if (opts.mode === "create") {
      this.titleInput = contentEl.createEl("input", { type: "text", cls: "agenda-title", attr: { placeholder: "What to share or discuss" } });
      this.detailsInput = contentEl.createEl("textarea", { cls: "agenda-details", attr: { placeholder: "Details (optional)", rows: "3" } });
    }

    // The same "With" field as Open Threads, with several audiences: one chip each, + to add.
    const row = contentEl.createDiv({ cls: "agenda-field" });
    row.createSpan({ cls: "agenda-label", text: "With" });
    this.chips = row.createDiv({ cls: "agenda-chips" });
    this.selected = [...opts.checked];
    this.renderChips();

    const footer = contentEl.createDiv({ cls: "agenda-footer" });
    this.status = footer.createSpan({ cls: "agenda-status" });
    const mod = Platform.isMacOS ? "⌘" : "Ctrl";
    if (opts.mode === "create") {
      const next = footer.createEl("button", { text: "Save & next" });
      next.title = `${mod}+Shift+Enter`;
      next.onclick = () => void this.save(true);
    }
    const save = footer.createEl("button", { text: "Save", cls: "mod-cta" });
    save.title = `${mod}+Enter`;
    save.onclick = () => void this.save(false);

    this.scope.register(["Mod"], "Enter", () => {
      void this.save(false);
      return false;
    });
    if (opts.mode === "create") {
      this.scope.register(["Mod", "Shift"], "Enter", () => {
        void this.save(true);
        return false;
      });
    }
    this.titleInput?.focus();
  }

  /** Chips for the chosen audiences, then the + button. An audience with no active note says why. */
  private renderChips(): void {
    const el = this.chips;
    if (el === null) return;
    el.empty();
    const { audiences, known } = this.opts;
    for (const name of this.selected) {
      const chip = el.createSpan({ cls: "agenda-chip" });
      chip.createSpan({ text: audiences.includes(name) ? name : `${name} (${known.includes(name) ? "inactive" : "no note"})` });
      const remove = chip.createSpan({ cls: "agenda-chip-remove", attr: { "aria-label": `Remove ${name}`, role: "button" } });
      setIcon(remove, "x");
      remove.onclick = () => {
        this.selected = this.selected.filter((n) => n !== name);
        this.renderChips();
      };
    }
    const add = el.createEl("button", { cls: "agenda-chip-add", attr: { "aria-label": "Add a person or meeting" } });
    setIcon(add, "plus");
    if (this.selected.length === 0) add.appendText(" Add a person or meeting");
    add.onclick = async () => {
      const choices = audiences.filter((n) => !this.selected.includes(n));
      if (choices.length === 0) {
        new Notice(audiences.length === 0 ? NO_AUDIENCES : "Every audience is already added.");
        return;
      }
      const name = await pickAudience(this.app, choices);
      if (name === undefined) return;
      this.selected = [...this.selected, name];
      this.renderChips();
    };
  }

  private values(): ItemValues {
    return {
      title: this.titleInput?.value ?? "",
      details: this.detailsInput?.value ?? "",
      selected: [...this.selected],
    };
  }

  private setFields(v: ItemValues): void {
    if (this.titleInput) this.titleInput.value = v.title;
    if (this.detailsInput) this.detailsInput.value = v.details;
    this.selected = [...v.selected];
    this.renderChips();
  }

  /** One save at a time (a double click or key repeat must not create the item twice). */
  private async save(next: boolean): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const values = this.values();
    // For "Save & next", clear at once so typing the next item isn't wiped by the save.
    // The audiences go back to those the window opened with (the current note's).
    if (next) this.setFields({ title: "", details: "", selected: [...this.opts.checked] });
    try {
      await this.opts.submit(values);
    } catch (e) {
      if (next) this.setFields(values);
      new Notice(e instanceof Error ? e.message : String(e));
      return;
    } finally {
      this.saving = false;
    }
    if (!next) {
      this.close();
      return;
    }
    this.saved++;
    this.status?.setText(`${this.saved} saved`);
    this.titleInput?.focus();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class AudienceModal extends FuzzySuggestModal<string> {
  private readonly names: string[];
  private readonly resolve: (v: string | undefined) => void;
  private chosen: string | undefined;

  constructor(app: App, names: string[], resolve: (v: string | undefined) => void) {
    super(app);
    this.names = names;
    this.resolve = resolve;
    this.setPlaceholder("Who is it for?");
  }

  getItems(): string[] {
    return this.names;
  }

  getItemText(name: string): string {
    return name;
  }

  onChooseItem(name: string): void {
    this.chosen = name;
  }

  onClose(): void {
    super.onClose();
    // onChooseItem runs after onClose in some Obsidian versions; wait a tick before resolving.
    window.setTimeout(() => this.resolve(this.chosen), 0);
  }
}

/** One audience from `names`, or undefined when dismissed. */
export function pickAudience(app: App, names: string[]): Promise<string | undefined> {
  return new Promise((resolve) => new AudienceModal(app, names, resolve).open());
}

const OUTCOME_PLACEHOLDER = "Outcome (optional) — Enter to save, Esc to cancel";

/** One-line text prompt. Resolves to the text (maybe ""), or null when cancelled. */
export class PromptModal extends Modal {
  private readonly heading: string;
  private readonly placeholder: string;
  private readonly initial: string;
  private resolve: (value: string | null) => void = () => {};
  private done = false;

  constructor(app: App, heading: string, placeholder: string, initial: string) {
    super(app);
    this.heading = heading;
    this.placeholder = placeholder;
    this.initial = initial;
  }

  static ask(app: App, heading: string, placeholder = OUTCOME_PLACEHOLDER, initial = ""): Promise<string | null> {
    const modal = new PromptModal(app, heading, placeholder, initial);
    const answer = new Promise<string | null>((resolve) => (modal.resolve = resolve));
    modal.open();
    return answer;
  }

  onOpen(): void {
    this.modalEl.addClass("agenda-modal");
    this.titleEl.setText(this.heading);
    const input = this.contentEl.createEl("input", {
      type: "text",
      cls: "agenda-outcome",
      attr: { placeholder: this.placeholder },
    });
    input.value = this.initial;
    input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.isComposing) return;
      ev.preventDefault();
      this.finish(input.value);
    });
    input.focus();
  }

  private finish(value: string | null): void {
    if (this.done) return;
    this.done = true;
    this.resolve(value);
    this.close();
  }

  onClose(): void {
    this.finish(null);
    this.contentEl.empty();
  }
}
