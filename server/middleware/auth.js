import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization || !/^Bearer \S+$/.test(authorization)) {
    return res.status(401).json({ success: false, message: "Please log in to continue" });
  }

  let userId;
  try {
    userId = jwt.verify(authorization.slice(7), process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!Number.isInteger(userId.userid) || userId.userid < 1 || userId.userid > 2147483647 || !Number.isInteger(userId.exp)) {
      return res.status(401).json({ success: false, message: "Session is invalid or expired" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Session is invalid or expired" });
  }

  try {
    const { rows } = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [userId.userid]);
    if (!rows[0]) {
      return res.status(401).json({ success: false, message: "Session is invalid or expired" });
    }
    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

export { protect };
