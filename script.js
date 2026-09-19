// Timetable, announcements, and settings populated from Supabase API backend
let timetable = [];
let announcements = [];
let settings = null;
const weekday = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const today = new Date();
const currentDay = weekday[today.getDay()];
const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const formatDayDate = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
const formatShortDate = (date) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(
    date,
  );
function escapeICS(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}
const API_BASE = window.__API_BASE__ !== undefined
  ? window.__API_BASE__
  : (typeof window !== "undefined" &&
     (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
     window.location.port &&
     window.location.port !== "4000"
      ? `http://${window.location.hostname}:4000`
      : (typeof window !== "undefined" && window.location.protocol === "file:" ? "http://127.0.0.1:4000" : ""));

async function fetchJsonFromApi(pathname) {
  // 1. Try configured API_BASE first
  try {
    const res = await fetch(`${API_BASE}${pathname}`);
    if (res.ok) return res;
  } catch (_) {}

  // 2. If running locally and API_BASE failed, try alternate local addresses
  const isLocal =
    typeof window !== "undefined" &&
    (window.location.protocol === "file:" ||
     window.location.hostname === "localhost" ||
     window.location.hostname === "127.0.0.1");

  if (isLocal) {
    for (const host of ["127.0.0.1", "localhost"]) {
      try {
        const fallbackUrl = `http://${host}:4000${pathname}`;
        if (fallbackUrl !== `${API_BASE}${pathname}`) {
          const res = await fetch(fallbackUrl);
          if (res.ok) return res;
        }
      } catch (_) {}
    }
  }

  return { ok: false, json: async () => null };
}

async function loadBackendData() {
  try {
    const [timetableResponse, announcementsResponse, settingsResponse] =
      await Promise.all([
        fetchJsonFromApi("/api/timetable"),
        fetchJsonFromApi("/api/announcements"),
        fetchJsonFromApi("/api/settings"),
      ]);

    if (timetableResponse.ok) timetable = await timetableResponse.json();
    if (announcementsResponse.ok) announcements = await announcementsResponse.json();
    if (settingsResponse.ok) settings = await settingsResponse.json();

    if (Array.isArray(timetable) && timetable.length > 0) {
      return true;
    }
  } catch (error) {
    console.warn("Backend API unavailable, attempting local fallback", error);
  }

  // Fallback to data.json if backend was unreachable
  try {
    const fallbackRes = await fetch("data.json");
    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json();
      if (Array.isArray(fallbackData.timetable) && fallbackData.timetable.length) {
        timetable = fallbackData.timetable;
      }
      if (Array.isArray(fallbackData.announcements)) {
        announcements = fallbackData.announcements;
      }
      if (fallbackData.settings) {
        settings = fallbackData.settings;
      }
      return true;
    }
  } catch (_) {}

  return false;
}

