import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audienceName,
  caseInsensitiveLookup,
  isItem,
  markShared,
  newItemProps,
  readList,
  renderItemNote,
  sanitizeTitle,
  setPending,
  uniquePath,
  type Frontmatter,
} from "../src/core/item.ts";

test("readList keeps non-empty trimmed strings from an array", () => {
  assert.deepEqual(readList(["daily", " bob ", ""]), ["daily", "bob"]);
});

test("readList turns a plain string into a one-element list", () => {
  assert.deepEqual(readList("daily"), ["daily"]);
});

test("readList returns [] for anything that is not a list or a string", () => {
  for (const v of [null, undefined, "", 42, {}]) assert.deepEqual(readList(v), []);
});

test("readList removes duplicates and non-strings", () => {
  assert.deepEqual(readList(["a", "a", "b"]), ["a", "b"]);
  assert.deepEqual(readList([1, "x"]), ["x"]);
});

test("isItem is true only for an object with type agenda", () => {
  assert.equal(isItem({ type: "agenda" }), true);
  assert.equal(isItem({ type: "note" }), false);
  assert.equal(isItem(null), false);
  assert.equal(isItem("agenda"), false);
});

test("renderItemNote writes properties, details and an empty Log section", () => {
  const note = renderItemNote(newItemProps(["daily", "bob"], "2026-11-19"), "Some details");
  assert.equal(
    note,
    '---\ntype: agenda\ncreated: 2026-11-19\naudiences: ["[[daily]]", "[[bob]]"]\npending: ["[[daily]]", "[[bob]]"]\n---\nSome details\n\n## Log\n',
  );
});

test("renderItemNote with empty details puts the Log heading right after the properties", () => {
  const note = renderItemNote(newItemProps(["daily"], "2026-11-19"), "  ");
  assert.equal(note, '---\ntype: agenda\ncreated: 2026-11-19\naudiences: ["[[daily]]"]\npending: ["[[daily]]"]\n---\n## Log\n');
});

test("newItemProps copies audiences into pending, not by reference", () => {
  const props = newItemProps(["daily"], "2026-11-19");
  props.pending.pop();
  assert.deepEqual(props.audiences, ["daily"]);
});

test("markShared removes a pending audience and reports it", () => {
  const fm: Frontmatter = { pending: ["daily", "bob"] };
  assert.equal(markShared(fm, "daily"), true);
  assert.deepEqual(fm.pending, ["[[bob]]"]);
  assert.equal(markShared(fm, "daily"), false);
  assert.deepEqual(fm.pending, ["[[bob]]"]);
});

test("markShared handles pending written by hand as a plain string", () => {
  const fm: Frontmatter = { pending: "daily" };
  assert.equal(markShared(fm, "daily"), true);
  assert.deepEqual(fm.pending, []);
});

test("setPending replaces pending and only ever grows audiences", () => {
  const fm: Frontmatter = { audiences: ["daily", "bob"], pending: ["bob"] };
  setPending(fm, ["daily", "alice"]);
  assert.deepEqual(fm.audiences, ["[[daily]]", "[[bob]]", "[[alice]]"]);
  assert.deepEqual(fm.pending, ["[[daily]]", "[[alice]]"]);
});

test("sanitizeTitle removes characters that are illegal in file names", () => {
  assert.equal(sanitizeTitle("Q4: plan/budget? [draft] #x"), "Q4 planbudget draft x");
  assert.equal(sanitizeTitle("..hidden"), "hidden");
  assert.equal(sanitizeTitle("///"), "");
  assert.equal(sanitizeTitle("a".repeat(150)).length, 100);
});

test("uniquePath appends a counter when the name is taken", () => {
  assert.equal(uniquePath("Agenda", "Plan", (p) => p === "Agenda/Plan.md"), "Agenda/Plan 2.md");
  const taken = new Set(["Agenda/Plan.md", "Agenda/Plan 2.md"]);
  assert.equal(uniquePath("Agenda", "Plan", (p) => taken.has(p)), "Agenda/Plan 3.md");
  assert.equal(uniquePath("Agenda", "Plan", () => false), "Agenda/Plan.md");
});

test("caseInsensitiveLookup finds an existing path whatever its case", () => {
  const lookup = caseInsensitiveLookup(["Agenda", "Agenda/budget.md"]);
  assert.equal(lookup("Agenda/Budget.md"), "Agenda/budget.md");
  assert.equal(lookup("agenda"), "Agenda");
  assert.equal(lookup("Agenda/Other.md"), undefined);
});

test("uniquePath with a case-insensitive check avoids a name that differs only in case", () => {
  const lookup = caseInsensitiveLookup(["Agenda/budget.md"]);
  assert.equal(uniquePath("Agenda", "Budget", (p) => lookup(p) !== undefined), "Agenda/Budget 2.md");
});


test("setPending with the initial list applies only what was changed in the window", () => {
  // The window opened with [daily, bob]; meanwhile carol was added by hand.
  const fm: Frontmatter = { audiences: ["daily", "bob", "carol"], pending: ["daily", "bob", "carol"] };
  setPending(fm, ["daily", "alice"], ["daily", "bob"]);
  assert.deepEqual(fm.pending, ["[[daily]]", "[[carol]]", "[[alice]]"]);
  assert.deepEqual(fm.audiences, ["[[daily]]", "[[bob]]", "[[carol]]", "[[alice]]"]);
});

test("audienceName reads a link, a link with a path or alias, or a plain name", () => {
  assert.equal(audienceName("[[Marc]]"), "Marc");
  assert.equal(audienceName(" [[People/Marc|Marc D.]] "), "Marc");
  assert.equal(audienceName("[[Marc.md]]"), "Marc");
  assert.equal(audienceName("daily"), "daily");
  assert.equal(audienceName(42), "");
});

test("readList reads links, including unquoted [[Marc]] that YAML turns into a nested list", () => {
  assert.deepEqual(readList(["[[Marc]]", [["Bob"]], "[[People/Ann|Ann]]", "daily", "[[Marc]]"]), ["Marc", "Bob", "Ann", "daily"]);
  assert.deepEqual(readList([["Marc"]]), ["Marc"]);
});

test("markShared on pending written as links", () => {
  const fm: Frontmatter = { pending: ["[[Marc]]", "[[Daily]]"] };
  assert.equal(markShared(fm, "Marc"), true);
  assert.deepEqual(fm.pending, ["[[Daily]]"]);
});
