/**
 * Vercel serverless function for /api/timetable (index)
 * Handles: GET /api/timetable, POST /api/timetable
 * Backed by PostgreSQL database (Supabase).
 */
const pool = require("../_lib/db");
const { requireClassRepOrAdmin } = require("../_lib/auth");
const { setCorsHeaders, sendJson, sendError, parseBody } = require("../_lib/handler");

const timetableSelect = `
  SELECT t.id, t.course_id, c.code, c.name, c.tone, c.lecturer, c.description,
         c.pdf_url, c.pdf_filename, t.day,
         TO_CHAR(t.start_time, 'HH24:MI') AS start,
         TO_CHAR(t.end_time, 'HH24:MI') AS "end",
         t.venue, t.created_at, t.updated_at
  FROM timetable t
  JOIN courses c ON c.id = t.course_id
`;

const ALLOWED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET") {
      const { day } = req.query || {};
      const values = [];
      let filter = "";
      if (day) {
        values.push(day);
        filter = `WHERE t.day = $${values.length}`;
      }
      const result = await pool.query(
        `${timetableSelect} ${filter} ORDER BY array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], t.day), t.start_time, c.code`,
        values
      );
      return sendJson(res, 200, result.rows);
    }

    if (req.method === "POST") {
      const auth = await requireClassRepOrAdmin(req, res);
      if (!auth) return;

      const body = await parseBody(req);
      const { course_id, day, venue } = body;
      const start = body.start || body.start_time;
      const end = body.end || body.end_time;

      if (!course_id || !day || !start || !end || !venue) {
        return sendError(res, 400, "course_id, day, start, end, and venue are required.");
      }
      if (!ALLOWED_DAYS.includes(day)) {
        return sendError(res, 400, `Invalid day. Allowed days: ${ALLOWED_DAYS.join(", ")}.`);
      }
      if (start >= end) {
        return sendError(res, 400, "End time must be strictly after start time.");
      }

      const courseCheck = await pool.query(`SELECT id FROM courses WHERE id = $1`, [course_id]);
      if (!courseCheck.rowCount) {
        return sendError(res, 400, "Selected course does not exist.");
      }

      const insertResult = await pool.query(
        `INSERT INTO timetable (course_id, day, start_time, end_time, venue)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [course_id, day, start, end, venue]
      );

      const fullResult = await pool.query(`${timetableSelect} WHERE t.id = $1`, [insertResult.rows[0].id]);
      return sendJson(res, 201, fullResult.rows[0]);
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendError(res, 405, "Method Not Allowed");
  } catch (err) {
    console.error("Timetable API error:", err);
    return sendError(res, 500, "Internal server error");
  }
};
