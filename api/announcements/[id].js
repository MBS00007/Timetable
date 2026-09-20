/**
 * Vercel serverless function for /api/announcements/[id]
 * Handles: GET, PUT, DELETE /api/announcements/:id
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

  const { id } = req.query;
  if (!id) {
    return sendError(res, 400, "Announcement ID is required.");
  }

  try {
    if (req.method === "GET") {
      const result = await pool.query(`${announcementSelect} WHERE id = $1`, [id]);
      if (!result.rowCount) {
        return sendError(res, 404, "Announcement not found");
      }
      const row = result.rows[0];
      return sendJson(res, 200, { ...row, copy: row.content });
    }

    // Write operations require auth
    const auth = await requireClassRepOrAdmin(req, res);
    if (!auth) return;

    if (req.method === "PUT") {
      const body = await parseBody(req);
      const { title, content, type, published } = body;

      if (!title || !content || !type) {
        return sendError(res, 400, "Title, content, and type are required.");
      }
      if (!ALLOWED_TYPES.includes(type)) {
        return sendError(res, 400, `Invalid announcement type. Allowed types: ${ALLOWED_TYPES.join(", ")}.`);
      }

      const isPublished = published !== undefined ? Boolean(published) : true;
      const updateResult = await pool.query(
        `UPDATE announcements
         SET title = $1, content = $2, type = $3, published = $4, updated_at = NOW()
         WHERE id = $5
         RETURNING id`,
        [title, content, type, isPublished, id]
      );
      if (!updateResult.rowCount) {
        return sendError(res, 404, "Announcement not found");
      }

      const fullResult = await pool.query(`${announcementSelect} WHERE id = $1`, [id]);
      const row = fullResult.rows[0];
      return sendJson(res, 200, { ...row, copy: row.content });
    }

    if (req.method === "DELETE") {
      const result = await pool.query(
        `DELETE FROM announcements WHERE id = $1 RETURNING id`,
        [id]
      );
      if (!result.rowCount) {
        return sendError(res, 404, "Announcement not found");
      }
      return sendJson(res, 200, { message: "Announcement deleted successfully", id: result.rows[0].id });
    }

    res.setHeader("Allow", "GET, PUT, DELETE, OPTIONS");
    return sendError(res, 405, "Method Not Allowed");
  } catch (err) {
    console.error("Announcements [id] API error:", err);
    return sendError(res, 500, "Internal server error");
  }
};
