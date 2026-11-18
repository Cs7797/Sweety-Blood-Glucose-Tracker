import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import pg from "pg";
import bcrypt from "bcrypt";
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
const run = promisify(execFile);
let pool;
let server;
let baseUrl;

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = await import("../config/db.js");
  pool = db.default;
  const sql = await readFile(new URL("../database/init.sql", import.meta.url), "utf8");
  await pool.query(sql);
  const { default: app } = await import("../app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  if (pool) await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

const request = async (path, body, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, data: await response.json() };
};

test("registration normalizes email, hashes the password and authenticates the user", async () => {
  const result = await request("/api/user/register", {
    name: "  Sweety User  ",
    email: "  SWEETY@Example.com  ",
    password: "Password123!",
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.name, "Sweety User");
  assert.equal(result.data.user.email, "sweety@example.com");
  assert.equal(result.data.user.password, undefined);
  const { rows } = await pool.query("SELECT password FROM users WHERE id = $1", [result.data.user.id]);
  assert.notEqual(rows[0].password, "Password123!");
  assert.equal(await bcrypt.compare("Password123!", rows[0].password), true);
  const payload = jwt.verify(result.data.token, process.env.JWT_SECRET);
  assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60);
  const profile = await request("/api/user/data", undefined, result.data.token);
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.data.user, result.data.user);
});

test("concurrent registration enforces case-insensitive email uniqueness", async () => {
  const body = { name: "Duplicate", email: "duplicate@example.com", password: "Password123!" };
  const results = await Promise.all([
    request("/api/user/register", body),
    request("/api/user/register", { ...body, email: "DUPLICATE@example.com" }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(results.find((result) => result.status === 409).data.message, "An account with this email already exists");
});

test("registration rejects invalid types, missing fields, long values and unexpected fields", async () => {
  const body = { name: "Valid", email: "valid@example.com", password: "Password123!" };
  const invalid = [
    {}, [], null,
    { ...body, name: "   " },
    { ...body, name: 123 },
    { ...body, name: "a".repeat(81) },
    { ...body, email: ["valid@example.com"] },
    { ...body, email: "invalid" },
    { ...body, email: `${"a".repeat(250)}@example.com` },
    { ...body, password: "short" },
    { ...body, password: 12345678 },
    { ...body, password: "a".repeat(73) },
    { ...body, password: "é".repeat(37) },
    { ...body, role: "admin" },
  ];
  for (const value of invalid) {
    const result = await request("/api/user/register", value);
    assert.equal(result.status, 400, JSON.stringify(value));
    assert.equal(result.data.success, false);
    assert.equal(typeof result.data.message, "string");
  }
});

test("login accepts normalized credentials and rejects invalid credentials without revealing account existence", async () => {
  await request("/api/user/register", { name: "Login User", email: "login@example.com", password: "Password123!" });
  const result = await request("/api/user/login", { email: " LOGIN@EXAMPLE.COM ", password: "Password123!" });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.password, undefined);
  assert.equal((await request("/api/user/data", undefined, result.data.token)).status, 200);
  const wrong = await request("/api/user/login", { email: "login@example.com", password: "wrong" });
  const missing = await request("/api/user/login", { email: "missing@example.com", password: "wrong" });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(wrong.data, missing.data);
  for (const body of [{}, { email: "login@example.com", password: {} }, { email: "' OR 1=1; --", password: "anything" }]) {
    assert.equal((await request("/api/user/login", body)).status, 400);
  }
});

test("authentication rejects missing, forged, expired, unsigned and malformed tokens", async () => {
  const { data } = await request("/api/user/register", { name: "Token User", email: "token@example.com", password: "Password123!" });
  const userid = data.user.id;
  const tokens = [
    undefined,
    "invalid",
    jwt.sign({ userid }, "another-secret", { expiresIn: "1h" }),
    jwt.sign({ userid }, process.env.JWT_SECRET, { expiresIn: -1 }),
    jwt.sign({ userid }, "", { algorithm: "none" }),
    jwt.sign({ userid }, process.env.JWT_SECRET),
    jwt.sign({ userid: "1" }, process.env.JWT_SECRET, { expiresIn: "1h" }),
    jwt.sign({ userid: 2147483648 }, process.env.JWT_SECRET, { expiresIn: "1h" }),
    jwt.sign({ userid }, process.env.JWT_SECRET, { algorithm: "HS384", expiresIn: "1h" }),
  ];
  for (const token of tokens) {
    assert.equal((await request("/api/user/data", undefined, token)).status, 401);
  }
  const raw = await fetch(`${baseUrl}/api/user/data`, { headers: { Authorization: data.token } });
  assert.equal(raw.status, 401);
  await pool.query("DELETE FROM users WHERE id = $1", [userid]);
  assert.equal((await request("/api/user/data", undefined, data.token)).status, 401);
});

test("malformed JSON, large bodies, unsupported queries and unknown routes return consistent errors", async () => {
  const malformed = await fetch(`${baseUrl}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).success, false);
  const large = await request("/api/user/register", { name: "a".repeat(11000) });
  assert.equal(large.status, 413);
  for (const path of ["/api/user/data?userid=1", "/api/user/data?userid[]=1"]) {
    assert.equal((await request(path)).status, 400);
  }
  assert.equal((await request("/api/user/register?extra=1", {})).status, 400);
  assert.equal((await request("/does-not-exist")).status, 404);
});

test("SQL parameters preserve user input as data", async () => {
  const name = "Robert'); DROP TABLE users; --";
  const result = await request("/api/user/register", { name, email: "sql@example.com", password: "Password123!" });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.name, name);
  assert.equal((await request("/api/user/data", undefined, result.data.token)).status, 200);
});

test("database initialization and demo seed can be rerun without duplicating or deleting users", async () => {
  const { rows: before } = await pool.query("SELECT count(*)::integer AS count FROM users");
  const cwd = new URL("../", import.meta.url);
  for (let index = 0; index < 2; index += 1) {
    await run(process.execPath, ["scripts/initDb.js"], { cwd });
    await run(process.execPath, ["scripts/seed.js"], { cwd });
  }
  const { rows: after } = await pool.query("SELECT count(*)::integer AS count FROM users");
  assert.equal(after[0].count, before[0].count + 1);
  const result = await request("/api/user/login", { email: "demo@sweety.local", password: "SweetyDemo123!" });
  assert.equal(result.status, 200);
  const { rows } = await pool.query("SELECT email FROM users");
  assert.equal(rows.filter((user) => user.email === "demo@sweety.local").length, 1);
});
