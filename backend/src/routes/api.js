const express = require("express");
const { requireAdminAuth, requireClassRepOrAdminAuth } = require("../middleware/authMiddleware");
const {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
} = require("../controllers/coursesController");
const {
  listTimetable,
  getTimetableEntry,
  createTimetableEntry,
  updateTimetableEntry,
  deleteTimetableEntry,
} = require("../controllers/timetableController");
const {
  listAnnouncements,
  listAllAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require("../controllers/announcementsController");
const { getSettings, updateSettings } = require("../controllers/settingsController");

const router = express.Router();

// Public Student GET Endpoints (Unprotected)
router.get("/settings", getSettings);
router.get("/courses", listCourses);
router.get("/courses/:id", getCourse);
router.get("/timetable", listTimetable);
router.get("/timetable/:id", getTimetableEntry);
router.get("/announcements", listAnnouncements);
router.get("/announcements/:id", getAnnouncement);

// Protected Admin-Only Write Endpoints
router.put("/settings", requireAdminAuth, updateSettings);
router.post("/courses", requireAdminAuth, createCourse);
router.put("/courses/:id", requireAdminAuth, updateCourse);
router.delete("/courses/:id", requireAdminAuth, deleteCourse);

// Protected Class Rep & Admin Endpoints (Announcements & Timetable Management)
router.post("/timetable", requireClassRepOrAdminAuth, createTimetableEntry);
router.put("/timetable/:id", requireClassRepOrAdminAuth, updateTimetableEntry);
router.delete("/timetable/:id", requireClassRepOrAdminAuth, deleteTimetableEntry);

router.get("/admin/announcements", requireClassRepOrAdminAuth, listAllAnnouncements);
router.post("/announcements", requireClassRepOrAdminAuth, createAnnouncement);
router.put("/announcements/:id", requireClassRepOrAdminAuth, updateAnnouncement);
router.delete("/announcements/:id", requireClassRepOrAdminAuth, deleteAnnouncement);


module.exports = router;
