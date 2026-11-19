import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { pool, request } from "./setup.js";

let token;
let otherToken;
let userId;
let otherUserId;

beforeEach(async () => {
  const first = await request("/api/user/register", "POST", { name: "First User", email: "first@example.com", password: "Password123!" });
  const second = await request("/api/user/register", "POST", { name: "Second User", email: "second@example.com", password: "Password123!" });
  token = first.data.token;
  userId = first.data.user.id;
  otherToken = second.data.token;
  otherUserId = second.data.user.id;
});

test("readings default to ten per page and include the total count", async () => {
  for (let day = 1; day <= 11; day += 1) {
    await pool.query(
      "INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)",
      [userId, `2025-01-${String(day).padStart(2, "0")}`, "Morning (fasting)", 100],
    );
  }

  const first = await request("/api/readings", "GET", undefined, token);
  assert.equal(first.status, 200);
  assert.equal(first.data.readings.length, 10);
  assert.equal(first.data.readings[0].date, "2025-01-11");
  assert.deepEqual(first.data.pagination, { page: 1, limit: 10, total: 11, totalPages: 2 });

  const second = await request("/api/readings?page=2", "GET", undefined, token);
  assert.equal(second.data.readings.length, 1);
  assert.equal(second.data.readings[0].date, "2025-01-01");
});

test("custom page sizes keep readings ordered by date and time slot", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2025-01-02', 'After dinner', 130),
     ($1, '2025-01-01', 'Morning (fasting)', 110),
     ($1, '2025-01-02', 'Morning (fasting)', 120)`,
    [userId],
  );

  const first = await request("/api/readings?page=1&limit=2", "GET", undefined, token);
  const second = await request("/api/readings?page=2&limit=2", "GET", undefined, token);
  assert.deepEqual(first.data.readings.map((reading) => reading.glucose), [120, 130]);
  assert.deepEqual(second.data.readings.map((reading) => reading.glucose), [110]);
  assert.deepEqual(second.data.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
});

test("page results and totals use the selected date and authenticated user", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2025-01-01', 'Morning (fasting)', 110),
     ($1, '2025-01-01', 'After lunch', 130),
     ($1, '2025-01-02', 'Morning (fasting)', 140),
     ($2, '2025-01-01', 'Morning (fasting)', 500)`,
    [userId, otherUserId],
  );

  const result = await request("/api/readings?date=2025-01-01&page=2&limit=1", "GET", undefined, token);
  assert.equal(result.data.readings[0].glucose, 130);
  assert.deepEqual(result.data.pagination, { page: 2, limit: 1, total: 2, totalPages: 2 });

  const other = await request("/api/readings?date=2025-01-01&limit=1", "GET", undefined, otherToken);
  assert.equal(other.data.readings[0].glucose, 500);
  assert.equal(other.data.pagination.total, 1);
});

test("empty and out-of-range pages return empty readings with accurate totals", async () => {
  const empty = await request("/api/readings", "GET", undefined, token);
  assert.deepEqual(empty.data.readings, []);
  assert.deepEqual(empty.data.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });

  await pool.query(
    "INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)",
    [userId, "2025-01-01", "Morning (fasting)", 110],
  );
  const beyond = await request("/api/readings?page=3&limit=1", "GET", undefined, token);
  assert.equal(beyond.status, 200);
  assert.deepEqual(beyond.data.readings, []);
  assert.deepEqual(beyond.data.pagination, { page: 3, limit: 1, total: 1, totalPages: 1 });
});

test("deleting the only reading on the last page reduces the page count", async () => {
  await pool.query(
    `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES
     ($1, '2025-01-01', 'Morning (fasting)', 110),
     ($1, '2025-01-02', 'Morning (fasting)', 120),
     ($1, '2025-01-03', 'Morning (fasting)', 130)`,
    [userId],
  );
  const last = await request("/api/readings?page=2&limit=2", "GET", undefined, token);
  const id = last.data.readings[0].id;
  assert.equal((await request(`/api/readings/${id}`, "DELETE", undefined, token)).status, 200);

  const result = await request("/api/readings?page=2&limit=2", "GET", undefined, token);
  assert.deepEqual(result.data.readings, []);
  assert.deepEqual(result.data.pagination, { page: 2, limit: 2, total: 2, totalPages: 1 });
});

test("page must be a single positive integer within the allowed range", async () => {
  assert.equal((await request("/api/readings?page=0", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=-1", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=1.5", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=abc", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=1000001", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page=1&page=2", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?page[]=1", "GET", undefined, token)).status, 400);
});

test("limit must be a single integer from one to one hundred", async () => {
  assert.equal((await request("/api/readings?limit=0", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=-1", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=1.5", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=abc", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=101", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=1&limit=2", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit[]=1", "GET", undefined, token)).status, 400);
  assert.equal((await request("/api/readings?limit=100", "GET", undefined, token)).status, 200);
});
