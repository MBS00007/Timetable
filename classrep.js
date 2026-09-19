console.log("CLASSREP JS VERSION: 405-FIX-2");

const SUPABASE_URL = "https://swcfymujkdmicmueoedp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3Y2Z5bXVqa2RtaWNtdWVvZWRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMTcwMDEsImV4cCI6MjEwNDg5MzAwMX0.t_Vvf7GVyOG0VD4VFdskr5zQC159NMYrxAJV6o_WS3k";

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const API_BASE =
  window.__API_BASE__ !== undefined
    ? window.__API_BASE__
    : typeof window !== "undefined" &&
        (window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1") &&
        window.location.port &&
        window.location.port !== "4000"
      ? `http://${window.location.hostname}:4000`
      : typeof window !== "undefined" && window.location.protocol === "file:"
        ? "http://127.0.0.1:4000"
        : "";

let currentSession = null;
let courses = [];
let timetable = [];
let announcements = [];

function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
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
  const method = options.method || "GET";
  const fullUrl = `${API_BASE}${path}`;

  console.log(
    `[fetchApi Request] Method: ${method} | API_BASE: "${API_BASE}" | Full URL: "${fullUrl}"`,
  );

  const response = await fetch(fullUrl, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  console.log(`[fetchApi Response] Status: ${response.status} | Body:`, text);

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { error: text };
    }
  }

  if (response.status === 401 || response.status === 403) {
    const errorMsg =
      data && data.error ? data.error : `HTTP ${response.status}`;
    showToast(`Access Denied: ${errorMsg}`);
    if (response.status === 401) {
      await supabaseClient.auth.signOut();
      updateUIForAuth(null);
    }
    throw new Error(errorMsg);
  }

  if (!response.ok) {
    const errorMsg =
      data && data.error ? data.error : text || `HTTP ${response.status}`;
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
    document.querySelector("#classrep-user-email").textContent =
      session.user.email;
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
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
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
document.querySelectorAll("#classrep-tabs .day-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll("#classrep-tabs .day-tab")
      .forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    const targetTab = tab.dataset.tab;
    document.querySelectorAll(".admin-tab-content").forEach((section) => {
      section.style.display =
        section.id === `tab-${targetTab}` ? "block" : "none";
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

// Renderers
function renderCoursesTable() {
  const tbody = document.querySelector("#courses-table-body");
  if (!courses.length) {
    tbody.innerHTML = `<tr><td colspan="4">No courses registered.</td></tr>`;
    return;
  }
  tbody.innerHTML = courses
    .map(
      (c) => `
    <tr>
      <td><strong>${c.code}</strong></td>
      <td>${c.name}</td>
      <td>${c.lecturer || "—"}</td>
      <td>${c.pdf_filename || c.pdf_url ? "📄 Yes" : "—"}</td>
    </tr>
  `,
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
      (t) => {
        const slotId = t.id !== undefined && t.id !== null ? t.id : (t._id || "");
        return `
    <tr>
      <td><strong>${t.day}</strong></td>
      <td>${t.start} – ${t.end}</td>
      <td><strong>${t.code}</strong> · ${t.name}</td>
      <td>${t.venue}</td>
      <td>${t.lecturer || "—"}</td>
      <td class="actions">
        <button class="action-btn edit" onclick="editTimetable('${slotId}')">Edit</button>
        <button class="action-btn delete" onclick="deleteTimetable('${slotId}')">Delete</button>
      </td>
    </tr>
  `;
      },
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
  `,
    )
    .join("");
}

function populateCourseDropdown() {
  const select = document.querySelector("#timetable-course-id");
  select.innerHTML =
    '<option value="">Select a course...</option>' +
    courses
      .map((c) => `<option value="${c.id}">${c.code} - ${c.name}</option>`)
      .join("");
}

// Timetable Operations
window.editTimetable = function (id) {
  if (!id || id === "undefined" || id === "null") {
    showToast("Edit failed: Invalid or missing timetable ID");
    return;
  }
  const entry = timetable.find((t) => String(t.id ?? t._id) === String(id));
  if (!entry) return;

  document.querySelector("#modal-timetable-title").textContent =
    "Edit Timetable Slot";
  document.querySelector("#timetable-id").value = entry.id ?? entry._id ?? "";
  document.querySelector("#timetable-course-id").value = entry.course_id;
  document.querySelector("#timetable-day").value = entry.day;
  document.querySelector("#timetable-venue").value = entry.venue;
  document.querySelector("#timetable-start").value = entry.start;
  document.querySelector("#timetable-end").value = entry.end;

  document.querySelector("#modal-timetable").showModal();
};

window.deleteTimetable = async function (id) {
  if (!id || id === "undefined" || id === "null") {
    showToast("Delete failed: Invalid or missing timetable ID");
    return;
  }
  if (!confirm("Are you sure you want to delete this timetable slot?")) return;
  try {
    await fetchApi(`/api/timetable/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("Timetable slot deleted");
    loadTimetable();
  } catch (err) {
    showToast("Delete failed: " + err.message);
  }
};

document.querySelector("#btn-add-timetable")?.addEventListener("click", () => {
  document.querySelector("#modal-timetable-title").textContent =
    "Add Timetable Slot";
  document.querySelector("#form-timetable").reset();
  document.querySelector("#timetable-id").value = "";
  document.querySelector("#modal-timetable").showModal();
});

document
  .querySelector("#close-modal-timetable")
  ?.addEventListener("click", () => {
    document.querySelector("#modal-timetable").close();
  });

document
  .querySelector("#form-timetable")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.querySelector("#timetable-id").value;
    const body = {
      course_id: document.querySelector("#timetable-course-id").value,
      day: document.querySelector("#timetable-day").value,
      venue: document.querySelector("#timetable-venue").value.trim(),
      start: document.querySelector("#timetable-start").value,
      end: document.querySelector("#timetable-end").value,
    };

    console.log("TIMETABLE BODY:", body);

    try {
      if (id) {
        await fetchApi(`/api/timetable/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        showToast("Timetable slot updated");
      } else {
        await fetchApi("/api/timetable", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Timetable slot created");
      }
      document.querySelector("#modal-timetable").close();
      loadTimetable();
    } catch (err) {
      showToast("Save failed: " + err.message);
    }
  });

// Announcement Operations
window.editAnnouncement = function (id) {
  const item = announcements.find((a) => String(a.id) === String(id));
  if (!item) return;

  document.querySelector("#modal-announcement-title").textContent =
    "Edit Announcement";
  document.querySelector("#announcement-id").value = item.id;
  document.querySelector("#announcement-type").value = item.type;
  document.querySelector("#announcement-published").value = item.published
    ? "true"
    : "false";
  document.querySelector("#announcement-title").value = item.title;
  document.querySelector("#announcement-content").value = item.content;

  document.querySelector("#modal-announcement").showModal();
};

window.deleteAnnouncement = async function (id) {
  if (!id || id === "undefined" || id === "null") {
    showToast("Delete failed: Invalid or missing announcement ID");
    return;
  }
  if (!confirm("Are you sure you want to delete this announcement?")) return;
  try {
    await fetchApi(`/api/announcements/${encodeURIComponent(id)}`, { method: "DELETE" });
    showToast("Announcement deleted");
    loadAnnouncements();
  } catch (err) {
    showToast("Delete failed: " + err.message);
  }
};

document
  .querySelector("#btn-add-announcement")
  ?.addEventListener("click", () => {
    document.querySelector("#modal-announcement-title").textContent =
      "Add Announcement";
    document.querySelector("#form-announcement").reset();
    document.querySelector("#announcement-id").value = "";
    document.querySelector("#modal-announcement").showModal();
  });

document
  .querySelector("#close-modal-announcement")
  ?.addEventListener("click", () => {
    document.querySelector("#modal-announcement").close();
  });

document
  .querySelector("#form-announcement")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.querySelector("#announcement-id").value;
    const body = {
      type: document.querySelector("#announcement-type").value,
      published:
        document.querySelector("#announcement-published").value === "true",
      title: document.querySelector("#announcement-title").value.trim(),
      content: document.querySelector("#announcement-content").value.trim(),
    };

    try {
      if (id) {
        await fetchApi(`/api/announcements/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        showToast("Announcement updated");
      } else {
        await fetchApi("/api/announcements", {
          method: "POST",
          body: JSON.stringify(body),
        });
        showToast("Announcement created");
      }
      document.querySelector("#modal-announcement").close();
      loadAnnouncements();
    } catch (err) {
      showToast("Save failed: " + err.message);
    }
  });

// Initialization
function initializeDashboard() {
  loadCourses();
  loadTimetable();
  loadAnnouncements();
}

// Initial Session Check
supabaseClient.auth.getSession().then(({ data }) => {
  updateUIForAuth(data.session);
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
  updateUIForAuth(session);
});
