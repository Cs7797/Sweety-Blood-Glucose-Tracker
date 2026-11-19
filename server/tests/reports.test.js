import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import jwt from "jsonwebtoken";
import { pool, request as sendRequest } from "./setup.js";

let userId;
let otherUserId;
let emptyUserId;

beforeEach(async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2024-03-15T06:00:00Z") });
  const first = await sendRequest("/api/user/register", "POST", { name: "Report User", email: "report@example.com", password: "Password123!" });
  const second = await sendRequest("/api/user/register", "POST", { name: "Other User", email: "other@example.com", password: "Password123!" });
  const empty = await sendRequest("/api/user/register", "POST", { name: "Empty User", email: "empty@example.com", password: "Password123!" });
  userId = first.data.user.id;
  otherUserId = second.data.user.id;
  emptyUserId = empty.data.user.id;
});

afterEach(() => {
  mock.timers.reset();
});

const request = (path, userid = userId) => {
  const token = userid ? jwt.sign({ userid }, process.env.JWT_SECRET, { expiresIn: "1h" }) : undefined;
  return sendRequest(`/api/reports${path}`, "GET", undefined, token);
};

test("all report endpoints require authentication", async () => {
  for (const path of ["/daily", "/month-to-date", "/previous-month"]) {
    assert.equal((await request(path, null)).status, 401);
  }
});

test("daily report calculates decimal statistics and lists the user's readings in slot order", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-02-29', 'After dinner', 130.3),
     ($1, '2024-02-29', 'Morning (fasting)', 120.2),
     ($2, '2024-02-29', 'After dinner', 500)`,
    [userId, otherUserId],
  );
  const { status, data } = await request("/daily?date=2024-02-29");
  assert.equal(status, 200);
  const { readings, ...summary } = data.report;
  assert.deepEqual(summary, { startDate: "2024-02-29", endDate: "2024-02-29", min: 120.2, max: 130.3, average: 125.3, count: 2 });
  assert.deepEqual(readings.map(({ date, slot, glucose }) => ({ date, slot, glucose })), [
    { date: "2024-02-29", slot: "Morning (fasting)", glucose: 120.2 },
    { date: "2024-02-29", slot: "After dinner", glucose: 130.3 },
  ]);
  assert.equal(readings.every((reading) => Number.isInteger(reading.id)), true);
  assert.deepEqual((await request("/daily/?date=2024-02-29")).data, data);
});

test("daily defaults to today and never includes another user's data", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-03-15', 'Morning (fasting)', 200),
     ($2, '2024-03-15', 'After dinner', 500)`,
    [userId, otherUserId],
  );
  const result = await request("/daily");
  assert.equal(result.data.report.startDate, "2024-03-15");
  assert.equal(result.data.report.count, 1);
  assert.equal(result.data.report.average, 200);
  const other = await request("/daily", otherUserId);
  assert.equal(other.data.report.count, 1);
  assert.equal(other.data.report.average, 500);
});

test("month-to-date includes the first day and today and excludes later dates and other users", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-02-29', 'Morning (fasting)', 600),
     ($1, '2024-03-01', 'Morning (fasting)', 90),
     ($1, '2024-03-01', 'After breakfast', 110.1),
     ($1, '2024-03-15', 'Morning (fasting)', 200),
     ($1, '2024-03-16', 'Morning (fasting)', 600),
     ($2, '2024-03-15', 'After dinner', 500)`,
    [userId, otherUserId],
  );
  const result = await request("/month-to-date");
  assert.equal(result.status, 200);
  const { trend, ...summary } = result.data.report;
  assert.equal(trend.length, 15);
  assert.deepEqual(summary, { startDate: "2024-03-01", endDate: "2024-03-15", min: 90, max: 200, average: 133.4, count: 3 });
  const other = await request("/month-to-date", otherUserId);
  assert.equal(other.data.report.count, 1);
  assert.equal(other.data.report.average, 500);
});

test("previous-month includes both boundaries of leap February and enforces ownership", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-01-31', 'Morning (fasting)', 600),
     ($1, '2024-02-01', 'Morning (fasting)', 80),
     ($1, '2024-02-28', 'Morning (fasting)', 100.1),
     ($1, '2024-02-29', 'After dinner', 130.3),
     ($1, '2024-02-29', 'Morning (fasting)', 120.2),
     ($1, '2024-03-01', 'Morning (fasting)', 600),
     ($2, '2024-02-29', 'After dinner', 500)`,
    [userId, otherUserId],
  );
  const result = await request("/previous-month");
  assert.equal(result.status, 200);
  const { trend, ...summary } = result.data.report;
  assert.equal(trend.length, 29);
  assert.deepEqual(summary, { startDate: "2024-02-01", endDate: "2024-02-29", min: 80, max: 130.3, average: 107.7, count: 4 });
  const other = await request("/previous-month", otherUserId);
  assert.equal(other.data.report.count, 1);
  assert.equal(other.data.report.average, 500);
});

test("empty reports return null statistics, zero count and an empty-state message", async () => {
  for (const path of ["/daily", "/month-to-date", "/previous-month"]) {
    const { status, data } = await request(path, emptyUserId);
    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.message, "No readings for this period");
    assert.equal(data.report.count, 0);
    assert.equal(data.report.min, null);
    assert.equal(data.report.max, null);
    assert.equal(data.report.average, null);
    if (path === "/daily") assert.deepEqual(data.report.readings, []);
  }
  assert.equal((await request("/daily?date=2024-02-27")).data.report.count, 0);
});

