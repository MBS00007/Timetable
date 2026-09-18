const pool = require("../db/pool");

async function listCourses(request, response, next) {
  try {
    const result = await pool.query(`
      SELECT id, code, name, lecturer, description, pdf_url, pdf_filename, tone, created_at, updated_at
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
      `SELECT id, code, name, lecturer, description, pdf_url, pdf_filename, tone, created_at, updated_at FROM courses WHERE id = $1`,
      [request.params.id],
    );
    if (!result.rowCount)
      return response.status(404).json({ error: "Course not found" });
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function createCourse(request, response, next) {
  try {
    const { code, name, lecturer, description, pdf_url, pdf_filename, tone } = request.body;
    if (!code || !name) {
      return response.status(400).json({ error: "Course code and name are required." });
    }
    const result = await pool.query(
      `INSERT INTO courses (code, name, lecturer, description, pdf_url, pdf_filename, tone)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, code, name, lecturer, description, pdf_url, pdf_filename, tone, created_at, updated_at`,
      [code, name, lecturer || null, description || null, pdf_url || null, pdf_filename || null, tone || 'teal']
    );
    response.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function updateCourse(request, response, next) {
  try {
    const { id } = request.params;
    const { code, name, lecturer, description, pdf_url, pdf_filename, tone } = request.body;
    if (!code || !name) {
      return response.status(400).json({ error: "Course code and name are required." });
    }
    const result = await pool.query(
      `UPDATE courses
       SET code = $1, name = $2, lecturer = $3, description = $4, pdf_url = $5, pdf_filename = $6, tone = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING id, code, name, lecturer, description, pdf_url, pdf_filename, tone, created_at, updated_at`,
      [code, name, lecturer || null, description || null, pdf_url || null, pdf_filename || null, tone || 'teal', id]
    );
    if (!result.rowCount) {
      return response.status(404).json({ error: "Course not found" });
    }
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function deleteCourse(request, response, next) {
  try {
    const { id } = request.params;
    // Check if course is referenced in timetable
    const checkRef = await pool.query(`SELECT COUNT(*) FROM timetable WHERE course_id = $1`, [id]);
    if (parseInt(checkRef.rows[0].count, 10) > 0) {
      return response.status(400).json({
        error: "Cannot delete course: it is currently scheduled in the timetable. Delete the timetable entries first."
      });
    }

    const result = await pool.query(`DELETE FROM courses WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) {
      return response.status(404).json({ error: "Course not found" });
    }
    response.json({ message: "Course deleted successfully", id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, deleteCourse };
