import { readFile } from "node:fs/promises";
import pool from "../config/db.js";

try {
  const sql = await readFile(new URL("../database/init.sql", import.meta.url), "utf8");
  await pool.query(sql);
  process.stdout.write("Database initialized\n");
} finally {
  await pool.end();
}
