// The Store port (see actions.ts) implemented on the Obsidian vault.
import { normalizePath, TFile, TFolder, type App } from "obsidian";
import type { Store } from "./actions.ts";
import { caseInsensitiveLookup, isItem, type Frontmatter } from "./core/item.ts";

export class ObsidianStore implements Store {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  private file(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) throw new Error(`Note not found: ${path}`);
    return file;
  }

  /** Case-insensitive: on a Mac, "Budget.md" and "budget.md" are the same file. */
  private lookup(): (path: string) => string | undefined {
    return caseInsensitiveLookup(this.app.vault.getAllLoadedFiles().map((f) => f.path));
  }

  exists(path: string): boolean {
    return this.lookup()(normalizePath(path)) !== undefined;
  }

  async ensureFolder(path: string): Promise<string> {
    const lookup = this.lookup();
    let real = "";
    for (const part of normalizePath(path).split("/")) {
      const wanted = real === "" ? part : `${real}/${part}`;
      const found = lookup(wanted);
      if (found === undefined) {
        await this.app.vault.createFolder(wanted);
        real = wanted;
      } else if (!(this.app.vault.getAbstractFileByPath(found) instanceof TFolder)) {
        throw new Error(`"${found}" is a file, not a folder.`);
      } else {
        real = found;
      }
    }
    return real;
  }

  async create(path: string, content: string): Promise<void> {
    await this.app.vault.create(normalizePath(path), content);
  }

  async editFrontmatter(path: string, fn: (fm: Frontmatter) => void): Promise<void> {
    await this.app.fileManager.processFrontMatter(this.file(path), fn);
  }

  /** Writes only when the text changes, so untouched notes keep their modified date. */
  async editContent(path: string, fn: (content: string) => string): Promise<void> {
    const file = this.file(path);
    const current = await this.app.vault.read(file);
    if (fn(current) === current) return;
    await this.app.vault.process(file, fn);
  }

  itemPaths(): string[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => isItem(this.app.metadataCache.getFileCache(f)?.frontmatter))
      .map((f) => f.path);
  }

  frontmatter(path: string): Frontmatter | null {
    const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
    if (!(file instanceof TFile)) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    return fm === undefined ? null : structuredClone(fm as Frontmatter);
  }

  async notesContaining(text: string): Promise<string[]> {
    const paths: string[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if ((await this.app.vault.cachedRead(file)).includes(text)) paths.push(file.path);
    }
    return paths;
  }
}
