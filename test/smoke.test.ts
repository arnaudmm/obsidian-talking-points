import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("manifest declares the Talking Points plugin", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.id, "talking-points");
  assert.equal(manifest.name, "Talking Points");
  assert.equal(manifest.minAppVersion, "1.5.0");
  assert.doesNotMatch(manifest.id, /obsidian/i);
});
