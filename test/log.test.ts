import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, appendLogLine, daysBetween, formatLogLine, localDate, parseLog, renameInLog } from "../src/core/log.ts";

test("formatLogLine writes date, audience and outcome", () => {
  assert.equal(
    formatLogLine({ date: "2026-11-20", audience: "biweekly", outcome: "yes, January" }),
    "- 2026-11-20 · biweekly · yes, January",
  );
});

test("formatLogLine without an outcome ends after the audience", () => {
  assert.equal(formatLogLine({ date: "2026-11-20", audience: "daily", outcome: "" }), "- 2026-11-20 · daily");
  assert.equal(formatLogLine({ date: "2026-11-20", audience: "daily", outcome: "  \n " }), "- 2026-11-20 · daily");
});

test("formatLogLine collapses newlines in the outcome", () => {
  assert.equal(formatLogLine({ date: "2026-11-20", audience: "daily", outcome: "a\nb " }), "- 2026-11-20 · daily · a b");
});

test("appendLogLine adds after the last entry of the Log section", () => {
  assert.equal(
    appendLogLine("x\n\n## Log\n- 2026-11-19 · daily\n", "- L"),
    "x\n\n## Log\n- 2026-11-19 · daily\n- L\n",
  );
});

test("appendLogLine stops the section at the next level-2 heading", () => {
  assert.equal(appendLogLine("x\n\n## Log\n- L1\n\n## Notes\nn\n", "- L2"), "x\n\n## Log\n- L1\n- L2\n\n## Notes\nn\n");
});

test("appendLogLine into an empty Log section followed by a heading", () => {
  assert.equal(appendLogLine("## Log\n\n# Other\n", "- L"), "## Log\n- L\n\n# Other\n");
});

test("appendLogLine creates the section when missing", () => {
  assert.equal(appendLogLine("x", "- L"), "x\n\n## Log\n- L\n");
  assert.equal(appendLogLine("x\n\n\n", "- L"), "x\n\n## Log\n- L\n");
});

test("appendLogLine keeps a level-3 heading inside the Log section", () => {
  assert.equal(appendLogLine("## Log\n- L1\n### Sub\n- L2\n", "- L3"), "## Log\n- L1\n### Sub\n- L2\n- L3\n");
});

test("appendLogLine keeps CRLF line endings", () => {
  assert.equal(appendLogLine("x\r\n\r\n## Log\r\n- L1\r\n", "- L2"), "x\r\n\r\n## Log\r\n- L1\r\n- L2\r\n");
});

test("parseLog reads entries, splitting only on the first two separators", () => {
  const note = "x\n\n## Log\n- 2026-11-20 · biweekly · yes · January\n- 2026-11-21 · daily\n- free text\n";
  assert.deepEqual(parseLog(note), [
    { date: "2026-11-20", audience: "biweekly", outcome: "yes · January" },
    { date: "2026-11-21", audience: "daily", outcome: "" },
  ]);
});

test("parseLog ignores log-looking lines outside the Log section", () => {
  const note = "- 2026-11-01 · daily · before\n\n## Log\n- 2026-11-20 · daily\n\n## Notes\n- 2026-11-22 · daily · after\n";
  assert.deepEqual(parseLog(note), [{ date: "2026-11-20", audience: "daily", outcome: "" }]);
});

test("addDays works across month ends and daylight-saving changes", () => {
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-11-19", -30), "2026-10-20");
});

test("localDate formats the local calendar date, not the UTC one", () => {
  assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(localDate(new Date(2026, 10, 19, 0, 1)), "2026-11-19");
});

test("renameInLog renames the audience of Log entries only", () => {
  const note = "- 2026-11-01 · bob · outside\n\n## Log\n- 2026-11-20 · bob · yes · bob agreed\n- 2026-11-21 · bobby\n- 2026-11-22 · bob\n";
  assert.equal(
    renameInLog(note, "bob", "robert"),
    "- 2026-11-01 · bob · outside\n\n## Log\n- 2026-11-20 · robert · yes · bob agreed\n- 2026-11-21 · bobby\n- 2026-11-22 · robert\n",
  );
});

test("daysBetween counts calendar days between two valid dates", () => {
  assert.equal(daysBetween("2026-11-12", "2026-11-19"), 7);
  assert.equal(daysBetween("2026-11-19", "2026-11-12"), -7);
});

test("daysBetween returns null for anything that is not a real date", () => {
  for (const bad of ["2026-13-45", "2026-02-30", "soon", ""]) assert.equal(daysBetween(bad, "2026-11-19"), null);
});
