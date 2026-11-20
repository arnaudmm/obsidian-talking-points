import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../version-bump.mjs", import.meta.url));

/** Run the script the way `npm version` does: in the package folder, with npm_package_version set. */
function bump(version: string, manifest: object, versions: object): { manifest: any; versions: any } {
  const dir = mkdtempSync(join(tmpdir(), "bump-"));
  writeFileSync(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(dir, "versions.json"), JSON.stringify(versions, null, 2) + "\n");
  execFileSync(process.execPath, [script], { cwd: dir, env: { ...process.env, npm_package_version: version } });
  return {
    manifest: JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")),
    versions: JSON.parse(readFileSync(join(dir, "versions.json"), "utf8")),
  };
}

test("version-bump writes the new version into manifest.json and maps it in versions.json", () => {
  const out = bump("0.2.0", { id: "talking-points", version: "0.1.0", minAppVersion: "1.5.0" }, { "0.1.0": "1.5.0" });
  assert.equal(out.manifest.version, "0.2.0");
  assert.equal(out.manifest.id, "talking-points");
  assert.deepEqual(out.versions, { "0.1.0": "1.5.0", "0.2.0": "1.5.0" });
});

test("version-bump records the manifest's current minAppVersion for the new version", () => {
  const out = bump("1.0.0", { version: "0.2.0", minAppVersion: "1.7.2" }, { "0.2.0": "1.5.0" });
  assert.deepEqual(out.versions, { "0.2.0": "1.5.0", "1.0.0": "1.7.2" });
});

test("version-bump fails without npm_package_version", () => {
  assert.throws(() => bump("", { version: "0.1.0", minAppVersion: "1.5.0" }, {}));
});

test("repo files agree on the current version", () => {
  const read = (f: string) => JSON.parse(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"));
  const version = read("package.json").version;
  assert.equal(read("manifest.json").version, version);
  assert.equal(read("versions.json")[version], read("manifest.json").minAppVersion);
});
