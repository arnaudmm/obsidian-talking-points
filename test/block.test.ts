import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlockSource, renameInBlocks, validateAudienceName } from "../src/core/block.ts";

test("parseBlockSource reads the audience line", () => {
  assert.deepEqual(parseBlockSource("audience: daily"), { audience: "daily", all: false, layout: "audience" });
});

test("parseBlockSource accepts any key case, quotes and other lines", () => {
  assert.deepEqual(parseBlockSource("Audience:  'bob' \n other: x"), { audience: "bob", all: false, layout: "audience" });
  assert.deepEqual(parseBlockSource('audience: "big team"'), { audience: "big team", all: false, layout: "audience" });
});

test("parseBlockSource recognises the overview block in any case, with its layout", () => {
  assert.deepEqual(parseBlockSource("audience: All\nlayout: items"), { audience: "all", all: true, layout: "items" });
  assert.deepEqual(parseBlockSource("audience: ALL\n Layout:  Audience "), { audience: "all", all: true, layout: "audience" });
});

test("parseBlockSource ignores layout: items on a single-audience block", () => {
  assert.deepEqual(parseBlockSource("audience: daily\nlayout: items"), { audience: "daily", all: false, layout: "audience" });
});

test("parseBlockSource ignores trailing # comments on both lines", () => {
  assert.deepEqual(parseBlockSource("audience: all\nlayout: items      # optional: a table"), { audience: "all", all: true, layout: "items" });
  assert.deepEqual(parseBlockSource("audience: daily # the team"), { audience: "daily", all: false, layout: "audience" });
});

test("parseBlockSource ignores any layout on a single-audience block, and an empty layout", () => {
  assert.deepEqual(parseBlockSource("audience: daily\nlayout: grid"), { audience: "daily", all: false, layout: "audience" });
  assert.deepEqual(parseBlockSource("audience: all\nlayout:"), { audience: "all", all: true, layout: "audience" });
});

test("parseBlockSource rejects an unknown layout", () => {
  assert.deepEqual(parseBlockSource("audience: all\nlayout: grid"), { error: 'Unknown layout "grid". Use "audience" or "items".' });
});

test("parseBlockSource reports a missing or empty audience line", () => {
  const error = 'Missing "audience:" line, e.g. `audience: daily`.';
  assert.deepEqual(parseBlockSource(""), { error });
  assert.deepEqual(parseBlockSource("audience:   "), { error });
});

test("renameInBlocks rewrites matching blocks and nothing else", () => {
  const note = [
    "audience: bob",
    "```agenda",
    "audience: bob",
    "```",
    "text",
    "~~~agenda",
    "  Audience: bob",
    "~~~",
    "```agenda",
    "audience: daily",
    "```",
    "```yaml",
    "audience: bob",
    "```",
  ].join("\n");
  const expected = note
    .split("\n")
    .map((l, i) => (i === 2 ? "audience: robert" : i === 6 ? "  Audience: robert" : l))
    .join("\n");
  assert.equal(renameInBlocks(note, "bob", "robert"), expected);
});

test("renameInBlocks only matches the whole audience name", () => {
  const note = "```agenda\naudience: bobby\n```\n";
  assert.equal(renameInBlocks(note, "bob", "robert"), note);
});

test("validateAudienceName rejects empty names and separators", () => {
  assert.equal(validateAudienceName("", []), "Name can't be empty.");
  assert.equal(validateAudienceName("   ", []), "Name can't be empty.");
  assert.equal(validateAudienceName("a,b", []), 'Name can\'t contain "," or "·".');
  assert.equal(validateAudienceName("a·b", []), 'Name can\'t contain "," or "·".');
  assert.equal(validateAudienceName("a\nb", []), 'Name can\'t contain "," or "·".');
});

test("validateAudienceName reserves all for the overview block", () => {
  assert.equal(validateAudienceName("ALL", []), '"all" is reserved for the overview block.');
  assert.equal(validateAudienceName(" all ", ["daily"], "daily"), '"all" is reserved for the overview block.');
});

test("validateAudienceName rejects case-insensitive duplicates", () => {
  assert.equal(validateAudienceName("Daily", ["daily"]), '"Daily" already exists.');
});

test("validateAudienceName allows a case-only rename", () => {
  assert.equal(validateAudienceName("Bob", ["bob", "daily"], "bob"), null);
  assert.equal(validateAudienceName("alice", ["bob"]), null);
});
