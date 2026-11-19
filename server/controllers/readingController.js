import pool from "../config/db.js";
import { validateDate } from "../config/dates.js";

const slots = ["Morning (fasting)", "After breakfast", "After lunch", "After dinner"];

const validateReading = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Provide a valid request body";
  }
  if (Object.keys(body).some((key) => !["date", "slot", "glucose"].includes(key))) {
    return "Unexpected field in request body";
  }
  const dateError = validateDate(body.date);
  if (dateError) return dateError;
  if (!slots.includes(body.slot)) {
    return "Select one of the four time slots";
  }
  if (!Number.isInteger(body.glucose) || body.glucose < 40 || body.glucose > 600) {
    return "Glucose must be a whole number from 40 to 600 mg/dL";
  }
  return null;
};

export const getReadings = async (req, res, next) => {
  const { date } = req.query;
  if (date !== undefined) {
    const message = validateDate(date);
    if (message) return res.status(400).json({ success: false, message });
  }
  const pageValue = req.query.page ?? "1";
  const limitValue = req.query.limit ?? "10";
  if (typeof pageValue !== "string" || !/^[1-9]\d*$/.test(pageValue) || Number(pageValue) > 1000000) {
    return res.status(400).json({ success: false, message: "Page must be an integer from 1 to 1000000" });
  }
  if (typeof limitValue !== "string" || !/^[1-9]\d*$/.test(limitValue) || Number(limitValue) > 100) {
    return res.status(400).json({ success: false, message: "Limit must be an integer from 1 to 100" });
  }
  const page = Number(pageValue);
  const limit = Number(limitValue);
  const offset = (page - 1) * limit;

  try {
    const { rows: count } = await pool.query(
      "SELECT count(*)::integer AS total FROM readings WHERE user_id = $1 AND ($2::date IS NULL OR reading_date = $2::date)",
      [req.user.id, date ?? null],
    );
    const { rows } = await pool.query(
      `SELECT id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, glucose::float8 AS glucose
       FROM readings
       WHERE user_id = $1 AND ($2::date IS NULL OR reading_date = $2::date)
       ORDER BY reading_date DESC, array_position($3::text[], slot)
       LIMIT $4 OFFSET $5`,
      [req.user.id, date ?? null, slots, limit, offset],
    );
    const total = count[0].total;
    return res.json({
      success: true,
      readings: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

export const addReading = async (req, res, next) => {
  const message = validateReading(req.body);
  if (message) return res.status(400).json({ success: false, message });

  try {
    const { date, slot, glucose } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO readings (user_id, reading_date, slot, glucose) VALUES ($1, $2, $3, $4)
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, glucose::float8 AS glucose`,
      [req.user.id, date, slot, glucose],
    );
    return res.status(201).json({ success: true, reading: rows[0], message: "Reading added" });
  } catch (error) {
    if (error.code === "23505" && error.constraint === "readings_user_date_slot_key") {
      return res.status(409).json({ success: false, message: "A reading already exists for this date and time slot" });
    }
    next(error);
  }
};

export const updateReading = async (req, res, next) => {
  const message = validateReading(req.body);
  if (message) return res.status(400).json({ success: false, message });

  try {
    const { date, slot, glucose } = req.body;
    const { rows } = await pool.query(
      `UPDATE readings SET reading_date = $1, slot = $2, glucose = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, to_char(reading_date, 'YYYY-MM-DD') AS date, slot, glucose::float8 AS glucose`,
      [date, slot, glucose, req.params.id, req.user.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: "Reading not found" });
    }
    return res.json({ success: true, reading: rows[0], message: "Reading updated" });
  } catch (error) {
    if (error.code === "23505" && error.constraint === "readings_user_date_slot_key") {
      return res.status(409).json({ success: false, message: "A reading already exists for this date and time slot" });
    }
    next(error);
  }
};

export const deleteReading = async (req, res, next) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM readings WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: "Reading not found" });
    }
    return res.json({ success: true, message: "Reading deleted" });
  } catch (error) {
    next(error);
  }
};
