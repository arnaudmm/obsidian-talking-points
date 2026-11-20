// Copy the built plugin into a local vault, for testing while developing.
// Usage: OBSIDIAN_VAULT=/path/to/vault npm run deploy-locally   (builds first)
// Only manifest.json, main.js and styles.css are written; the plugin's
// data.json (its settings) is left alone.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const vault = process.env.OBSIDIAN_VAULT;
if (!vault) {
  console.error("Set OBSIDIAN_VAULT to the path of your Obsidian vault, e.g. OBSIDIAN_VAULT=~/Documents/MyVault npm run deploy-locally");
  process.exit(1);
}
if (!existsSync(join(vault, ".obsidian"))) {
  console.error(`${vault} has no .obsidian folder: OBSIDIAN_VAULT must point at an Obsidian vault.`);
  process.exit(1);
}

const { id } = JSON.parse(readFileSync("manifest.json", "utf8"));
const dir = join(vault, ".obsidian", "plugins", id);
mkdirSync(dir, { recursive: true });
for (const file of ["manifest.json", "main.js", "styles.css"]) copyFileSync(file, join(dir, file));
console.log(`Copied to ${dir}. Reload the plugin in Obsidian (turn it off and on).`);
