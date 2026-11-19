import assert from "node:assert/strict";
import { test } from "node:test";
import { getMonthDates, getToday, validateDate } from "../config/dates.js";

test("today follows India's date across UTC midnight and year boundaries", () => {
  assert.equal(getToday(new Date("2025-12-31T18:29:59Z")), "2025-12-31");
  assert.equal(getToday(new Date("2025-12-31T18:30:00Z")), "2026-01-01");
  assert.equal(getToday(new Date("2026-03-31T23:59:59Z")), "2026-04-01");
});

test("month ranges handle first days, leap years and January's previous year", () => {
  assert.deepEqual(getMonthDates("2026-11-19"), { startDate: "2026-11-01", endDate: "2026-11-19" });
  assert.deepEqual(getMonthDates("2026-01-01"), { startDate: "2026-01-01", endDate: "2026-01-01" });
  assert.deepEqual(getMonthDates("2026-01-01", true), { startDate: "2025-12-01", endDate: "2025-12-31" });
  assert.deepEqual(getMonthDates("2024-03-31", true), { startDate: "2024-02-01", endDate: "2024-02-29" });
  assert.deepEqual(getMonthDates("2025-03-01", true), { startDate: "2025-02-01", endDate: "2025-02-28" });
  assert.deepEqual(getMonthDates("2026-05-31", true), { startDate: "2026-04-01", endDate: "2026-04-30" });
});

test("dates require exact calendar dates and reject future days", () => {
  assert.equal(typeof validateDate(undefined), "string");
  assert.equal(typeof validateDate(null), "string");
  assert.equal(typeof validateDate([]), "string");
  assert.equal(typeof validateDate(20260101), "string");
  assert.equal(typeof validateDate("2026-1-01"), "string");
  assert.equal(typeof validateDate("2026-01-1"), "string");
  assert.equal(typeof validateDate("2026-01-01T00:00:00Z"), "string");
  assert.equal(typeof validateDate("2025-02-29"), "string");
  assert.equal(typeof validateDate("2024-02-30"), "string");
  assert.equal(typeof validateDate("2026-04-31"), "string");
  assert.equal(typeof validateDate("2026-13-01"), "string");
  assert.equal(typeof validateDate("2026-00-01"), "string");
  assert.equal(typeof validateDate("0000-01-01"), "string");
  assert.equal(typeof validateDate("9999-12-31"), "string");

  assert.equal(validateDate("2024-02-29"), null);
  assert.equal(validateDate("2000-02-29"), null);
  assert.equal(validateDate("2025-02-28"), null);
  assert.equal(validateDate("2025-12-31"), null);
  assert.equal(validateDate("0001-01-01"), null);
  assert.equal(validateDate(getToday()), null);
  const tomorrow = new Date(`${getToday()}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  assert.equal(validateDate(tomorrow.toISOString().slice(0, 10)), "Date cannot be in the future");
});
