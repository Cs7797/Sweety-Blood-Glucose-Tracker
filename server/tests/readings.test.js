import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { getToday } from "../config/dates.js";

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database");
}

const schema = `test_${randomBytes(8).toString("hex")}`;
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
databaseUrl.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = databaseUrl.toString();
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
const slots = ["Morning (fasting)", "After breakfast", "After lunch", "After dinner"];
let pool;
let server;
let baseUrl;
let token;
let otherToken;
let userId;

const request = async (path, method = "GET", body, auth = token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = (await import("../config/db.js")).default;
  await pool.query(await readFile(new URL("../database/init.sql", import.meta.url), "utf8"));
  const { default: app } = await import("../app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const first = await request("/api/user/register", "POST", { name: "First User", email: "first@example.com", password: "Password123!" });
  const second = await request("/api/user/register", "POST", { name: "Second User", email: "second@example.com", password: "Password123!" });
  token = first.data.token;
  userId = first.data.user.id;
  otherToken = second.data.token;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (pool) await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test("all reading operations require authentication", async () => {
  for (const [path, method, body] of [
    ["/api/readings", "GET"],
    ["/api/readings", "POST", {}],
    ["/api/readings/1", "PUT", {}],
    ["/api/readings/1", "DELETE"],
  ]) {
    assert.equal((await request(path, method, body, null)).status, 401);
  }
});

test("readings preserve dates and numeric glucose values and sort by day and slot", async () => {
  for (let index = 3; index >= 0; index -= 1) {
    const result = await request("/api/readings", "POST", { date: "2024-02-29", slot: slots[index], glucose: [40, 120.5, 180, 600][index] });
    assert.equal(result.status, 201);
    assert.equal(result.data.reading.date, "2024-02-29");
    assert.equal(typeof result.data.reading.glucose, "number");
    assert.equal(result.data.reading.user_id, undefined);
  }
  const today = await request("/api/readings", "POST", { date: getToday(), slot: slots[0], glucose: 99 });
  assert.equal(today.status, 201);
  const filtered = await request("/api/readings?date=2024-02-29");
  assert.equal(filtered.status, 200);
  assert.deepEqual(filtered.data.readings.map((reading) => reading.slot), slots);
  const all = await request("/api/readings");
  assert.equal(all.data.readings[0].date, getToday());
  assert.equal(all.data.readings.length, 5);
  const empty = await request("/api/readings?date=2023-01-01");
  assert.deepEqual(empty.data, { success: true, readings: [] });
});

test("users can update date, slot and glucose and delete their own readings", async () => {
  const created = await request("/api/readings", "POST", { date: "2025-01-01", slot: slots[0], glucose: 100 });
  const id = created.data.reading.id;
  const updated = await request(`/api/readings/${id}`, "PUT", { date: "2025-01-02", slot: slots[1], glucose: 125.25 });
  assert.equal(updated.status, 200);
  assert.deepEqual(updated.data.reading, { id, date: "2025-01-02", slot: slots[1], glucose: 125.25 });
  assert.deepEqual((await request("/api/readings?date=2025-01-01")).data.readings, []);
  assert.equal((await request(`/api/readings/${id}`, "DELETE")).status, 200);
  assert.deepEqual((await request("/api/readings?date=2025-01-02")).data.readings, []);
  assert.equal((await request(`/api/readings/${id}`, "DELETE")).status, 404);
  assert.equal((await request(`/api/readings/${id}`, "PUT", { date: "2025-01-02", slot: slots[1], glucose: 100 })).status, 404);
});

test("one user cannot list, update or delete another user's readings", async () => {
  const body = { date: "2025-02-01", slot: slots[0], glucose: 110 };
  const first = await request("/api/readings", "POST", body);
  assert.deepEqual((await request("/api/readings", "GET", undefined, otherToken)).data.readings, []);
  const id = first.data.reading.id;
  assert.equal((await request(`/api/readings/${id}`, "PUT", { ...body, glucose: 200 }, otherToken)).status, 404);
  assert.equal((await request(`/api/readings/${id}`, "DELETE", undefined, otherToken)).status, 404);
  assert.equal((await request("/api/readings?date=2025-02-01")).data.readings[0].glucose, 110);
  const second = await request("/api/readings", "POST", body, otherToken);
  assert.equal(second.status, 201);
  assert.equal((await request("/api/readings?date=2025-02-01")).data.readings.length, 1);
});

test("concurrent duplicates and conflicting edits return friendly errors without changing readings", async () => {
  const body = { date: "2025-03-01", slot: slots[0], glucose: 110 };
  const results = await Promise.all([request("/api/readings", "POST", body), request("/api/readings", "POST", body)]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(results.find((result) => result.status === 409).data.message, "A reading already exists for this date and time slot");
  const second = await request("/api/readings", "POST", { ...body, slot: slots[1] });
  const id = second.data.reading.id;
  assert.equal((await request(`/api/readings/${id}`, "PUT", body)).status, 409);
  const rows = (await request("/api/readings?date=2025-03-01")).data.readings;
  assert.equal(rows.length, 2);
  assert.equal(rows.find((reading) => reading.id === id).slot, slots[1]);
});

test("creation and updates reject malformed dates, slots, glucose values and extra fields", async () => {
  const body = { date: "2025-04-01", slot: slots[0], glucose: 110 };
  const created = await request("/api/readings", "POST", body);
  const invalid = [
    {}, [], null,
    { ...body, date: "2025-02-29" },
    { ...body, date: "2025-04-31" },
    { ...body, date: "9999-12-31" },
    { ...body, date: "2025-4-01" },
    { ...body, date: "2025-04-01T00:00:00Z" },
    { ...body, date: ["2025-04-01"] },
    { ...body, slot: "Fasting" },
    { ...body, slot: "Morning (fasting) " },
    { ...body, slot: [slots[0]] },
    { ...body, glucose: 39.99 },
    { ...body, glucose: 600.01 },
    { ...body, glucose: "110" },
    { ...body, glucose: null },
    { ...body, glucose: true },
    { ...body, user_id: userId + 1 },
    { ...body, id: created.data.reading.id },
  ];
  for (const value of invalid) {
    for (const [path, method] of [["/api/readings", "POST"], [`/api/readings/${created.data.reading.id}`, "PUT"]]) {
      const result = await request(path, method, value);
      assert.equal(result.status, 400, JSON.stringify(value));
      assert.equal(result.data.success, false);
    }
  }
  assert.equal((await request("/api/readings?date=2025-04-01")).data.readings[0].glucose, 110);
});

test("query parameters, IDs and unsupported bodies are validated", async () => {
  for (const query of ["date=", "date=2025-02-29", "date=9999-12-31", "date=2025-01-01&date=2025-01-02", "date[]=2025-01-01", "user_id=1", "page=1", "date=%27%20OR%201=1"]) {
    assert.equal((await request(`/api/readings?${query}`)).status, 400, query);
  }
  for (const id of ["0", "-1", "01", "1.5", "1abc", "2147483648", "NaN"]) {
    assert.equal((await request(`/api/readings/${id}`, "DELETE")).status, 400, id);
  }
  assert.equal((await request("/api/readings/2147483647", "DELETE")).status, 404);
  assert.equal((await request("/api/readings/1?date=2025-01-01", "DELETE")).status, 400);
  assert.equal((await request("/api/readings/1", "DELETE", {})).status, 400);
});

test("PostgreSQL independently enforces slots, glucose bounds, ownership foreign keys and uniqueness", async () => {
  const insert = "INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)";
  await pool.query(insert, [userId, "2025-05-01", slots[0], 100]);
  await assert.rejects(pool.query(insert, [userId, "2025-05-01", slots[0], 200]), { code: "23505" });
  for (const [slot, glucose] of [["Fasting", 100], [slots[1], 39], [slots[1], 601], [slots[1], "NaN"], [slots[1], "Infinity"]]) {
    await assert.rejects(pool.query(insert, [userId, "2025-05-01", slot, glucose]), { code: "23514" });
  }
  await assert.rejects(pool.query(insert, [2147483647, "2025-05-01", slots[0], 100]), { code: "23503" });
  for (const slot of slots.slice(1)) await pool.query(insert, [userId, "2025-05-01", slot, 100]);
  assert.equal((await request("/api/readings?date=2025-05-01")).data.readings.length, 4);
});
