// Run by `npm version <patch|minor|major>` (the "version" script in package.json),
// after npm has bumped package.json and before it commits and tags.
// Copies the new version into manifest.json and records, in versions.json, the
// minimum Obsidian version it needs (the community store reads both files).
import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.npm_package_version;
if (!version) {
  console.error("npm_package_version is not set: run this through `npm version`.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[version] = manifest.minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, 2) + "\n");
