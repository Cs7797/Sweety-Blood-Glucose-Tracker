import { readFile } from "node:fs/promises";
import pool from "../config/db.js";

const client = await pool.connect();

try {
  await client.query("BEGIN");
  const sql = await readFile(new URL("../database/init.sql", import.meta.url), "utf8");
  await client.query(sql);
  await client.query("LOCK TABLE readings IN ACCESS EXCLUSIVE MODE");
  const { rows } = await client.query("SELECT count(*)::integer AS count FROM readings WHERE glucose <> trunc(glucose)");
  if (rows[0].count > 0) {
    throw new Error("Existing decimal readings must be reviewed and corrected before initialization. No readings were changed");
  }
  await client.query("ALTER TABLE readings ALTER COLUMN glucose TYPE INTEGER USING glucose::integer");
  await client.query("COMMIT");
  process.stdout.write("Database initialized\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
