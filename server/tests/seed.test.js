import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getMonthDates, getToday } from "../config/dates.js";
import { pool, request } from "./setup.js";

const run = promisify(execFile);
const cwd = new URL("../", import.meta.url);

test("seeding creates daily readings for the current and previous month without duplicates", async () => {
  await run(process.execPath, ["scripts/seed.js"], { cwd });
  const { rows: users } = await pool.query("SELECT * FROM users ORDER BY id");
  const { rows: readings } = await pool.query("SELECT *, to_char(reading_date, 'YYYY-MM-DD') AS date FROM readings ORDER BY id");
  const today = getToday();
  const { startDate } = getMonthDates(today, true);
  const days = (new Date(`${today}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000 + 1;

  assert.equal(users.length, 1);
  assert.equal(users[0].email, "demo@sweety.local");
  assert.equal(readings.length, days * 4);
  assert.equal(readings[0].date, startDate);
  assert.equal(readings.at(-1).date, today);
  assert.deepEqual([...new Set(readings.map((reading) => reading.slot))], ["Morning (fasting)", "After breakfast", "After lunch", "After dinner"]);
  assert.equal(readings.every((reading) => reading.user_id === users[0].id && Number.isInteger(reading.glucose) && reading.glucose >= 40 && reading.glucose <= 600), true);

  await run(process.execPath, ["scripts/seed.js"], { cwd });
  assert.deepEqual((await pool.query("SELECT * FROM users ORDER BY id")).rows, users);
  assert.deepEqual((await pool.query("SELECT *, to_char(reading_date, 'YYYY-MM-DD') AS date FROM readings ORDER BY id")).rows, readings);
});

test("seeding preserves existing demo credentials and readings belonging to any user", async () => {
  const demo = await request("/api/user/register", "POST", { name: "Existing Demo", email: "demo@sweety.local", password: "ExistingPass123!" });
  const other = await request("/api/user/register", "POST", { name: "Other User", email: "other@example.com", password: "OtherPass123!" });
  const body = { date: getToday(), slot: "Morning (fasting)", glucose: 175 };
  await request("/api/readings", "POST", body, demo.data.token);
  await request("/api/readings", "POST", body, other.data.token);
  const { rows: users } = await pool.query("SELECT * FROM users ORDER BY id");
  const { rows: readings } = await pool.query("SELECT * FROM readings ORDER BY id");

  await run(process.execPath, ["scripts/seed.js"], { cwd });

  assert.deepEqual((await pool.query("SELECT * FROM users ORDER BY id")).rows, users);
  assert.deepEqual((await pool.query("SELECT * FROM readings WHERE id = ANY($1::integer[]) ORDER BY id", [readings.map((reading) => reading.id)])).rows, readings);
  const { rows } = await pool.query("SELECT count(*)::integer AS count FROM readings WHERE user_id = $1", [other.data.user.id]);
  assert.equal(rows[0].count, 1);
});