function renderSettings() {
  if (!settings) return;
  const semesterEl = document.querySelector("#semester-name");
  const sessionEl = document.querySelector("#session-name");
  const validThroughEl = document.querySelector("#valid-through-date");

  if (semesterEl && settings.semester) semesterEl.textContent = settings.semester;
  if (sessionEl && settings.session) sessionEl.textContent = settings.session;
  if (validThroughEl && settings.validThrough) validThroughEl.textContent = settings.validThrough;
}
function toMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function classesForDay(day) {
  return timetable.filter((item) => item.day === day);
}
function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "pm" : "am";
  const hour = hours % 12 || 12;
  return `${hour}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}${suffix}`;
}
function formatTimeRange(item) {
  return `${formatTime(item.start)}–${formatTime(item.end)}`;
}
function nextClass() {
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const todayClasses = classesForDay(currentDay).filter(
    (item) => toMinutes(item.start) > nowMinutes,
  );
  if (todayClasses.length) return { item: todayClasses[0], date: today };
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const item = classesForDay(weekday[date.getDay()])[0];
    if (item) return { item, date };
  }
  return { item: timetable[0], date: today };
}
function dateForClass(item) {
  const date = new Date(today);
  const delta = (weekday.indexOf(item.day) - today.getDay() + 7) % 7 || 7;
  date.setDate(today.getDate() + delta);
  date.setHours(0, 0, 0, 0);
  return date;
}
function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid class time: ${value}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59)
    throw new Error(`Invalid class time: ${value}`);
  return { hours, minutes };
}
function icsLocalDate(date, time) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new Error("Invalid event date");
  const { hours, minutes } = parseTime(time);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}T${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}00`;
}
function icsUTCDate(date) {
  return `${String(date.getUTCFullYear()).padStart(4, "0")}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}Z`;
}
function foldICSLine(line) {
  const chunks = [];
  for (let index = 0; index < line.length; index += 74)
    chunks.push(`${chunks.length ? " " : ""}${line.slice(index, index + 74)}`);
  return chunks;
}
function uniqueUID(item) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${item.code.replace(/[^A-Za-z0-9]/g, "")}-${item.day}-${randomPart}@nwu-timetable.local`;
}
function createCalendarEvent(item, date) {
  const start = parseTime(item.start);
  const end = parseTime(item.end);
  if (end.hours * 60 + end.minutes <= start.hours * 60 + start.minutes)
    throw new Error("Class end time must be after its start time");
  const eventDate = icsLocalDate(date, item.start);
  const eventEnd = icsLocalDate(date, item.end);
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const description = `${item.code} - ${item.name}\nDate: ${dateLabel}\nTime: ${formatTimeRange(item)}\nLecturer: ${item.lecturer || "Not provided"}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Northwest University SE Timetable//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-TIMEZONE:Africa/Lagos",
    "BEGIN:VEVENT",
    `UID:${uniqueUID(item)}`,
    `DTSTAMP:${icsUTCDate(new Date())}`,
    `DTSTART;TZID=Africa/Lagos:${eventDate}`,
    `DTEND;TZID=Africa/Lagos:${eventEnd}`,
    `SUMMARY:${escapeICS(`${item.code} - ${item.name}`)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(item.venue)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .flatMap(foldICSLine)
    .join("\r\n");
}
function calendarFilename(item) {
  const code = String(item.code)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const day = String(item.day)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${code}-${day}.ics`;
}
function googleCalendarDate(date, time) {
  return icsLocalDate(date, time).replace("T", "T");
}
function googleCalendarUrl(item, date) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${item.code} - ${item.name}`,
    dates: `${googleCalendarDate(date, item.start)}/${googleCalendarDate(date, item.end)}`,
    details: `Lecturer: ${item.lecturer || "Not provided"}\nCourse code: ${item.code}`,
    location: item.venue,
    ctz: "Africa/Lagos",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function downloadCalendarFile(item, date) {
  const icsContent = `${createCalendarEvent(item, date)}\r\n`;
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const filename = calendarFilename(item);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);

  console.info("Calendar download", {
    filename,
    mimeType: blob.type,
    size: blob.size,
    blobUrl: url,
  });

  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast("Calendar file downloaded");
}
let pendingCalendarEvent = null;
function calendarFile(item, date) {
  pendingCalendarEvent = { item, date };
  document.querySelector("#calendar-options")?.showModal();
}
function classRow(item) {
  return `<article class="class-card"><span class="class-accent ${item.tone}"></span><div class="class-main"><div class="class-heading"><span class="course-code">${item.code}</span></div><h3>${item.name}</h3><div class="class-meta"><span>▣ ${item.day}</span><span>◷ ${formatTimeRange(item)}</span><span>⌖ ${item.venue}</span><span class="lecturer-meta">♙ ${item.lecturer}</span></div></div><div class="class-actions"><button class="calendar-button" data-code="${item.code}" aria-label="Add ${item.code} to calendar" title="Add to Calendar"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 9h18M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01"/></svg><span>Add to Calendar</span></button><button class="material-button" data-material="${item.code}" aria-label="Course material for ${item.code}"><svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2.5h8l4 4v15H6z"/><path d="M14 2.5v5h5M8.5 13h7M8.5 16.5h5"/></svg><span>Course PDF</span></button></div></article>`;
}
function renderList(container, day = "all") {
  const items = day === "all" ? timetable : classesForDay(day);
  container.innerHTML = items.length
    ? items.map(classRow).join("")
    : `<div class="empty-state"><span>✦</span><h3>No classes on ${day} 🎉</h3><p>There are no lecture sessions scheduled for this day.</p></div>`;
  bindCalendarButtons(container);
}
function bindCalendarButtons(container) {
  container.querySelectorAll(".calendar-button").forEach((button) =>
    button.addEventListener("click", () => {
      const item = timetable.find(
        (entry) => entry.code === button.dataset.code,
      );
      calendarFile(item, dateForClass(item));
    }),
  );
  container
    .querySelectorAll(".material-button")
    .forEach((button) =>
      button.addEventListener("click", () =>
        showToast(
          `Course material for ${button.dataset.material} is not published yet`,
        ),
      ),
    );
}
function renderToday() {
  const list = document.querySelector("#today-list");
  const items = classesForDay(currentDay);
  document.querySelector("#today-label").textContent =
    currentDay === "Saturday" || currentDay === "Sunday"
      ? "Today’s classes"
      : `${currentDay}'s classes`;
  document.querySelector("#today-date").textContent = formatShortDate(today);
  list.innerHTML = items.length
    ? items
      .map(
        (item) =>
          `<div class="today-row"><span class="today-time">${item.start}</span><span class="today-marker ${item.tone}"></span><div><strong>${item.code}</strong><small>${item.name}</small><small>⌖ ${item.venue}</small></div></div>`,
      )
      .join("")
    : `<div class="today-empty"><strong>No classes today 🎉</strong><span>Enjoy the breathing room.</span></div>`;
}
function renderNextClass() {
  const next = nextClass();
  document.querySelector("#next-day").textContent = formatDayDate(next.date);
  document.querySelector("#next-course").textContent =
    `${next.item.code} · ${next.item.name}`;
  document.querySelector("#next-course-meta").textContent = next.item.lecturer;
  document.querySelector("#next-time").textContent =
    `${next.item.start} – ${next.item.end}`;
  document.querySelector("#next-venue").textContent = next.item.venue;
  document.querySelector("#next-calendar").onclick = () =>
    calendarFile(next.item, next.date);
}
function renderAnnouncements() {
  document.querySelector("#announcement-preview").innerHTML = announcements
    .slice(0, 2)
    .map(
      (item) =>
        `<div class="announcement-mini"><span>${item.date}</span><strong>${item.title}</strong></div>`,
    )
    .join("");
  document.querySelector("#announcements-list").innerHTML = announcements
    .map(
      (item) =>
        `<article class="announcement-card"><time>${item.date}</time><div><span class="announcement-type">${item.type}</span><h2>${item.title}</h2><p>${item.copy}</p></div></article>`,
    )
    .join("");
}
function setDay(day, source) {
  document
    .querySelectorAll(`${source} .day-tab`)
    .forEach((tab) =>
      tab.classList.toggle("is-active", tab.dataset.day === day),
    );
  const target =
    source === ".timetable-tabs"
      ? document.querySelector("#full-timetable-list")
      : document.querySelector("#timetable-list");
  renderList(target, day);
}
function showView(view) {
  document
    .querySelectorAll(".view")
    .forEach((section) =>
      section.classList.toggle("is-visible", section.dataset.page === view),
    );
  document
    .querySelectorAll("[data-view]")
    .forEach((link) =>
      link.classList.toggle("is-active", link.dataset.view === view),
    );
  window.scrollTo({ top: 0, behavior: "smooth" });
}
let toastTimer = null;
function showToast(message) {
  const toast = document.querySelector(".toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2800);
}
document.querySelectorAll("[data-view]").forEach((link) =>
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showView(link.dataset.view);
  }),
);
document
  .querySelectorAll("[data-view-target]")
  .forEach((link) =>
    link.addEventListener("click", () => showView(link.dataset.viewTarget)),
  );
