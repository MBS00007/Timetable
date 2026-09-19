/**
 * Vercel serverless function for /api/timetable/[id]
 * Handles: GET /:id, PUT /:id, DELETE /:id
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
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

  const { id } = req.query;
  if (!id) return sendError(res, 400, "Missing timetable entry ID");

  try {
    // GET - public, no auth required
    if (req.method === "GET") {
      const result = await pool.query(`${timetableSelect} WHERE t.id = $1`, [id]);
      if (!result.rowCount) return sendError(res, 404, "Timetable entry not found");
      return sendJson(res, 200, result.rows[0]);
    }

    // PUT and DELETE require class_rep or admin auth
    if (req.method === "PUT") {
      const auth = await requireClassRepOrAdmin(req, res);
      if (!auth) return; // auth function already sent the error response

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
      if (!courseCheck.rowCount) return sendError(res, 400, "Selected course does not exist.");

      const updateResult = await pool.query(
        `UPDATE timetable SET course_id = $1, day = $2, start_time = $3, end_time = $4, venue = $5, updated_at = NOW() WHERE id = $6 RETURNING id`,
        [course_id, day, start, end, venue, id]
      );
      if (!updateResult.rowCount) return sendError(res, 404, "Timetable entry not found");

      const fullResult = await pool.query(`${timetableSelect} WHERE t.id = $1`, [id]);
      return sendJson(res, 200, fullResult.rows[0]);
    }

    if (req.method === "DELETE") {
      const auth = await requireClassRepOrAdmin(req, res);
      if (!auth) return;

      const result = await pool.query(`DELETE FROM timetable WHERE id = $1 RETURNING id`, [id]);
      if (!result.rowCount) return sendError(res, 404, "Timetable entry not found");
      return sendJson(res, 200, { message: "Timetable entry deleted successfully", id: result.rows[0].id });
    }

    res.setHeader("Allow", "GET, PUT, DELETE, OPTIONS");
    return sendError(res, 405, "Method Not Allowed");
  } catch (err) {
    console.error("Timetable [id] error:", err);
    return sendError(res, 500, "Internal server error");
  }
};
