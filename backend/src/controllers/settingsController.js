const pool = require("../db/pool");

const settingsSelect = `
  SELECT university, faculty, department, semester, session,
         TO_CHAR(valid_through, 'YYYY-MM-DD') AS "validThroughRaw",
         TO_CHAR(last_lecture_date, 'YYYY-MM-DD') AS "lastLectureDateRaw",
         TO_CHAR(valid_through, 'DD Month YYYY') AS "validThrough",
         TO_CHAR(last_lecture_date, 'DD Month YYYY') AS "lastLectureDate",
         created_at, updated_at
  FROM settings
  ORDER BY id
  LIMIT 1
`;

async function getSettings(request, response, next) {
  try {
    const result = await pool.query(settingsSelect);
    if (!result.rowCount) {
      return response.status(404).json({ error: "Settings not configured" });
    }
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function updateSettings(request, response, next) {
  try {
    const { university, faculty, department, semester, session, valid_through, last_lecture_date } = request.body;
    if (!university || !faculty || !department || !semester || !session || !valid_through || !last_lecture_date) {
      return response.status(400).json({ error: "All setting fields are required." });
    }

    // Check if settings record exists
    const check = await pool.query(`SELECT id FROM settings ORDER BY id LIMIT 1`);
    if (check.rowCount === 0) {
      await pool.query(
        `INSERT INTO settings (university, faculty, department, semester, session, valid_through, last_lecture_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [university, faculty, department, semester, session, valid_through, last_lecture_date]
      );
    } else {
      const id = check.rows[0].id;
      await pool.query(
        `UPDATE settings
         SET university = $1, faculty = $2, department = $3, semester = $4, session = $5,
             valid_through = $6, last_lecture_date = $7, updated_at = NOW()
         WHERE id = $8`,
        [university, faculty, department, semester, session, valid_through, last_lecture_date, id]
      );
    }

    const result = await pool.query(settingsSelect);
    response.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

module.exports = { getSettings, updateSettings };
