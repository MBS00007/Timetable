const pool = require("../db/pool");

const announcementSelect = `
  SELECT id, title, content, type, published,
         TO_CHAR(created_at, 'DD Mon YYYY') AS date,
         created_at, updated_at
  FROM announcements
`;

async function listAnnouncements(request, response, next) {
  try {
    const result = await pool.query(
      `${announcementSelect} WHERE published = TRUE ORDER BY created_at DESC`,
    );
    response.json(result.rows.map((row) => ({ ...row, copy: row.content })));
  } catch (error) {
    next(error);
  }
}

async function getAnnouncement(request, response, next) {
  try {
    const result = await pool.query(
      `${announcementSelect} WHERE id = $1 AND published = TRUE`,
      [request.params.id],
    );
    if (!result.rowCount)
      return response.status(404).json({ error: "Announcement not found" });
    const row = result.rows[0];
    response.json({ ...row, copy: row.content });
  } catch (error) {
    next(error);
  }
}

module.exports = { listAnnouncements, getAnnouncement };
