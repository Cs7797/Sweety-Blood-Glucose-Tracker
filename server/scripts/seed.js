import bcrypt from "bcrypt";
import pool from "../config/db.js";

try {
  const password = await bcrypt.hash("SweetyDemo123!", 10);
  await pool.query(
    `INSERT INTO users (name, email, password)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password = EXCLUDED.password`,
    ["Demo User", "demo@sweety.local", password],
  );
  process.stdout.write("Demo user seeded\n");
} finally {
  await pool.end();
}
