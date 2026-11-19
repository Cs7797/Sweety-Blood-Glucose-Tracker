import { after, before, beforeEach } from "node:test";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import pg from "pg";

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

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  pool = (await import("../config/db.js")).default;
  const { rows } = await pool.query("SELECT current_schema() AS schema");
  if (rows[0].schema !== schema) {
    throw new Error("Tests must run inside their isolated schema");
  }
  await pool.query(await readFile(new URL("../database/init.sql", import.meta.url), "utf8"));
  const { default: app } = await import("../app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(async () => {
  await pool.query("TRUNCATE TABLE readings, users RESTART IDENTITY");
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (pool) await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

const request = async (path, method = "GET", body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};

export { baseUrl, pool, request };
