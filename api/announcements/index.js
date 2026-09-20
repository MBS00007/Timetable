/**
 * Vercel serverless function for /api/announcements
 * Handles: GET /api/announcements, POST /api/announcements
 * Backed by PostgreSQL database (Supabase).
 */
const pool = require("../_lib/db");
const { requireClassRepOrAdmin } = require("../_lib/auth");
const { setCorsHeaders, sendJson, sendError, parseBody } = require("../_lib/handler");

const announcementSelect = `
  SELECT id, title, content, type, published,
         TO_CHAR(created_at, 'DD Mon YYYY') AS date,
         created_at, updated_at
  FROM announcements
`;

const ALLOWED_TYPES = ["Room change", "Reminder", "Notice", "Cancellation"];

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET") {
      const result = await pool.query(
        `${announcementSelect} WHERE published = TRUE ORDER BY created_at DESC`
      );
      return sendJson(res, 200, result.rows.map((row) => ({ ...row, copy: row.content })));
    }

    if (req.method === "POST") {
      const auth = await requireClassRepOrAdmin(req, res);
      if (!auth) return;

      const body = await parseBody(req);
      const { title, content, type, published } = body;

      if (!title || !content || !type) {
        return sendError(res, 400, "Title, content, and type are required.");
      }
      if (!ALLOWED_TYPES.includes(type)) {
        return sendError(res, 400, `Invalid announcement type. Allowed types: ${ALLOWED_TYPES.join(", ")}.`);
      }

      const isPublished = published !== undefined ? Boolean(published) : true;
      const insertResult = await pool.query(
        `INSERT INTO announcements (title, content, type, published)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [title, content, type, isPublished]
      );

      const fullResult = await pool.query(
        `${announcementSelect} WHERE id = $1`,
        [insertResult.rows[0].id]
      );
      const row = fullResult.rows[0];
      return sendJson(res, 201, { ...row, copy: row.content });
    }

    res.setHeader("Allow", "GET, POST, OPTIONS");
    return sendError(res, 405, "Method Not Allowed");
  } catch (err) {
    console.error("Announcements API error:", err);
    return sendError(res, 500, "Internal server error");
  }
};
