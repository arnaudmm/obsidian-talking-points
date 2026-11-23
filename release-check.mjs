// Run by `npm version` (the "preversion" script in package.json) before it
// changes anything: releases are cut from main only, after the pull request
// is merged, so a tag never points at a branch commit.
import { execFileSync } from "node:child_process";

const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
if (branch !== "main") {
  console.error(`You are on branch "${branch || "(detached HEAD)"}", not main. Merge first, then: git checkout main && git pull && npm version <patch|minor|major>`);
  process.exit(1);
}
