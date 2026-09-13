const pool = require("../db/pool");

const timetableSelect = `
  SELECT t.id, t.course_id, c.code, c.name, c.lecturer, c.description,
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

module.exports = { listTimetable, getTimetableEntry };
