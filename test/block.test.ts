import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBlockSource, resolveAudience } from "../src/core/block.ts";

test("parseBlockSource reads the audience line", () => {
  assert.deepEqual(parseBlockSource("audience: daily"), { audience: "daily", all: false, layout: "audience" });
});

test("parseBlockSource accepts any key case, quotes, links and other lines", () => {
  assert.deepEqual(parseBlockSource("Audience:  'bob' \n other: x"), { audience: "bob", all: false, layout: "audience" });
  assert.deepEqual(parseBlockSource('audience: "big team"'), { audience: "big team", all: false, layout: "audience" });
  assert.deepEqual(parseBlockSource("audience: [[People/Marc|Marc]]"), { audience: "Marc", all: false, layout: "audience" });
});

test("parseBlockSource recognises the overview block in any case, with its layout", () => {
  assert.deepEqual(parseBlockSource("audience: All\nlayout: items"), { audience: "all", all: true, layout: "items" });
  assert.deepEqual(parseBlockSource("audience: ALL\n Layout:  Audience "), { audience: "all", all: true, layout: "audience" });
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

test("parseBlockSource with no audience line, or an empty one, leaves the audience to the note", () => {
  assert.deepEqual(parseBlockSource(""), { audience: null, all: false, layout: "audience" });
  assert.deepEqual(parseBlockSource("audience:   "), { audience: null, all: false, layout: "audience" });
});

test("resolveAudience: the block's line, else the note the block is in", () => {
  const spec = (src: string) => parseBlockSource(src) as Exclude<ReturnType<typeof parseBlockSource>, { error: string }>;
  assert.equal(resolveAudience(spec("audience: Bob"), "Marc"), "Bob");
  assert.equal(resolveAudience(spec(""), "Marc"), "Marc");
  assert.deepEqual(resolveAudience(spec(""), null), {
    error: 'Add "audience:" (e.g. `audience: Marc`), or put this block in a note with type: person or type: meeting.',
  });
});
