import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool, request } from "./setup.js";

const run = promisify(execFile);
let userId;

beforeEach(async () => {
  await pool.query("ALTER TABLE readings ALTER COLUMN glucose TYPE NUMERIC USING glucose::numeric");
  const { data } = await request("/api/user/register", "POST", { name: "Migration User", email: "migration@example.com", password: "Password123!" });
  userId = data.user.id;
});

test("initialization converts whole-number legacy data without losing readings", async () => {
  await pool.query("INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)", [userId, "2025-01-01", "Morning (fasting)", 110]);
  await run(process.execPath, ["scripts/initDb.js"], { cwd: new URL("../", import.meta.url) });
  const { rows } = await pool.query("SELECT glucose, pg_typeof(glucose)::text AS type FROM readings");
  assert.deepEqual(rows, [{ glucose: 110, type: "integer" }]);
});

test("initialization refuses decimal legacy data and leaves it unchanged", async () => {
  await pool.query("INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)", [userId, "2025-01-01", "Morning (fasting)", 110.5]);
  await assert.rejects(
    run(process.execPath, ["scripts/initDb.js"], { cwd: new URL("../", import.meta.url) }),
    (error) => error.stderr.includes("Existing decimal readings must be reviewed and corrected"),
  );
  const { rows } = await pool.query("SELECT glucose, pg_typeof(glucose)::text AS type FROM readings");
  assert.deepEqual(rows, [{ glucose: "110.5", type: "numeric" }]);
});
