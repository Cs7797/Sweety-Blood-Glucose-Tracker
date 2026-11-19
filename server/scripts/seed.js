import bcrypt from "bcrypt";
import pool from "../config/db.js";
import { getMonthDates, getToday } from "../config/dates.js";

const client = await pool.connect();

try {
  await client.query("BEGIN");
  const password = await bcrypt.hash("SweetyDemo123!", 10);
  await client.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    ["Demo User", "demo@sweety.local", password],
  );
  const { rows } = await client.query("SELECT id FROM users WHERE email = $1", ["demo@sweety.local"]);
  const today = getToday();
  const { startDate } = getMonthDates(today, true);
  const date = new Date(`${startDate}T00:00:00Z`);
  const slots = ["Morning (fasting)", "After breakfast", "After lunch", "After dinner"];

  while (date.toISOString().slice(0, 10) <= today) {
    for (let index = 0; index < slots.length; index += 1) {
      const glucose = [98, 145, 132, 120][index] + (date.getUTCDate() % 5) * 3;
      await client.query(
        `INSERT INTO readings (user_id, reading_date, slot, glucose)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, reading_date, slot) DO NOTHING`,
        [rows[0].id, date.toISOString().slice(0, 10), slots[index], glucose],
      );
    }
    date.setUTCDate(date.getUTCDate() + 1);
  }

  await client.query("COMMIT");
  process.stdout.write("Demo user and sample readings seeded\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
