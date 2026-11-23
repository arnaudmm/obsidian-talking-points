import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../release-check.mjs", import.meta.url));

/** A fresh repo with one commit, on `branch`; runs the check there, as `npm version` does. */
function checkOn(branch: string): { status: number | null; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "release-check-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git("-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "--allow-empty", "-m", "x");
  const r = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
  return { status: r.status, stderr: r.stderr };
}

test("release-check passes on main", () => {
  assert.equal(checkOn("main").status, 0);
});

test("release-check stops npm version on any other branch, and says why", () => {
  const r = checkOn("build");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /on branch "build", not main/);
});
