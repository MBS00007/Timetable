const pool = require("../db/pool");

async function listCourses(request, response, next) {
  try {
    const result = await pool.query(`
      SELECT id, code, name, lecturer, description, pdf_url, pdf_filename, created_at, updated_at
      FROM courses
      ORDER BY code
    `);
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function getCourse(request, response, next) {
  try {
    const result = await pool.query(
      `SELECT id, code, name, lecturer, description, pdf_url, pdf_filename, created_at, updated_at FROM courses WHERE id = $1`,
      [request.params.id],
    );
    if (!result.rowCount)
      return response.status(404).json({ error: "Course not found" });
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

module.exports = { listCourses, getCourse };
