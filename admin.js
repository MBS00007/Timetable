const SUPABASE_URL = "https://swcfymujkdmicmueoedp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3Y2Z5bXVqa2RtaWNtdWVvZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTcwMDEsImV4cCI6MjEwNDg5MzAwMX0.t_Vvf7GVyOG0VD4VFdskr5zQC159NMYrxAJV6o_WS3k";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const API_BASE = window.__API_BASE__ !== undefined
  ? window.__API_BASE__
  : (typeof window !== "undefined" &&
     (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
     window.location.port &&
     window.location.port !== "4000"
      ? `http://${window.location.hostname}:4000`
      : (typeof window !== "undefined" && window.location.protocol === "file:" ? "http://127.0.0.1:4000" : ""));



let currentSession = null;
let courses = [];
let timetable = [];
let announcements = [];
let settings = null;

function showToast(message) {
  const toast = document.querySelector(".toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

async function getAuthHeader() {
  if (!currentSession) {
    const { data } = await supabaseClient.auth.getSession();
    currentSession = data.session;
  }
  return currentSession
    ? { Authorization: `Bearer ${currentSession.access_token}` }
    : {};
}

async function fetchApi(path, options = {}) {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text };
    }
  }

  if (response.status === 401 || response.status === 403) {
    const errorMsg = data && data.error ? data.error : `HTTP ${response.status}`;
    showToast(`Access Denied: ${errorMsg}`);
    if (response.status === 401) {
      await supabaseClient.auth.signOut();
      updateUIForAuth(null);
    }
    throw new Error(errorMsg);
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : text || `HTTP ${response.status}`;
    throw new Error(`HTTP ${response.status}: ${errorMsg}`);
  }
  return data;
}


// UI State Management
function updateUIForAuth(session) {
  currentSession = session;
  const loginView = document.querySelector("#view-login");
  const dashboardView = document.querySelector("#view-dashboard");

  if (session && session.user) {
    loginView.style.display = "none";
    dashboardView.style.display = "block";
    document.querySelector("#admin-user-email").textContent = session.user.email;
    initializeDashboard();
  } else {
    loginView.style.display = "block";
    dashboardView.style.display = "none";
  }
}

// Auth Handlers
document.querySelector("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorEl = document.querySelector("#login-error");
  if (errorEl) {
    errorEl.style.display = "none";
    errorEl.textContent = "";
  }
  const email = document.querySelector("#login-email").value.trim();
  const password = document.querySelector("#login-password").value;

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast("Login successful");
    updateUIForAuth(data.session);
  } catch (err) {
    if (errorEl) {
      errorEl.textContent = err.message || "Invalid login credentials";
      errorEl.style.display = "block";
    }
    showToast("Login failed: " + err.message);
  }
});

document.querySelector("#btn-logout")?.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showToast("Signed out");
  updateUIForAuth(null);
});

// Tab Switching
document.querySelectorAll("#admin-tabs .day-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#admin-tabs .day-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    const targetTab = tab.dataset.tab;
    document.querySelectorAll(".admin-tab-content").forEach((section) => {
      section.style.display = section.id === `tab-${targetTab}` ? "block" : "none";
    });
  });
});

// Loaders
async function loadCourses() {
  try {
    courses = await fetchApi("/api/courses");
    renderCoursesTable();
    populateCourseDropdown();
  } catch (err) {
    console.error("Failed to load courses:", err);
  }
}

async function loadTimetable() {
  try {
    timetable = await fetchApi("/api/timetable");
    renderTimetableTable();
  } catch (err) {
    console.error("Failed to load timetable:", err);
  }
}

async function loadAnnouncements() {
  try {
    announcements = await fetchApi("/api/admin/announcements");
    renderAnnouncementsTable();
  } catch (err) {
    console.error("Failed to load announcements:", err);
  }
}