test("reports reject invalid dates, repeated queries, owner overrides and unsupported parameters", async () => {
  assert.equal((await request("/daily?date=")).status, 400);
  assert.equal((await request("/daily?date=2023-02-29")).status, 400);
  assert.equal((await request("/daily?date=2024-03-16")).status, 400);
  assert.equal((await request("/daily?date=2024-3-01")).status, 400);
  assert.equal((await request("/daily?date=2024-03-01&date=2024-03-02")).status, 400);
  assert.equal((await request("/daily?date[]=2024-03-01")).status, 400);
  assert.equal((await request("/daily?user_id=1")).status, 400);
  assert.equal((await request("/daily?date=%27%20OR%201=1")).status, 400);
  for (const path of ["/month-to-date", "/previous-month"]) {
    assert.equal((await request(`${path}?date=2024-02-01`)).status, 400);
    assert.equal((await request(`${path}?month=2024-02`)).status, 400);
    assert.equal((await request(`${path}?user_id=1`)).status, 400);
  }
  assert.equal((await request("/unknown")).status, 404);
});

test("monthly trends average each day's readings and leave missing days blank", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-03-01', 'Morning (fasting)', 100.1),
     ($1, '2024-03-01', 'After dinner', 120.2),
     ($1, '2024-03-03', 'Morning (fasting)', 140)`,
    [userId],
  );

  const result = await request("/month-to-date");
  assert.equal(result.status, 200);
  assert.equal(result.data.report.trend.length, 15);
  assert.deepEqual(result.data.report.trend[0], { date: "2024-03-01", average: 110.2, count: 2 });
  assert.deepEqual(result.data.report.trend[1], { date: "2024-03-02", average: null, count: 0 });
  assert.deepEqual(result.data.report.trend[2], { date: "2024-03-03", average: 140, count: 1 });
  assert.equal(result.data.report.average, 120.1);
});

test("monthly trends exclude other users and dates outside the report period", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-02-29', 'Morning (fasting)', 600),
     ($1, '2024-03-01', 'Morning (fasting)', 110),
     ($1, '2024-03-16', 'Morning (fasting)', 600),
     ($2, '2024-03-01', 'Morning (fasting)', 500)`,
    [userId, otherUserId],
  );

  const result = await request("/month-to-date");
  assert.deepEqual(result.data.report.trend[0], { date: "2024-03-01", average: 110, count: 1 });
  assert.equal(result.data.report.trend.reduce((total, day) => total + day.count, 0), 1);
  const other = await request("/month-to-date", otherUserId);
  assert.deepEqual(other.data.report.trend[0], { date: "2024-03-01", average: 500, count: 1 });
});

test("previous-month trends include leap day and return null averages for empty periods", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-02-01', 'Morning (fasting)', 110),
     ($1, '2024-02-29', 'Morning (fasting)', 130)`,
    [userId],
  );

  const result = await request("/previous-month");
  assert.equal(result.data.report.trend.length, 29);
  assert.deepEqual(result.data.report.trend[0], { date: "2024-02-01", average: 110, count: 1 });
  assert.deepEqual(result.data.report.trend[28], { date: "2024-02-29", average: 130, count: 1 });

  const empty = await request("/previous-month", emptyUserId);
  assert.equal(empty.data.report.trend.length, 29);
  assert.equal(empty.data.report.trend.every((day) => day.average === null && day.count === 0), true);
});

test("month reports switch at India's midnight and handle January's previous year", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2024-03-01', 'Morning (fasting)', 90),
     ($1, '2024-03-01', 'After breakfast', 110.1),
     ($1, '2024-12-01', 'Morning (fasting)', 100),
     ($1, '2024-12-31', 'After dinner', 140),
     ($1, '2025-01-01', 'Morning (fasting)', 160)`,
    [userId],
  );
  mock.timers.setTime(new Date("2024-02-29T18:29:59Z").getTime());
  assert.equal((await request("/daily")).data.report.endDate, "2024-02-29");
  mock.timers.setTime(new Date("2024-02-29T18:30:00Z").getTime());
  const { trend: marchTrend, ...march } = (await request("/month-to-date")).data.report;
  assert.equal(marchTrend.length, 1);
  assert.deepEqual(march, {
    startDate: "2024-03-01", endDate: "2024-03-01", min: 90, max: 110.1, average: 100.1, count: 2,
  });
  mock.timers.setTime(new Date("2024-12-31T18:30:00Z").getTime());
  const { trend: decemberTrend, ...december } = (await request("/previous-month")).data.report;
  assert.equal(decemberTrend.length, 31);
  assert.deepEqual(december, {
    startDate: "2024-12-01", endDate: "2024-12-31", min: 100, max: 140, average: 120, count: 2,
  });
  const { trend: januaryTrend, ...january } = (await request("/month-to-date")).data.report;
  assert.equal(januaryTrend.length, 1);
  assert.deepEqual(january, {
    startDate: "2025-01-01", endDate: "2025-01-01", min: 160, max: 160, average: 160, count: 1,
  });
});
