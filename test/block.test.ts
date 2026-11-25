import { test } from "node:test";
import assert from "node:assert/strict";
import { headerText, parseBlockSource, resolveAudience } from "../src/core/block.ts";

test("with names the audience, as Name, [[Name]] or all, in any case", () => {
  assert.deepEqual(parseBlockSource("with: Daily"), { audience: "Daily", layout: "audience" });
  assert.deepEqual(parseBlockSource("With: [[People/Marc|Marc D.]]"), { audience: "Marc", layout: "audience" });
  assert.deepEqual(parseBlockSource("with: ALL\nlayout: Items"), { audience: "all", layout: "items" });
});

test("audience: still works, so blocks written before keep working", () => {
  assert.deepEqual(parseBlockSource("audience: daily"), { audience: "daily", layout: "audience" });
  assert.deepEqual(parseBlockSource("audience: all\nlayout: items"), { audience: "all", layout: "items" });
});

test("options take quotes and # comments, the same way as Open Threads' threads block", () => {
  assert.deepEqual(parseBlockSource("with: 'big team'   # the team\n# a comment line\nlayout: \"items\""), { audience: "big team", layout: "items" });
});

test("an empty block, or an empty with, leaves the audience to the note", () => {
  assert.deepEqual(parseBlockSource(""), { audience: null, layout: "audience" });
  assert.deepEqual(parseBlockSource("with:   "), { audience: null, layout: "audience" });
});

test("unknown options, values and lines are errors that list what works", () => {
  assert.deepEqual(parseBlockSource("with: all\nlayout: grid"), { error: 'Unknown layout "grid". Use audience or items.' });
  assert.deepEqual(parseBlockSource("colour: red"), { error: 'Unknown option "colour". Use with or layout.' });
  assert.deepEqual(parseBlockSource("just text"), { error: 'Expected "key: value", got "just text".' });
});

test("the audience is the block's own, else the note it is in, else everyone", () => {
  assert.equal(resolveAudience({ audience: "Bob", layout: "audience" }, "Marc"), "Bob");
  assert.equal(resolveAudience({ audience: null, layout: "audience" }, "Marc"), "Marc");
  assert.equal(resolveAudience({ audience: null, layout: "audience" }, null), "all");
  assert.equal(resolveAudience({ audience: "all", layout: "items" }, "Marc"), "all");
});

test("the header names who the block is about, as in Open Threads", () => {
  assert.equal(headerText("Marc", 3), "Marc · 3 pending");
  assert.equal(headerText("all", 5), "Everyone · 5 pending");
});
