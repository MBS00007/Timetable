const fs = require("node:fs");
const path = require("node:path");
const pool = require("./pool");
const source = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../../data.json"), "utf8"),
);
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
const announcementDates = ["2026-09-08", "2026-09-02", "2026-08-28"];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(schema);
    await client.query(
      "TRUNCATE timetable, announcements, courses RESTART IDENTITY CASCADE",
    );
    const courseIds = new Map();
    for (const item of source.timetable) {
      if (courseIds.has(item.code)) continue;
      const result = await client.query(
        `INSERT INTO courses (code, name, lecturer) VALUES ($1, $2, $3) RETURNING id`,
        [item.code, item.name, item.lecturer],
      );
      courseIds.set(item.code, result.rows[0].id);
    }
    for (const item of source.timetable) {
      await client.query(
        `INSERT INTO timetable (course_id, day, start_time, end_time, venue) VALUES ($1, $2, $3, $4, $5)`,
        [courseIds.get(item.code), item.day, item.start, item.end, item.venue],
      );
    }
    for (let index = 0; index < source.announcements.length; index += 1) {
      const item = source.announcements[index];
      await client.query(
        `INSERT INTO announcements (title, content, type, published, created_at) VALUES ($1, $2, $3, TRUE, $4)`,
        [
          item.title,
          item.copy,
          item.type,
          `${announcementDates[index]}T09:00:00Z`,
        ],
      );
    }
    await client.query("COMMIT");
    console.log(
      `Seeded ${courseIds.size} courses, ${source.timetable.length} timetable entries, and ${source.announcements.length} announcements.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
