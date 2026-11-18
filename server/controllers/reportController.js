import pool from "../config/db.js";
import { getMonthDates, getToday, validateDate } from "../config/dates.js";

export const getReport = async (req, res, next) => {
  const daily = req.route.path === "/daily";
  const date = req.query.date ?? getToday();
  const message = validateDate(date);
  if (message) return res.status(400).json({ success: false, message });

  const { startDate, endDate } = daily
    ? { startDate: date, endDate: date }
    : getMonthDates(date, req.route.path === "/previous-month");

  try {
    const dailyReadings = daily
      ? `, COALESCE(json_agg(json_build_object(
           'id', id, 'date', to_char(reading_date, 'YYYY-MM-DD'), 'slot', slot, 'glucose', glucose::float8
         ) ORDER BY array_position(ARRAY['Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner'], slot)), '[]'::json) AS readings`
      : "";
    const { rows } = await pool.query(
      `SELECT min(glucose)::float8 AS min, max(glucose)::float8 AS max,
              round(avg(glucose), 1)::float8 AS average, count(*)::integer AS count
              ${dailyReadings}
       FROM readings
       WHERE user_id = $1 AND reading_date BETWEEN $2::date AND $3::date`,
      [req.user.id, startDate, endDate],
    );
    const report = { startDate, endDate, ...rows[0] };
    return res.json({
      success: true,
      report,
      ...(report.count === 0 ? { message: "No readings for this period" } : {}),
    });
  } catch (error) {
    next(error);
  }
};
