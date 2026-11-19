// The capture / edit-audiences window, the outcome prompt and a confirmation.
import { Modal, Notice, type App } from "obsidian";

export interface ItemValues {
  title: string;
  details: string;
  selected: string[];
}

export interface ItemModalOptions {
  mode: "create" | "edit";
  /** Audiences from the settings, in order. */
  audiences: string[];
  /** Boxes ticked when the window opens (edit: the item's pending list). */
  checked: string[];
  submit: (values: ItemValues) => Promise<void>;
}

export class ItemModal extends Modal {
  private readonly opts: ItemModalOptions;
  private titleInput: HTMLInputElement | null = null;
  private detailsInput: HTMLTextAreaElement | null = null;
  private boxes = new Map<string, HTMLInputElement>();
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

    // Audiences already on the item but no longer in the settings stay visible,
    // so saving the window never drops them silently.
    const names = [...opts.audiences, ...opts.checked.filter((n) => !opts.audiences.includes(n))];
    const list = contentEl.createDiv({ cls: "agenda-audiences" });
    for (const name of names) {
      const label = list.createEl("label", { cls: "agenda-audience" });
      const box = label.createEl("input", { type: "checkbox" });
      box.checked = opts.checked.includes(name);
      label.appendText(opts.audiences.includes(name) ? name : `${name} (not in settings)`);
      this.boxes.set(name, box);
    }

    const footer = contentEl.createDiv({ cls: "agenda-footer" });
    this.status = footer.createSpan({ cls: "agenda-status" });
    const mod = navigatorIsMac() ? "⌘" : "Ctrl";
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
    (this.titleInput ?? [...this.boxes.values()][0])?.focus();
  }

  private values(): ItemValues {
    return {
      title: this.titleInput?.value ?? "",
      details: this.detailsInput?.value ?? "",
      selected: [...this.boxes].filter(([, box]) => box.checked).map(([name]) => name),
    };
  }

  private setFields(v: ItemValues): void {
    if (this.titleInput) this.titleInput.value = v.title;
    if (this.detailsInput) this.detailsInput.value = v.details;
    for (const [name, box] of this.boxes) box.checked = v.selected.includes(name);
  }

  /** One save at a time (a double click or key repeat must not create the item twice). */
  private async save(next: boolean): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    const values = this.values();
    // For "Save & next", clear at once so typing the next item isn't wiped by the save.
    if (next) this.setFields({ title: "", details: "", selected: [] });
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

function navigatorIsMac(): boolean {
  return typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
}

/** One-line outcome prompt. Resolves to the text (maybe ""), or null when cancelled. */
export class OutcomeModal extends Modal {
  private readonly heading: string;
  private resolve: (value: string | null) => void = () => {};
  private done = false;

  constructor(app: App, heading: string) {
    super(app);
    this.heading = heading;
  }

  static ask(app: App, heading: string): Promise<string | null> {
    const modal = new OutcomeModal(app, heading);
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
      attr: { placeholder: "Outcome (optional) — Enter to save, Esc to cancel" },
    });
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

export class ConfirmModal extends Modal {
  private readonly message: string;
  private readonly confirmLabel: string;
  private resolve: (value: boolean) => void = () => {};
  private done = false;

  constructor(app: App, message: string, confirmLabel: string) {
    super(app);
    this.message = message;
    this.confirmLabel = confirmLabel;
  }

  static ask(app: App, message: string, confirmLabel = "Remove"): Promise<boolean> {
    const modal = new ConfirmModal(app, message, confirmLabel);
    const answer = new Promise<boolean>((resolve) => (modal.resolve = resolve));
    modal.open();
    return answer;
  }

  onOpen(): void {
    this.modalEl.addClass("agenda-modal");
    this.contentEl.createEl("p", { text: this.message });
    const footer = this.contentEl.createDiv({ cls: "agenda-footer" });
    footer.createEl("button", { text: "Cancel" }).onclick = () => this.finish(false);
    footer.createEl("button", { text: this.confirmLabel, cls: "mod-warning" }).onclick = () => this.finish(true);
  }

  private finish(value: boolean): void {
    if (this.done) return;
    this.done = true;
    this.resolve(value);
    this.close();
  }

  onClose(): void {
    this.finish(false);
    this.contentEl.empty();
  }
}