document
  .querySelectorAll(".day-tab")
  .forEach((tab) =>
    tab.addEventListener("click", () =>
      setDay(
        tab.dataset.day,
        tab.closest(".timetable-tabs") ? ".timetable-tabs" : ".home-tabs",
      ),
    ),
  );
document
  .querySelector("#export-all")
  .addEventListener("click", () =>
    showToast("Choose a class to export its calendar event"),
  );
const helpDialog = document.querySelector("#help-dialog");
document
  .querySelector("#help-button")
  ?.addEventListener("click", () => helpDialog.showModal());
document
  .querySelector("#close-help")
  ?.addEventListener("click", () => helpDialog.close());
document
  .querySelector("#dialog-done")
  ?.addEventListener("click", () => helpDialog.close());
const calendarOptions = document.querySelector("#calendar-options");
document.querySelector("#download-ics")?.addEventListener("click", () => {
  if (!pendingCalendarEvent) return;
  const { item, date } = pendingCalendarEvent;
  calendarOptions.close();
  downloadCalendarFile(item, date);
});
document.querySelector("#google-calendar")?.addEventListener("click", () => {
  if (!pendingCalendarEvent) return;
  const { item, date } = pendingCalendarEvent;
  calendarOptions.close();
  window.open(googleCalendarUrl(item, date), "_blank", "noopener,noreferrer");
});
document.querySelector("#cancel-calendar")?.addEventListener("click", () => {
  pendingCalendarEvent = null;
  calendarOptions.close();
});

