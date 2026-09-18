const pool = require("../db/pool");

const timetableSelect = `
  SELECT t.id, t.course_id, c.code, c.name, c.tone, c.lecturer, c.description,
         c.pdf_url, c.pdf_filename, t.day,
         TO_CHAR(t.start_time, 'HH24:MI') AS start,
         TO_CHAR(t.end_time, 'HH24:MI') AS "end",
         t.venue, t.created_at, t.updated_at
  FROM timetable t
  JOIN courses c ON c.id = t.course_id
`;

async function listTimetable(request, response, next) {
  try {
    const values = [];
    let filter = "";
    if (request.query.day) {
      values.push(request.query.day);
      filter = `WHERE t.day = $${values.length}`;
    }
    const result = await pool.query(
      `${timetableSelect} ${filter} ORDER BY array_position(ARRAY['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], t.day), t.start_time, c.code`,
      values,
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function getTimetableEntry(request, response, next) {
  try {
    const result = await pool.query(`${timetableSelect} WHERE t.id = $1`, [
      request.params.id,
    ]);
    if (!result.rowCount)
      return response.status(404).json({ error: "Timetable entry not found" });
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

const ALLOWED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];


async function createTimetableEntry(request, response, next) {
  try {
    const { course_id, day, start, end, venue } = request.body;
    if (!course_id || !day || !start || !end || !venue) {
      return response.status(400).json({ error: "course_id, day, start, end, and venue are required." });
    }

    if (!ALLOWED_DAYS.includes(day)) {
      return response.status(400).json({ error: `Invalid day. Allowed days: ${ALLOWED_DAYS.join(", ")}.` });
    }

    if (start >= end) {
      return response.status(400).json({ error: "End time must be strictly after start time." });
    }

    // Verify course exists
    const courseCheck = await pool.query(`SELECT id FROM courses WHERE id = $1`, [course_id]);
    if (!courseCheck.rowCount) {
      return response.status(400).json({ error: "Selected course does not exist." });
    }

    const insertResult = await pool.query(
      `INSERT INTO timetable (course_id, day, start_time, end_time, venue)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [course_id, day, start, end, venue]
    );

    const fullResult = await pool.query(`${timetableSelect} WHERE t.id = $1`, [insertResult.rows[0].id]);
    response.status(201).json(fullResult.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function updateTimetableEntry(request, response, next) {
  try {
    const { id } = request.params;
    const { course_id, day, start, end, venue } = request.body;
    if (!course_id || !day || !start || !end || !venue) {
      return response.status(400).json({ error: "course_id, day, start, end, and venue are required." });
    }

    if (!ALLOWED_DAYS.includes(day)) {
      return response.status(400).json({ error: `Invalid day. Allowed days: ${ALLOWED_DAYS.join(", ")}.` });
    }

    if (start >= end) {
      return response.status(400).json({ error: "End time must be strictly after start time." });
    }

    // Verify course exists
    const courseCheck = await pool.query(`SELECT id FROM courses WHERE id = $1`, [course_id]);
    if (!courseCheck.rowCount) {
      return response.status(400).json({ error: "Selected course does not exist." });
    }

    const updateResult = await pool.query(
      `UPDATE timetable
       SET course_id = $1, day = $2, start_time = $3, end_time = $4, venue = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING id`,
      [course_id, day, start, end, venue, id]
    );
    if (!updateResult.rowCount) {
      return response.status(404).json({ error: "Timetable entry not found" });
    }

    const fullResult = await pool.query(`${timetableSelect} WHERE t.id = $1`, [id]);
    response.json(fullResult.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function deleteTimetableEntry(request, response, next) {

  try {
    const { id } = request.params;
    const result = await pool.query(`DELETE FROM timetable WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) {
      return response.status(404).json({ error: "Timetable entry not found" });
    }
    response.json({ message: "Timetable entry deleted successfully", id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listTimetable,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
};
