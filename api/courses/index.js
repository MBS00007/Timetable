const pool = require("../_lib/db");
const { setCorsHeaders, sendJson, sendError } = require("../_lib/handler");

module.exports = async (req, res) => {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return sendError(res, 405, "Method Not Allowed");
  }

  try {
    const result = await pool.query(
      `SELECT id, code, name, lecturer, description, pdf_url, pdf_filename, tone FROM courses ORDER BY code`
    );
    return sendJson(res, 200, result.rows);
  } catch (err) {
    console.error("Courses API error:", err);
    return sendError(res, 500, "Internal server error");
  }
};