// Share Platform Dialog & Actions
const shareDialog = document.querySelector("#share-dialog");
const openShareBtn = document.querySelector("#open-share-dialog");
const closeShareBtn = document.querySelector("#close-share");
const shareUrlInput = document.querySelector("#share-url-input");
const shareCopyBtn = document.querySelector("#share-copy-btn");
const shareWhatsappBtn = document.querySelector("#share-whatsapp");
const shareFacebookBtn = document.querySelector("#share-facebook");
const shareInstagramBtn = document.querySelector("#share-instagram");

function getPublicShareUrl() {
  if (window.location.protocol === "file:") {
    return window.location.href;
  }
  return `${window.location.origin}${window.location.pathname}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn("Clipboard API writeText failed, trying fallback", e);
    }
  }
  try {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    tempInput.style.position = "fixed";
    tempInput.style.left = "-9999px";
    tempInput.style.top = "0";
    document.body.appendChild(tempInput);
    tempInput.focus();
    tempInput.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(tempInput);
    return successful;
  } catch (err) {
    console.error("Copy fallback failed", err);
    return false;
  }
}

function openShareModal() {
  if (!shareDialog) return;
  const currentUrl = getPublicShareUrl();
  if (shareUrlInput) {
    shareUrlInput.value = currentUrl;
  }
  shareDialog.showModal();
}

function closeShareModal() {
  if (!shareDialog) return;
  shareDialog.close();
}

openShareBtn?.addEventListener("click", () => {
  openShareModal();
});

closeShareBtn?.addEventListener("click", () => {
  closeShareModal();
});

// Close when clicking outside modal dialog (backdrop)
shareDialog?.addEventListener("click", (event) => {
  if (event.target === shareDialog) {
    closeShareModal();
  }
});

// Close with Escape key
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && shareDialog && shareDialog.open) {
    closeShareModal();
  }
});

// WhatsApp Share
shareWhatsappBtn?.addEventListener("click", () => {
  const url = getPublicShareUrl();
  const shareText = `Northwest University, Kano — Class Timetable & Updates: ${url}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(whatsappUrl, "_blank", "noopener,noreferrer");
});

// Facebook Share
shareFacebookBtn?.addEventListener("click", () => {
  const url = getPublicShareUrl();
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  window.open(facebookUrl, "_blank", "noopener,noreferrer");
});

// Instagram Share
shareInstagramBtn?.addEventListener("click", async () => {
  const url = getPublicShareUrl();
  await copyTextToClipboard(url);
  showToast("Link copied to clipboard! Opening Instagram to share...");
  setTimeout(() => {
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  }, 400);
});

// Copy Link Button
shareCopyBtn?.addEventListener("click", async () => {
  const url = getPublicShareUrl();
  const copied = await copyTextToClipboard(url);
  if (copied) {
    showToast("Link copied to clipboard!");
    const btnText = shareCopyBtn.querySelector(".copy-btn-text");
    if (btnText) {
      const originalText = btnText.textContent;
      btnText.textContent = "Copied!";
      shareCopyBtn.classList.add("copied");
      setTimeout(() => {
        btnText.textContent = originalText;
        shareCopyBtn.classList.remove("copied");
      }, 2000);
    }
  } else {
    showToast("Failed to copy link. Please copy manually.");
  }
});

async function initializeApp() {
  const success = await loadBackendData();
  if (!success && !timetable.length) {
    showToast("Unable to reach backend server. Please ensure Express backend is running.");
  }
  renderSettings();
  renderNextClass();
  renderToday();
  renderAnnouncements();
  renderList(document.querySelector("#timetable-list"));
  renderList(document.querySelector("#full-timetable-list"));
}
initializeApp();

