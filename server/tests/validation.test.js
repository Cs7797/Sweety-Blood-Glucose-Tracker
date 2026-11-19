import assert from "node:assert/strict";
import { test } from "node:test";
import { baseUrl, pool, request } from "./setup.js";

test("registration rejects null characters in names and email addresses", async () => {
  const body = { name: "Test User", email: "test@example.com", password: "Password123!" };
  const name = await request("/api/user/register", "POST", { ...body, name: "Test\0User" });
  const email = await request("/api/user/register", "POST", { ...body, email: "test\0@example.com" });

  assert.equal(name.status, 400);
  assert.equal(email.status, 400);
  const { rows } = await pool.query("SELECT count(*)::integer AS count FROM users");
  assert.equal(rows[0].count, 0);
});

test("registration validates email length after converting it to lowercase", async () => {
  const email = "İ".repeat(125) + "@a.co";
  const result = await request("/api/user/register", "POST", { name: "Test User", email, password: "Password123!" });

  assert.equal(result.status, 400);
  assert.equal(result.data.success, false);
});

test("unsupported JSON charsets and content encodings return 415", async () => {
  const charset = await fetch(`${baseUrl}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=iso-8859-1" },
    body: "{}",
  });
  assert.equal(charset.status, 415);
  assert.equal((await charset.json()).success, false);

  const encoding = await fetch(`${baseUrl}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Encoding": "unsupported" },
    body: "{}",
  });
  assert.equal(encoding.status, 415);
  assert.equal((await encoding.json()).success, false);
});

test("malformed compressed JSON returns a validation error", async () => {
  const result = await fetch(`${baseUrl}/api/user/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
    body: "not gzip data",
  });

  assert.equal(result.status, 400);
  assert.equal((await result.json()).success, false);
});
