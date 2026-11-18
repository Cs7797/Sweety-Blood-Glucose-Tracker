import app from "./app.js";
import pool from "./config/db.js";
import { port } from "./config/env.js";

await pool.query("SELECT 1 FROM users LIMIT 1");

app.listen(port, () => {
  process.stdout.write(`Server running on port ${port}\n`);
});
