import assert from "node:assert/strict";
import { after, before, mock, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
import jwt from "jsonwebtoken";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database");
}

const schema = `test_${randomBytes(8).toString("hex")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
databaseUrl.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = databaseUrl.toString();
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
let pool;
let server;
let baseUrl;
let userId;
let otherUserId;
let emptyUserId;

const request = async (path, userid = userId) => {
  const headers = userid ? {
    Authorization: `Bearer ${jwt.sign({ userid }, process.env.JWT_SECRET, { expiresIn: "1h" })}`,
  } : {};
  const response = await fetch(`${baseUrl}/api/reports${path}`, {
    method: "GET",
    headers,
  });
  return { status: response.status, data: await response.json() };
};

before(async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2024-03-15T06:00:00Z") });
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = (await import("../config/db.js")).default;
  await pool.query(await readFile(new URL("../database/init.sql", import.meta.url), "utf8"));
  const { rows } = await pool.query(
    "INSERT INTO users (name, email, password) VALUES ($1, $2, $3), ($4, $5, $3), ($6, $7, $3) RETURNING id",
    ["Report User", "report@example.com", "unused-test-password", "Other User", "other@example.com", "Empty User", "empty@example.com"],
  );
  [userId, otherUserId, emptyUserId] = rows.map((user) => user.id);
  const readings = [
    ["2024-01-31", "Morning (fasting)", 600],
    ["2024-02-01", "Morning (fasting)", 80],
    ["2024-02-28", "Morning (fasting)", 100.1],
    ["2024-02-29", "After dinner", 130.3],
    ["2024-02-29", "Morning (fasting)", 120.2],
    ["2024-03-01", "Morning (fasting)", 90],
    ["2024-03-01", "After breakfast", 110.1],
    ["2024-03-15", "Morning (fasting)", 200],
    ["2024-03-16", "Morning (fasting)", 600],
    ["2024-12-01", "Morning (fasting)", 100],
    ["2024-12-31", "After dinner", 140],
    ["2025-01-01", "Morning (fasting)", 160],
  ];
  for (const reading of readings) {
    await pool.query("INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)", [userId, ...reading]);
  }
  for (const date of ["2024-02-29", "2024-03-15"]) {
    await pool.query("INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)", [otherUserId, date, "After dinner", 500]);
  }
  const { default: app } = await import("../app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (pool) await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
  mock.timers.reset();
});

test("all report endpoints require authentication", async () => {
  for (const path of ["/daily", "/month-to-date", "/previous-month"]) {
    assert.equal((await request(path, null)).status, 401);
  }
});

test("daily report calculates decimal statistics and lists the user's readings in slot order", async () => {
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
  const result = await request("/daily");
  assert.equal(result.data.report.startDate, "2024-03-15");
  assert.equal(result.data.report.count, 1);
  assert.equal(result.data.report.average, 200);
  const other = await request("/daily", otherUserId);
  assert.equal(other.data.report.count, 1);
  assert.equal(other.data.report.average, 500);
});

test("month-to-date includes the first day and today and excludes later dates and other users", async () => {
  const result = await request("/month-to-date");
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.report, { startDate: "2024-03-01", endDate: "2024-03-15", min: 90, max: 200, average: 133.4, count: 3 });
  const other = await request("/month-to-date", otherUserId);
  assert.equal(other.data.report.count, 1);
  assert.equal(other.data.report.average, 500);
});

test("previous-month includes both boundaries of leap February and enforces ownership", async () => {
  const result = await request("/previous-month");
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.report, { startDate: "2024-02-01", endDate: "2024-02-29", min: 80, max: 130.3, average: 107.7, count: 4 });
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
  for (const query of ["date=", "date=2023-02-29", "date=2024-03-16", "date=2024-3-01", "date=2024-03-01&date=2024-03-02", "date[]=2024-03-01", "user_id=1", "date=%27%20OR%201=1"]) {
    const result = await request(`/daily?${query}`);
    assert.equal(result.status, 400, query);
    assert.equal(result.data.success, false);
  }
  for (const path of ["/month-to-date", "/previous-month"]) {
    for (const query of ["date=2024-02-01", "month=2024-02", "user_id=1"]) {
      assert.equal((await request(`${path}?${query}`)).status, 400);
    }
  }
  assert.equal((await request("/unknown")).status, 404);
});

test("month reports switch at India's midnight and handle January's previous year", async () => {
  try {
    mock.timers.setTime(new Date("2024-02-29T18:29:59Z").getTime());
    assert.equal((await request("/daily")).data.report.endDate, "2024-02-29");
    mock.timers.setTime(new Date("2024-02-29T18:30:00Z").getTime());
    assert.deepEqual((await request("/month-to-date")).data.report, {
      startDate: "2024-03-01", endDate: "2024-03-01", min: 90, max: 110.1, average: 100.1, count: 2,
    });
    mock.timers.setTime(new Date("2024-12-31T18:30:00Z").getTime());
    assert.deepEqual((await request("/previous-month")).data.report, {
      startDate: "2024-12-01", endDate: "2024-12-31", min: 100, max: 140, average: 120, count: 2,
    });
    assert.deepEqual((await request("/month-to-date")).data.report, {
      startDate: "2025-01-01", endDate: "2025-01-01", min: 160, max: 160, average: 160, count: 1,
    });
  } finally {
    mock.timers.setTime(new Date("2024-03-15T06:00:00Z").getTime());
  }
});
