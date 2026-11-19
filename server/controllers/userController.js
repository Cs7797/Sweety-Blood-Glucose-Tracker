import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const generateToken = (userid) => {
  return jwt.sign({ userid }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
};

const validateUser = (body, register) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Provide a valid request body";
  }

  const fields = register ? ["name", "email", "password"] : ["email", "password"];
  if (Object.keys(body).some((key) => !fields.includes(key))) {
    return "Unexpected field in request body";
  }

  if (register && (typeof body.name !== "string" || !body.name.trim() || body.name.includes("\0") || body.name.trim().length > 80)) {
    return "Enter a valid name of 1 to 80 characters";
  }

  if (typeof body.email !== "string") {
    return "Enter a valid email address";
  }
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || email.includes("\0") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Enter a valid email address";
  }

  if (typeof body.password !== "string" || body.password.length < (register ? 8 : 1) || Buffer.byteLength(body.password, "utf8") > 72) {
    return register ? "Password must contain at least 8 characters and at most 72 bytes" : "Enter a password of at most 72 bytes";
  }

  return null;
};

export const registerUser = async (req, res, next) => {
  const message = validateUser(req.body, true);
  if (message) {
    return res.status(400).json({ success: false, message });
  }

  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name.trim(), email.trim().toLowerCase(), hashedPassword],
    );
    const user = rows[0];
    const token = generateToken(user.id);
    return res.status(201).json({ success: true, token, user, message: "Account created" });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ success: false, message: "An account with this email already exists" });
    }
    next(error);
  }
};

export const Login = async (req, res, next) => {
  const message = validateUser(req.body, false);
  if (message) {
    return res.status(400).json({ success: false, message });
  }

  try {
    const { email, password } = req.body;
    const { rows } = await pool.query("SELECT id, name, email, password FROM users WHERE email = $1", [email.trim().toLowerCase()]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = generateToken(user.id);
    return res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email },
      message: "Logged in",
    });
  } catch (error) {
    next(error);
  }
};

export const getUserData = (req, res) => {
  return res.json({ success: true, user: req.user });
};
