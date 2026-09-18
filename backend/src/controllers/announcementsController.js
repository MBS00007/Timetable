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

async function listAllAnnouncements(request, response, next) {
  try {
    const result = await pool.query(
      `${announcementSelect} ORDER BY created_at DESC`,
    );
    response.json(result.rows.map((row) => ({ ...row, copy: row.content })));
  } catch (error) {
    next(error);
  }
}

async function getAnnouncement(request, response, next) {
  try {
    const result = await pool.query(
      `${announcementSelect} WHERE id = $1`,
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

const ALLOWED_TYPES = ["Room change", "Reminder", "Notice", "Cancellation"];


async function createAnnouncement(request, response, next) {
  try {
    const { title, content, type, published } = request.body;
    if (!title || !content || !type) {
      return response.status(400).json({ error: "Title, content, and type are required." });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return response.status(400).json({
        error: `Invalid announcement type. Allowed types: ${ALLOWED_TYPES.join(", ")}.`,
      });
    }
    const isPublished = published !== undefined ? Boolean(published) : true;
    const insertResult = await pool.query(
      `INSERT INTO announcements (title, content, type, published)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [title, content, type, isPublished]
    );

    const fullResult = await pool.query(`${announcementSelect} WHERE id = $1`, [insertResult.rows[0].id]);
    const row = fullResult.rows[0];
    response.status(201).json({ ...row, copy: row.content });
  } catch (error) {
    next(error);
  }
}

async function updateAnnouncement(request, response, next) {
  try {
    const { id } = request.params;
    const { title, content, type, published } = request.body;
    if (!title || !content || !type) {
      return response.status(400).json({ error: "Title, content, and type are required." });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return response.status(400).json({
        error: `Invalid announcement type. Allowed types: ${ALLOWED_TYPES.join(", ")}.`,
      });
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
      return response.status(404).json({ error: "Announcement not found" });
    }

    const fullResult = await pool.query(`${announcementSelect} WHERE id = $1`, [id]);
    const row = fullResult.rows[0];
    response.json({ ...row, copy: row.content });

  } catch (error) {
    next(error);
  }
}

async function deleteAnnouncement(request, response, next) {
  try {
    const { id } = request.params;
    const result = await pool.query(`DELETE FROM announcements WHERE id = $1 RETURNING id`, [id]);
    if (!result.rowCount) {
      return response.status(404).json({ error: "Announcement not found" });
    }
    response.json({ message: "Announcement deleted successfully", id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAnnouncements,
  listAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
