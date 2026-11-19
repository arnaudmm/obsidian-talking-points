import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ageLabel,
  doneFor,
  groupByAudience,
  itemMatrix,
  overviewAudiences,
  pendingCount,
  pendingFor,
  pendingItemCount,
  type ItemRecord,
} from "../src/core/query.ts";

function item(path: string, created: string, pending: string[], log: ItemRecord["log"] = []): ItemRecord {
  return { path, title: path, created, audiences: [...pending, "dept"], pending, log };
}

test("pendingFor lists items pending for the audience, oldest first, undated last", () => {
  const items = [
    item("b.md", "2026-11-19", ["daily"]),
    item("c.md", "", ["daily"]),
    item("a.md", "2026-11-01", ["daily"]),
    item("d.md", "2026-10-01", ["bob"]),
  ];
  assert.deepEqual(pendingFor(items, "daily").map((i) => i.path), ["a.md", "b.md", "c.md"]);
});

test("pendingFor ties on created date are ordered by path", () => {
  const items = [item("z.md", "2026-11-01", ["daily"]), item("y.md", "2026-11-01", ["daily"])];
  assert.deepEqual(pendingFor(items, "daily").map((i) => i.path), ["y.md", "z.md"]);
});

test("pendingFor excludes an item already shared with the audience", () => {
  const shared: ItemRecord = { path: "s.md", title: "s", created: "2026-11-01", audiences: ["daily"], pending: [], log: [] };
  assert.deepEqual(pendingFor([shared], "daily"), []);
});

test("doneFor keeps the last 30 days inclusive, newest first, for this audience only", () => {
  const a = item("a.md", "2026-10-01", [], [
    { date: "2026-10-21", audience: "daily", outcome: "edge" },
    { date: "2026-10-20", audience: "daily", outcome: "too old" },
  ]);
  const b = item("b.md", "2026-10-01", [], [
    { date: "2026-11-19", audience: "daily", outcome: "today" },
    { date: "2026-11-18", audience: "bob", outcome: "other audience" },
  ]);
  const rows = doneFor([a, b], "daily", "2026-11-19");
  assert.deepEqual(rows.map((r) => r.entry.outcome), ["today", "edge"]);
  assert.equal(rows[0].item.path, "b.md");
});

test("pendingCount counts items pending for the audience", () => {
  const items = [item("a.md", "2026-11-01", ["daily", "bob"]), item("b.md", "2026-11-02", ["bob"])];
  assert.equal(pendingCount(items, "bob"), 2);
  assert.equal(pendingCount(items, "dept"), 0);
});

function rec(path: string, audiences: string[], pending: string[], created = "2026-11-01"): ItemRecord {
  return { path, title: path, created, audiences, pending, log: [] };
}

test("ageLabel says today, then days, and nothing for a bad date", () => {
  assert.equal(ageLabel("2026-11-19", "2026-11-19"), "today");
  assert.equal(ageLabel("2026-11-25", "2026-11-19"), "today");
  assert.equal(ageLabel("2026-11-12", "2026-11-19"), "7 d");
  assert.equal(ageLabel("soon", "2026-11-19"), "");
  assert.equal(ageLabel("", "2026-11-19"), "");
});

test("overviewAudiences: known ones in settings order, then unknown ones alphabetically, only if pending", () => {
  const items = [rec("a.md", ["daily", "zed"], ["daily", "zed"]), rec("b.md", ["bob", "carol"], ["bob", "carol"])];
  assert.deepEqual(overviewAudiences(items, ["daily", "biweekly", "bob"]), [
    { audience: "daily", known: true },
    { audience: "bob", known: true },
    { audience: "carol", known: false },
    { audience: "zed", known: false },
  ]);
});

test("an item pending for three audiences is in three groups, counted once, one table row", () => {
  const a = rec("a.md", ["daily", "biweekly", "bob"], ["daily", "biweekly", "bob"]);
  const known = ["daily", "biweekly", "bob"];
  const groups = groupByAudience([a], known);
  assert.deepEqual(groups.map((g) => [g.column.audience, g.items.map((i) => i.path)]), [
    ["daily", ["a.md"]],
    ["biweekly", ["a.md"]],
    ["bob", ["a.md"]],
  ]);
  assert.equal(pendingItemCount([a]), 1);
  const m = itemMatrix([a], known);
  assert.equal(m.rows.length, 1);
  assert.deepEqual(m.rows[0].cells, ["pending", "pending", "pending"]);
});

test("itemMatrix marks an audience done only when the log says it was told", () => {
  const untold = rec("u.md", ["daily", "bob"], ["bob"]);
  const other = rec("o.md", ["daily"], ["daily"], "2026-11-02");
  const m = itemMatrix([untold, other], ["daily", "bob"]);
  assert.deepEqual(m.rows.find((r) => r.item.path === "u.md")?.cells, ["none", "pending"]);
});

test("itemMatrix marks told audiences done and only has columns with something pending", () => {
  const a: ItemRecord = { ...rec("a.md", ["daily", "bob"], ["bob"]), log: [{ date: "2026-11-10", audience: "daily", outcome: "" }] };
  const known = ["daily", "bob"];
  assert.deepEqual(itemMatrix([a], known).columns.map((c) => c.audience), ["bob"]);
  assert.deepEqual(itemMatrix([a], known).rows[0].cells, ["pending"]);
  const b = rec("b.md", ["daily"], ["daily"], "2026-11-02");
  const m = itemMatrix([b, a], known);
  assert.deepEqual(m.columns.map((c) => c.audience), ["daily", "bob"]);
  assert.deepEqual(m.rows.map((r) => [r.item.path, r.cells]), [
    ["a.md", ["done", "pending"]],
    ["b.md", ["pending", "none"]],
  ]);
});

test("itemMatrix and groups skip items with nothing pending", () => {
  const done = rec("d.md", ["daily"], []);
  assert.deepEqual(itemMatrix([done], ["daily"]), { columns: [], rows: [] });
  assert.deepEqual(groupByAudience([done], ["daily"]), []);
  assert.equal(pendingItemCount([done]), 0);
});

test("doneFor with no audience lists every audience, newest first", () => {
  const a: ItemRecord = { ...rec("a.md", ["daily", "bob"], []), log: [
    { date: "2026-11-10", audience: "daily", outcome: "" },
    { date: "2026-11-18", audience: "bob", outcome: "ok" },
  ] };
  assert.deepEqual(doneFor([a], null, "2026-11-19").map((r) => r.entry.audience), ["bob", "daily"]);
});
