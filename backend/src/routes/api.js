const express = require("express");
const { listCourses, getCourse } = require("../controllers/coursesController");
const {
  listTimetable,
  getTimetableEntry,
} = require("../controllers/timetableController");
const {
  listAnnouncements,
  getAnnouncement,
} = require("../controllers/announcementsController");

const router = express.Router();
router.get("/courses", listCourses);
router.get("/courses/:id", getCourse);
router.get("/timetable", listTimetable);
router.get("/timetable/:id", getTimetableEntry);
router.get("/announcements", listAnnouncements);
router.get("/announcements/:id", getAnnouncement);

module.exports = router;
