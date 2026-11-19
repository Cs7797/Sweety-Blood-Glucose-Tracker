import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { baseUrl, pool, request } from "./setup.js";

const run = promisify(execFile);

test("registration normalizes email, hashes the password and authenticates the user", async () => {
  const result = await request("/api/user/register", "POST", {
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
  const profile = await request("/api/user/data", "GET", undefined, result.data.token);
  assert.equal(profile.status, 200);
  assert.deepEqual(profile.data.user, result.data.user);
});

test("concurrent registration enforces case-insensitive email uniqueness", async () => {
  const body = { name: "Duplicate", email: "duplicate@example.com", password: "Password123!" };
  const results = await Promise.all([
    request("/api/user/register", "POST", body),
    request("/api/user/register", "POST", { ...body, email: "DUPLICATE@example.com" }),
  ]);
  assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
  assert.equal(results.find((result) => result.status === 409).data.message, "An account with this email already exists");
});

test("registration rejects invalid types, missing fields, long values and unexpected fields", async () => {
  const body = { name: "Valid", email: "valid@example.com", password: "Password123!" };
  assert.equal((await request("/api/user/register", "POST", {})).status, 400);
  assert.equal((await request("/api/user/register", "POST", [])).status, 400);
  assert.equal((await request("/api/user/register", "POST", null)).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, name: "   " })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, name: 123 })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, name: "a".repeat(81) })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, email: ["valid@example.com"] })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, email: "invalid" })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, email: `${"a".repeat(250)}@example.com` })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, password: "short" })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, password: 12345678 })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, password: "a".repeat(73) })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, password: "é".repeat(37) })).status, 400);
  assert.equal((await request("/api/user/register", "POST", { ...body, role: "admin" })).status, 400);
});

test("login accepts normalized credentials and rejects invalid credentials without revealing account existence", async () => {
  await request("/api/user/register", "POST", { name: "Login User", email: "login@example.com", password: "Password123!" });
  const result = await request("/api/user/login", "POST", { email: " LOGIN@EXAMPLE.COM ", password: "Password123!" });
  assert.equal(result.status, 200);
  assert.equal(result.data.user.password, undefined);
  assert.equal((await request("/api/user/data", "GET", undefined, result.data.token)).status, 200);
  const wrong = await request("/api/user/login", "POST", { email: "login@example.com", password: "wrong" });
  const missing = await request("/api/user/login", "POST", { email: "missing@example.com", password: "wrong" });
  assert.equal(wrong.status, 401);
  assert.equal(missing.status, 401);
  assert.deepEqual(wrong.data, missing.data);
  for (const body of [{}, { email: "login@example.com", password: {} }, { email: "' OR 1=1; --", password: "anything" }]) {
    assert.equal((await request("/api/user/login", "POST", body)).status, 400);
  }
});

test("authentication rejects missing, forged, expired, unsigned and malformed tokens", async () => {
  const { data } = await request("/api/user/register", "POST", { name: "Token User", email: "token@example.com", password: "Password123!" });
  const userid = data.user.id;
  assert.equal((await request("/api/user/data")).status, 401);
  assert.equal((await request("/api/user/data", "GET", undefined, "invalid")).status, 401);

  const forged = jwt.sign({ userid }, "another-secret", { expiresIn: "1h" });
  assert.equal((await request("/api/user/data", "GET", undefined, forged)).status, 401);

  const expired = jwt.sign({ userid }, process.env.JWT_SECRET, { expiresIn: -1 });
  assert.equal((await request("/api/user/data", "GET", undefined, expired)).status, 401);

  const unsigned = jwt.sign({ userid }, "", { algorithm: "none" });
  assert.equal((await request("/api/user/data", "GET", undefined, unsigned)).status, 401);

  const noExpiry = jwt.sign({ userid }, process.env.JWT_SECRET);
  assert.equal((await request("/api/user/data", "GET", undefined, noExpiry)).status, 401);

  const invalidId = jwt.sign({ userid: "1" }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal((await request("/api/user/data", "GET", undefined, invalidId)).status, 401);

  const largeId = jwt.sign({ userid: 2147483648 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  assert.equal((await request("/api/user/data", "GET", undefined, largeId)).status, 401);

  const wrongAlgorithm = jwt.sign({ userid }, process.env.JWT_SECRET, { algorithm: "HS384", expiresIn: "1h" });
  assert.equal((await request("/api/user/data", "GET", undefined, wrongAlgorithm)).status, 401);

  const raw = await fetch(`${baseUrl}/api/user/data`, { headers: { Authorization: data.token } });
  assert.equal(raw.status, 401);
  await pool.query("DELETE FROM users WHERE id = $1", [userid]);
  assert.equal((await request("/api/user/data", "GET", undefined, data.token)).status, 401);
});

test("malformed JSON, large bodies, unsupported queries and unknown routes return consistent errors", async () => {
  const malformed = await fetch(`${baseUrl}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).success, false);
  const large = await request("/api/user/register", "POST", { name: "a".repeat(11000) });
  assert.equal(large.status, 413);
  for (const path of ["/api/user/data?userid=1", "/api/user/data?userid[]=1"]) {
    assert.equal((await request(path)).status, 400);
  }
  assert.equal((await request("/api/user/register?extra=1", "POST", {})).status, 400);
  assert.equal((await request("/does-not-exist")).status, 404);
});

test("SQL parameters preserve user input as data", async () => {
  const name = "Robert'); DROP TABLE users; --";
  const result = await request("/api/user/register", "POST", { name, email: "sql@example.com", password: "Password123!" });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.name, name);
  assert.equal((await request("/api/user/data", "GET", undefined, result.data.token)).status, 200);
});

test("database initialization and demo seed can be rerun without duplicating or deleting users", async () => {
  await request("/api/user/register", "POST", { name: "Existing User", email: "existing@example.com", password: "Password123!" });
  const { rows: before } = await pool.query("SELECT count(*)::integer AS count FROM users");
  const cwd = new URL("../", import.meta.url);
  for (let index = 0; index < 2; index += 1) {
    await run(process.execPath, ["scripts/initDb.js"], { cwd });
    await run(process.execPath, ["scripts/seed.js"], { cwd });
  }
  const { rows: after } = await pool.query("SELECT count(*)::integer AS count FROM users");
  assert.equal(after[0].count, before[0].count + 1);
  const result = await request("/api/user/login", "POST", { email: "demo@sweety.local", password: "SweetyDemo123!" });
  assert.equal(result.status, 200);
  const { rows } = await pool.query("SELECT email FROM users");
  assert.equal(rows.filter((user) => user.email === "demo@sweety.local").length, 1);
});
