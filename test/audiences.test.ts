import { test } from "node:test";
import assert from "node:assert/strict";
import { activeNames, allNames, NO_AUDIENCES, toAudience, type Audience } from "../src/core/audiences.ts";

test("notes with type: person or type: meeting are audiences, named after the note", () => {
  assert.deepEqual(toAudience("People/Marc.md", "Marc", { type: "person" }), { name: "Marc", path: "People/Marc.md", active: true });
  assert.deepEqual(toAudience("Meetings/Daily.md", "Daily", { type: "meeting" }), { name: "Daily", path: "Meetings/Daily.md", active: true });
  for (const fm of [undefined, null, {}, { type: "agenda" }, { type: "people" }, "person"]) {
    assert.equal(toAudience("x.md", "x", fm), null);
  }
});

test("active: false, as a boolean or typed as text, hides an audience", () => {
  assert.equal(toAudience("a.md", "a", { type: "person", active: false })?.active, false);
  assert.equal(toAudience("a.md", "a", { type: "meeting", active: " False " })?.active, false);
  assert.equal(toAudience("a.md", "a", { type: "person", active: true })?.active, true);
});

test("activeNames sorts by name, hides inactive ones and keeps one per name", () => {
  const list: Audience[] = [
    { name: "daily", path: "Meetings/daily.md", active: true },
    { name: "Bob", path: "People/Bob.md", active: true },
    { name: "Ann", path: "People/Ann.md", active: false },
    { name: "Bob", path: "Old/Bob.md", active: true },
  ];
  assert.deepEqual(activeNames(list), ["Bob", "daily"]);
  assert.deepEqual(allNames(list), ["Ann", "Bob", "daily"]);
});

test("the empty message says how to add audiences", () => {
  assert.equal(NO_AUDIENCES, "No audiences yet. Add type: person or type: meeting to a person's or a meeting's note.");
});