async function loadSettings() {
  try {
    settings = await fetchApi("/api/settings");
    populateSettingsForm();
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

// Renderers
function renderCoursesTable() {
  const tbody = document.querySelector("#courses-table-body");
  if (!courses.length) {
    tbody.innerHTML = `<tr><td colspan="6">No courses found. Add your first course above.</td></tr>`;
    return;
  }
  tbody.innerHTML = courses
    .map(
      (c) => `
    <tr>
      <td><strong>${c.code}</strong></td>
      <td>${c.name}</td>
      <td>${c.lecturer || "—"}</td>
      <td><span class="class-accent ${c.tone || "teal"}" style="display:inline-block; width:12px; height:12px; border-radius:50%; margin-right:6px;"></span>${c.tone || "teal"}</td>
      <td>${c.pdf_filename || c.pdf_url ? "📄 Yes" : "—"}</td>
      <td class="actions">
        <button class="action-btn edit" onclick="editCourse('${c.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteCourse('${c.id}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function renderTimetableTable() {
  const tbody = document.querySelector("#timetable-table-body");
  if (!timetable.length) {
    tbody.innerHTML = `<tr><td colspan="6">No timetable slots scheduled.</td></tr>`;
    return;
  }
  tbody.innerHTML = timetable
    .map(
      (t) => `
    <tr>
      <td><strong>${t.day}</strong></td>
      <td>${t.start} – ${t.end}</td>
      <td><strong>${t.code}</strong> · ${t.name}</td>
      <td>${t.venue}</td>
      <td>${t.lecturer || "—"}</td>
      <td class="actions">
        <button class="action-btn edit" onclick="editTimetable('${t.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteTimetable('${t.id}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function renderAnnouncementsTable() {
  const tbody = document.querySelector("#announcements-table-body");
  if (!announcements.length) {
    tbody.innerHTML = `<tr><td colspan="5">No announcements created.</td></tr>`;
    return;
  }
  tbody.innerHTML = announcements
    .map(
      (a) => `
    <tr>
      <td>${a.date || "—"}</td>
      <td><strong>${a.type}</strong></td>
      <td>${a.title}</td>
      <td>${a.published ? '<span class="badge-published">Published</span>' : '<span class="badge-draft">Draft</span>'}</td>
      <td class="actions">
        <button class="action-btn edit" onclick="editAnnouncement('${a.id}')">Edit</button>
        <button class="action-btn delete" onclick="deleteAnnouncement('${a.id}')">Delete</button>
      </td>
    </tr>
  `
    )
    .join("");
}

function populateSettingsForm() {
  if (!settings) return;
  document.querySelector("#set-university").value = settings.university || "";
  document.querySelector("#set-faculty").value = settings.faculty || "";
  document.querySelector("#set-department").value = settings.department || "";
  document.querySelector("#set-semester").value = settings.semester || "";
  document.querySelector("#set-session").value = settings.session || "";
  if (settings.validThroughRaw) {
    document.querySelector("#set-valid-through").value = settings.validThroughRaw;
  }
  if (settings.lastLectureDateRaw) {
    document.querySelector("#set-last-lecture").value = settings.lastLectureDateRaw;
  }
}

function populateCourseDropdown() {
  const select = document.querySelector("#timetable-course-id");
  select.innerHTML =
    '<option value="">Select a course...</option>' +
    courses
      .map((c) => `<option value="${c.id}">${c.code} - ${c.name}</option>`)
      .join("");
}

// Course Actions
const modalCourse = document.querySelector("#modal-course");
document.querySelector("#btn-add-course").addEventListener("click", () => {
  document.querySelector("#modal-course-title").textContent = "Add New Course";
  document.querySelector("#form-course").reset();
  document.querySelector("#course-id").value = "";
  modalCourse.showModal();
});
document.querySelector("#close-modal-course").addEventListener("click", () => modalCourse.close());

document.querySelector("#form-course").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.querySelector("#course-id").value;
  const payload = {
    code: document.querySelector("#course-code").value.trim(),
    name: document.querySelector("#course-name").value.trim(),
    lecturer: document.querySelector("#course-lecturer").value.trim(),
    description: document.querySelector("#course-description").value.trim(),
    pdf_url: document.querySelector("#course-pdf-url").value.trim(),
    pdf_filename: document.querySelector("#course-pdf-filename").value.trim(),
    tone: document.querySelector("#course-tone").value,
  };

  try {
    if (id) {
      await fetchApi(`/api/courses/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Course updated successfully");
    } else {
      await fetchApi("/api/courses", { method: "POST", body: JSON.stringify(payload) });
      showToast("Course created successfully");
    }
    modalCourse.close();
    await loadCourses();
    await loadTimetable();
  } catch (err) {
    console.error("Error saving course:", err);
  }
});

window.editCourse = (id) => {
  const course = courses.find((c) => String(c.id) === String(id));
  if (!course) return;
  document.querySelector("#modal-course-title").textContent = "Edit Course";
  document.querySelector("#course-id").value = course.id;
  document.querySelector("#course-code").value = course.code;
  document.querySelector("#course-name").value = course.name;
  document.querySelector("#course-lecturer").value = course.lecturer || "";
  document.querySelector("#course-description").value = course.description || "";
  document.querySelector("#course-pdf-url").value = course.pdf_url || "";
  document.querySelector("#course-pdf-filename").value = course.pdf_filename || "";
  document.querySelector("#course-tone").value = course.tone || "teal";
  modalCourse.showModal();
};

window.deleteCourse = async (id) => {
  if (!confirm("Are you sure you want to delete this course?")) return;
  try {
    await fetchApi(`/api/courses/${id}`, { method: "DELETE" });
    showToast("Course deleted successfully");
    await loadCourses();
    await loadTimetable();
  } catch (err) {
    console.error("Delete course failed:", err);
  }
};

// Timetable Actions
const modalTimetable = document.querySelector("#modal-timetable");
document.querySelector("#btn-add-timetable").addEventListener("click", () => {
  document.querySelector("#modal-timetable-title").textContent = "Add Timetable Slot";
  document.querySelector("#form-timetable").reset();
  document.querySelector("#timetable-id").value = "";
  modalTimetable.showModal();
});
document.querySelector("#close-modal-timetable").addEventListener("click", () => modalTimetable.close());

document.querySelector("#form-timetable").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.querySelector("#timetable-id").value;
  const payload = {
    course_id: document.querySelector("#timetable-course-id").value,
    day: document.querySelector("#timetable-day").value,
    venue: document.querySelector("#timetable-venue").value.trim(),
    start: document.querySelector("#timetable-start").value,
    end: document.querySelector("#timetable-end").value,
  };

  try {
    if (id) {
      await fetchApi(`/api/timetable/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Timetable slot updated successfully");
    } else {
      await fetchApi("/api/timetable", { method: "POST", body: JSON.stringify(payload) });
      showToast("Timetable slot created successfully");
    }
    modalTimetable.close();
    await loadTimetable();
  } catch (err) {
    console.error("Error saving slot:", err);
  }
});

window.editTimetable = (id) => {
  const entry = timetable.find((t) => String(t.id) === String(id));
  if (!entry) return;
  document.querySelector("#modal-timetable-title").textContent = "Edit Timetable Slot";
  document.querySelector("#timetable-id").value = entry.id;
  document.querySelector("#timetable-course-id").value = entry.course_id;
  document.querySelector("#timetable-day").value = entry.day;
  document.querySelector("#timetable-venue").value = entry.venue;
  document.querySelector("#timetable-start").value = entry.start;
  document.querySelector("#timetable-end").value = entry.end;
  modalTimetable.showModal();
};

window.deleteTimetable = async (id) => {
  if (!confirm("Are you sure you want to delete this timetable slot?")) return;
  try {
    await fetchApi(`/api/timetable/${id}`, { method: "DELETE" });
    showToast("Timetable slot deleted");
    await loadTimetable();
  } catch (err) {
    console.error("Delete timetable failed:", err);
  }
};

// Announcement Actions
const modalAnnouncement = document.querySelector("#modal-announcement");
document.querySelector("#btn-add-announcement").addEventListener("click", () => {
  document.querySelector("#modal-announcement-title").textContent = "Add Announcement";
  document.querySelector("#form-announcement").reset();
  document.querySelector("#announcement-id").value = "";
  modalAnnouncement.showModal();
});
document.querySelector("#close-modal-announcement").addEventListener("click", () => modalAnnouncement.close());

document.querySelector("#form-announcement").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.querySelector("#announcement-id").value;
  const payload = {
    type: document.querySelector("#announcement-type").value,
    published: document.querySelector("#announcement-published").value === "true",
    title: document.querySelector("#announcement-title").value.trim(),
    content: document.querySelector("#announcement-content").value.trim(),
  };

  try {
    if (id) {
      await fetchApi(`/api/announcements/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Announcement updated successfully");
    } else {
      await fetchApi("/api/announcements", { method: "POST", body: JSON.stringify(payload) });
      showToast("Announcement created successfully");
    }
    modalAnnouncement.close();
    await loadAnnouncements();
  } catch (err) {
    console.error("Error saving announcement:", err);
  }
});

window.editAnnouncement = (id) => {
  const item = announcements.find((a) => String(a.id) === String(id));
  if (!item) return;
  document.querySelector("#modal-announcement-title").textContent = "Edit Announcement";
  document.querySelector("#announcement-id").value = item.id;
  document.querySelector("#announcement-type").value = item.type;
  document.querySelector("#announcement-published").value = item.published ? "true" : "false";
  document.querySelector("#announcement-title").value = item.title;
  document.querySelector("#announcement-content").value = item.content || item.copy || "";
  modalAnnouncement.showModal();
};

window.deleteAnnouncement = async (id) => {
  if (!confirm("Are you sure you want to delete this announcement?")) return;
  try {
    await fetchApi(`/api/announcements/${id}`, { method: "DELETE" });
    showToast("Announcement deleted");
    await loadAnnouncements();
  } catch (err) {
    console.error("Delete announcement failed:", err);
  }
};

// Settings Actions
document.querySelector("#form-settings").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    university: document.querySelector("#set-university").value.trim(),
    faculty: document.querySelector("#set-faculty").value.trim(),
    department: document.querySelector("#set-department").value.trim(),
    semester: document.querySelector("#set-semester").value.trim(),
    session: document.querySelector("#set-session").value.trim(),
    valid_through: document.querySelector("#set-valid-through").value,
    last_lecture_date: document.querySelector("#set-last-lecture").value,
  };

  try {
    await fetchApi("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
    showToast("Settings updated successfully");
    await loadSettings();
  } catch (err) {
    console.error("Error updating settings:", err);
  }
});

async function initializeDashboard() {
  await Promise.all([loadCourses(), loadTimetable(), loadAnnouncements(), loadSettings()]);
}

// Initial Session Check
async function checkAuthSession() {
  if (!supabaseClient) return;
  const { data } = await supabaseClient.auth.getSession();
  updateUIForAuth(data.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateUIForAuth(session);
  });
}

checkAuthSession();
