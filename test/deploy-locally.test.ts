import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../deploy-locally.mjs", import.meta.url));
const repo = fileURLToPath(new URL("..", import.meta.url));

function run(vault: string | undefined) {
  const env = { ...process.env };
  if (vault === undefined) delete env.OBSIDIAN_VAULT;
  else env.OBSIDIAN_VAULT = vault;
  return spawnSync(process.execPath, [script], { cwd: repo, env, encoding: "utf8" });
}

function vault(): string {
  const dir = mkdtempSync(join(tmpdir(), "vault-"));
  mkdirSync(join(dir, ".obsidian"));
  return dir;
}

test("deploy-locally copies the plugin files into the vault's plugin folder, creating it", () => {
  if (!existsSync(join(repo, "main.js"))) writeFileSync(join(repo, "main.js"), "// test build\n");
  const v = vault();
  const r = run(v);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(v, ".obsidian", "plugins", "talking-points");
  for (const f of ["manifest.json", "main.js", "styles.css"]) {
    assert.equal(readFileSync(join(dir, f), "utf8"), readFileSync(join(repo, f), "utf8"));
  }
});

test("deploy-locally keeps the plugin's data.json (the settings)", () => {
  const v = vault();
  const dir = join(v, ".obsidian", "plugins", "talking-points");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "data.json"), '{"audiences":["daily"]}');
  assert.equal(run(v).status, 0);
  assert.equal(readFileSync(join(dir, "data.json"), "utf8"), '{"audiences":["daily"]}');
});

test("deploy-locally refuses without OBSIDIAN_VAULT or when it is not a vault", () => {
  const unset = run(undefined);
  assert.notEqual(unset.status, 0);
  assert.match(unset.stderr, /OBSIDIAN_VAULT/);
  const notVault = run(mkdtempSync(join(tmpdir(), "novault-")));
  assert.notEqual(notVault.status, 0);
  assert.match(notVault.stderr, /\.obsidian/);
});
