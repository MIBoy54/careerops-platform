console.log("app.js loaded");
let APP_ENV = "production";

import { validateContact } from "../src/validateContact.js";

function isAdminUser() {
  return APP_ENV === "demo" || globalThis.currentUser?.role === "admin";
}

console.log("FRONTEND APP_ENV:", APP_ENV);

function applyRoleBasedAccess() {
  const admin = isAdminUser();

  const formFields = document.querySelectorAll(
    "#contactForm input, #contactForm select, #contactForm textarea, #contactForm button"
  );

  formFields.forEach((el) => {
    el.disabled = !admin;
  });

  if (generateReportBtn) {
    generateReportBtn.disabled = !admin || selectedIds.size !== 4;
  }

  if (viewButton) {
    viewButton.disabled = selectedIds.size === 0;
  }

  let banner = document.getElementById("readOnlyBanner");

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "readOnlyBanner";
    banner.style.background = "#f57c00";
    banner.style.color = "white";
    banner.style.textAlign = "center";
    banner.style.padding = "8px";
    banner.style.fontWeight = "bold";
    banner.style.letterSpacing = "0.5px";
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.right = "0";
    banner.style.zIndex = "9999";
    banner.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";

    document.body.prepend(banner);
    document.body.style.paddingTop = "40px";
  }
}
if (APP_ENV === "demo") {
  banner.textContent = "CAREEROPS PLATFORM • SANDBOX ENVIRONMENT";
  banner.style.display = "block";
} else if (!admin) {
  banner.textContent = "CAREEROPS PLATFORM • GUEST VIEW • READ ONLY";
  banner.style.display = "block";
} else {
  banner.style.display = "none";
}

function renderDemoBanner() {
  if (APP_ENV !== "demo") return;
  console.log("SANDBOX banner running...");
}


let selectedIds = new Set();
let contacts = [];
let editId = null;

let form;
let errorsDiv;
let messageDiv;
let resetButton;
let unemploymentForm;
let dateInput;
let companyInput;
let companySuggestions;
let selectionCountEl;
let generateReportBtn;
let weeklyHistoryMessageEl;
let weeklyHistoryTableBody;
let weeklyReportDetailEl;
let closeWeeklyReportDetailBtn;
let viewButton;
let analyticsSessionId = null;
let analyticsHeartbeatInterval = null;
let validationRuns = [];
let latestValidationRunId = null;
let currentSectionIndex = 0;
let savedContacts = [];
let currentSortField = "date_contacted";
let currentSortDirection = "desc";

const sectionOrder = [
  "landingPage",
  "telemetrySection",
  "contactFormSection",
  "savedContactsSection",
  "detailViewerSection",
  "weeklyReportHistorySection"
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAnalyticsSessionId() {
  let sessionId = sessionStorage.getItem("analyticsSessionId");

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem("analyticsSessionId", sessionId);
  }

  return sessionId;
}

function formatSeconds(seconds) {
  if (!seconds && seconds !== 0) return "";

  const totalSeconds = Math.floor(Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${totalSeconds % 60}s`;
  return `${totalSeconds}s`;
}

async function startAnalyticsSession() {
  console.log("startAnalyticsSession called");

  analyticsSessionId = getAnalyticsSessionId();

  const response = await fetch("/api/analytics/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: analyticsSessionId,
      page_path: window.location.pathname
    })
  });

  if (!response.ok) {
    throw new Error("Failed to start analytics session");
  }
}

async function loadAnalyticsSummary() {
  try {
    const response = await fetch("/api/analytics/summary");

    if (!response.ok) {
      throw new Error("Failed to load analytics summary");
    }

    const data = await response.json();

    // Existing totals
  document.getElementById("totalVisits").textContent =
    Number(data.totals.total_visits ?? 0).toLocaleString();

  document.getElementById("uniqueVisitors").textContent =
    Number(data.totals.unique_visitors ?? 0).toLocaleString();

  document.getElementById("totalTime").textContent =
    formatSeconds(data.totals.total_time_spent_seconds ?? 0);

  document.getElementById("avgTime").textContent =
    formatSeconds(data.totals.avg_time_spent_seconds ?? 0);

  document.getElementById("lastUpdated").textContent =
  new Date().toLocaleTimeString();

    // NEW: Top Pages
    const tbody = document.querySelector("#topPagesTable tbody");
    tbody.innerHTML = "";

    data.pages.forEach(page => {
      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${page.page_path}</td>
        <td>${page.visits}</td>
        <td>${page.unique_visitors}</td>
        <td>${formatSeconds(page.total_time_spent_seconds)}</td>
      `;

      tbody.appendChild(row);
    });

  } catch (error) {
    console.error("Analytics load failed:", error);
  }
}
async function sendAnalyticsHeartbeat(seconds = 15) {
  if (!analyticsSessionId) return;

  const response = await fetch("/api/analytics/heartbeat", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: analyticsSessionId,
      page_path: window.location.pathname,
      seconds
    })
  });

  if (!response.ok) {
    throw new Error("Failed to send analytics heartbeat");
  }
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return "";

  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function formatDateTime(dateString) {
  if (!dateString) return "";

  const d = new Date(dateString);

  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
}

async function loadAnalyticsTrend() {
  try {
    const response = await fetch("/api/analytics/trend");

    if (!response.ok) {
      throw new Error("Failed to load analytics trend");
    }

    const rows = await response.json();
    const chart = document.getElementById("trendChart");

    if (!chart) return;

    chart.innerHTML = "";

    if (!rows.length) {
      chart.innerHTML = "<div>No trend data yet.</div>";
      return;
    }

    const maxSeconds = Math.max(...rows.map(row => Number(row.total_seconds) || 0), 1);

    rows.forEach(row => {
      const totalSeconds = Number(row.total_seconds) || 0;
      const height = Math.max((totalSeconds / maxSeconds) * 140, 10);

      const wrap = document.createElement("div");
      wrap.className = "trend-bar-wrap";

      wrap.innerHTML = `
        <div class="trend-value">${totalSeconds}s</div>
        <div class="trend-bar" style="height:${height}px;" title="${row.minute_bucket} - ${totalSeconds} sec"></div>
        <div class="trend-label">${row.minute_bucket.slice(11, 16)}</div>
      `;

      chart.appendChild(wrap);
    });
  } catch (error) {
    console.error("Analytics trend load failed:", error);
  }
}

async function loadActiveUsers() {
  try {
    const response = await fetch("/api/analytics/active-users");

    if (!response.ok) {
      throw new Error("Failed to load active users");
    }

    const data = await response.json();
    const activeUsersEl = document.getElementById("activeUsers");

    if (activeUsersEl) {
      activeUsersEl.textContent = data.active_users ?? 0;
    }

  } catch (error) {
    console.error("Active users load failed:", error);
  }
}

async function loadStaleSessions() {
  try {
    const response = await fetch("/api/analytics/stale-sessions");

    if (!response.ok) {
      throw new Error("Failed to load stale sessions");
    }

    const data = await response.json();
    const staleSessionsEl = document.getElementById("staleSessions");

    if (staleSessionsEl) {
      staleSessionsEl.textContent = data.stale_sessions ?? 0;
    }
  } catch (error) {
    console.error("Stale sessions load failed:", error);
  }
}

async function loadSessionsToday() {
  try {
    const response = await fetch("/api/analytics/sessions-today");

    if (!response.ok) {
      throw new Error("Failed to load sessions today");
    }

    const data = await response.json();
    const sessionsTodayEl = document.getElementById("sessionsToday");

    if (sessionsTodayEl) {
      sessionsTodayEl.textContent = data.sessions_today ?? 0;
    }
  } catch (error) {
    console.error("Sessions today load failed:", error);
  }
}

async function loadValidationRuns() {
  try {
    const response = await fetch("/api/validation-runs");

    if (!response.ok) {
      throw new Error("Failed to load validation runs");
    }

    validationRuns = await response.json();

    renderMessage(
      document.getElementById("validationRunMessage"),
      ""
    );

    renderValidationRunsTable();
    latestValidationRunId = validationRuns.length ? validationRuns[0].id : null;
  } catch (error) {
    console.error("Validation runs load failed:", error);
    renderMessage(
      document.getElementById("validationRunMessage"),
      "Failed to load validation runs.",
      "error"
    );
  }
}

function renderValidationRunsTable() {
  const tableBody = document.querySelector("#validationRunsTable tbody");
  console.log("tableBody found:", !!tableBody);
  if (!tableBody) return;

  tableBody.innerHTML = "";

  if (!validationRuns.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8">No validation runs found.</td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = validationRuns
    .map((run) => {
      const isLatest = run.id === latestValidationRunId;

      return `
      <tr class="${isLatest ? 'latest-run' : ''}">
        <td>${run.id ?? ""}</td>
        <td>${escapeHtml(run.run_type ?? "")}</td>
        <td>${escapeHtml(run.status ?? "")}</td>
        <td>${formatDateTime(run.started_at)}</td>
        <td>${formatDateTime(run.completed_at)}</td>
        <td>${formatDuration(run.duration_ms)}</td>
        <td>${escapeHtml(run.trigger_source ?? "")}</td>
        <td>${escapeHtml(run.notes ?? "")}</td>
      </tr>
    `;
    })
    .join("");
}
  async function startValidationRun() {
    const messageDiv = document.getElementById("validationRunMessage");

    try {
      const response = await fetch("/api/validation-runs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_type: "UI Validation Run",
          trigger_source: "UI",
          notes: "Started from CareerOps UI"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to start validation run");
      }

      const data = await response.json();
      latestValidationRunId = data.id;

      renderMessage(messageDiv, "Validation run started successfully.");
      await loadValidationRuns();
    } catch (error) {
      console.error("Start validation run failed:", error);
      renderMessage(messageDiv, "Failed to start validation run.", "error");
    }
  }

  async function completeValidationRun() {
    const messageDiv = document.getElementById("validationRunMessage");

    try {
      if (!latestValidationRunId) {
        renderMessage(messageDiv, "No validation run available to complete.", "error");
        return;
      }

      const response = await fetch(`/api/validation-runs/${latestValidationRunId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETED",
          notes: "Completed from CareerOps UI"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to complete validation run");
      }

      renderMessage(messageDiv, "Validation run completed successfully.");
      await loadValidationRuns();
    } catch (error) {
      console.error("Complete validation run failed:", error);
      renderMessage(messageDiv, "Failed to complete validation run.", "error");
    }
  }

  function startAnalyticsHeartbeat() {
    if (analyticsHeartbeatInterval) {
      clearInterval(analyticsHeartbeatInterval);
    }

    analyticsHeartbeatInterval = setInterval(async () => {
      try {
        await sendAnalyticsHeartbeat(15);
      } catch (error) {
        console.error("Analytics heartbeat failed:", error);
      }
    }, 600000);
  }

  function renderErrors(target, errors) {
    if (!target) return;

    if (!errors || !errors.length) {
      target.innerHTML = "";
      return;
    }

    target.innerHTML = `
    <div class="error-box">
      <strong>Please fix the following:</strong>
      <ul>
        ${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}
      </ul>
    </div>
  `;
  }

  function renderMessage(target, message, type = "success") {
    if (!target) return;

    if (!message) {
      target.innerHTML = "";
      return;
    }

    const className = type === "error" ? "error-box" : "success-box";
    target.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
  }

  function formatDate(value) {
    if (!value) return "";
    return String(value).split("T")[0];
  }

function sortSavedContacts(contacts, field, direction) {
  return [...contacts].sort((a, b) => {
    if (field === "date_contacted") {
      const valueA = String(a.date_contacted || "").trim();
      const valueB = String(b.date_contacted || "").trim();

      return direction === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    if (field === "company") {
      const valueA = String(a.company || "").trim();
      const valueB = String(b.company || "").trim();

      const companyCompare = valueA.localeCompare(valueB, undefined, {
        sensitivity: "base",
        numeric: true
      });

      if (companyCompare !== 0) {
        return direction === "asc" ? companyCompare : -companyCompare;
      }

      const dateA = String(a.date_contacted || "").trim();
      const dateB = String(b.date_contacted || "").trim();

      return dateB.localeCompare(dateA);
    }

    const valueA = String(a[field] || "").trim();
    const valueB = String(b[field] || "").trim();

    const compare = valueA.localeCompare(valueB, undefined, {
      sensitivity: "base",
      numeric: true
    });

    return direction === "asc" ? compare : -compare;
  });
}

function handleViewSelectedClick() {
  const selected = getSelectedContacts();
  const weeklyReportDetailHeader = document.getElementById("weekly-report-detail-header");

  if (!selected.length) {
    if (weeklyReportDetailEl) {
      weeklyReportDetailEl.innerHTML = `<p class="error">Please select at least one contact.</p>`;
    }

    if (weeklyReportDetailHeader) {
      weeklyReportDetailHeader.style.display = "block";
    }

    showSection("detailViewerSection");
    return;
  }

  renderSelectedContacts(selected);

  if (weeklyReportDetailHeader) {
    weeklyReportDetailHeader.style.display = "block";
  }

  showSection("detailViewerSection");
}

  function getStatusClass(status) {
    switch (status) {
      case "Applied":
        return "status-green";
      case "Interviewing":
        return "status-blue";
      case "Offer":
        return "status-purple";
      case "Rejected":
        return "status-red";
      default:
        return "";
    }
  }

async function loadContacts() {
  console.log("LOAD CONTACTS CALLED");
  const response = await fetch("/api/contacts");

  if (!response.ok) {
    throw new Error("Failed to load contacts");
  }

  contacts = await response.json();
  savedContacts = [...contacts];
  renderTable();
}

function updateSelectionCount() {
  if (selectionCountEl) {
    selectionCountEl.textContent = `Selected for Weekly Report: ${selectedIds.size} of 4`;
  }

  if (generateReportBtn) {
    generateReportBtn.disabled = !isAdminUser() || selectedIds.size !== 4;
  }

  if (viewButton) {
    viewButton.disabled = selectedIds.size === 0;
  }
}

  function getSelectedContacts() {
    return contacts.filter((c) => selectedIds.has(c.id));
  }

function renderSelectedContacts(selected) {
  if (!weeklyReportDetailEl) return;

  weeklyReportDetailEl.innerHTML = `
    <h3>Selected Employer Details</h3>
    ${selected
      .map(
        (contact) => `
          <div class="contact-card">
            <p><strong>ID:</strong> ${contact.id ?? ""}</p>
            <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
            <p><strong>Recruiter Name:</strong> ${escapeHtml(contact.recruiter_name || "")}</p>
            <p><strong>Company:</strong> ${escapeHtml(contact.company || "")}</p>
            <p><strong>Email:</strong> ${escapeHtml(contact.email || "")}</p>
            <p><strong>Phone:</strong> ${escapeHtml(contact.phone || "")}</p>
            <p><strong>Status:</strong> ${escapeHtml(contact.status || "")}</p>
            <p><strong>Relationship Status:</strong> ${escapeHtml(contact.relationship_status || "")}</p>
            <p><strong>Level:</strong> ${escapeHtml(contact.role_level || "")}</p>
            <p><strong>Role Type:</strong> ${escapeHtml(contact.role_type || "")}</p>
            <p><strong>Location:</strong> ${escapeHtml(contact.location || "")}</p>
            <p><strong>Comp Range:</strong> ${escapeHtml(contact.comp_range || "")}</p>
            <p><strong>Address:</strong> ${escapeHtml(contact.address || "")}</p>
            <p><strong>Website:</strong> ${escapeHtml(contact.website || "")}</p>
            <p><strong>Notes:</strong> ${escapeHtml(contact.notes || "")}</p>
            <p><strong>Reported to Unemployment:</strong> ${escapeHtml(contact.reported_unemployment || "No")}</p>
          </div>
        `
      )
      .join("")}
  `;
}

  function clearWeeklyReportDetail() {
    const header = document.getElementById("weekly-report-detail-header");

    if (header) {
      header.style.display = "none";
    }

    if (weeklyReportDetailEl) {
      weeklyReportDetailEl.innerHTML =
        "<p>Select employers or a saved report to view details.</p>";
    }

    document.querySelectorAll(".view-report-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
  }

  function setActiveViewReportButton(activeButton) {
    document.querySelectorAll(".view-report-btn").forEach((btn) => {
      btn.classList.remove("active");
    });

    if (activeButton) {
      activeButton.classList.add("active");
    }
  }

  async function loadWeeklyReportDetail(reportId) {
    const header = document.getElementById("weekly-report-detail-header");

    if (!weeklyReportDetailEl) return;

    weeklyReportDetailEl.innerHTML = "<p>Loading report detail...</p>";

    try {
      const response = await fetch(`/api/reports/${reportId}`);
      const report = await response.json();

      if (!response.ok) {
        throw new Error(report.error || "Failed to load weekly report detail.");
      }

      if (header) {
        header.style.display = "block";
      }

      weeklyReportDetailEl.innerHTML = `
      <h3>Weekly Report Summary</h3>
      <p><strong>ID:</strong> ${report.id}</p>
      <p><strong>Week Start:</strong> ${formatDate(report.week_start)}</p>
      <p><strong>Week End:</strong> ${formatDate(report.week_end)}</p>
      <p><strong>Submitted:</strong> ${report.submitted ?? 0}</p>
      <p><strong>Submitted At:</strong> ${formatDate(report.submitted_at)}</p>

      <h3>Selected Employer Details</h3>
      ${report.employers && report.employers.length
          ? report.employers
            .map(
              (contact) => `
            <div class="contact-card">
              <p><strong>ID:</strong> ${contact.id ?? ""}</p>
              <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
              <p><strong>Recruiter Name:</strong> ${escapeHtml(contact.recruiter_name || "")}</p>
              <p><strong>Company:</strong> ${escapeHtml(contact.company || "")}</p>
              <p><strong>Email:</strong> ${escapeHtml(contact.email || "")}</p>
              <p><strong>Phone:</strong> ${escapeHtml(contact.phone || "")}</p>
              <p><strong>Status:</strong> ${escapeHtml(contact.status || "")}</p>
              <p><strong>Relationship Status:</strong> ${escapeHtml(contact.relationship_status || "")}</p>
              <p><strong>Level:</strong> ${escapeHtml(contact.role_level || "")}</p>
              <p><strong>Location:</strong> ${escapeHtml(contact.location || "")}</p>
            </div>
          `
            )
            .join("")
          : "<p>No employers found for this report.</p>"
        }
    `;
    } catch (error) {
      console.error("Failed to load weekly report detail:", error);

      if (header) {
        header.style.display = "none";
      }

      weeklyReportDetailEl.innerHTML =
        `<p class="error">Failed to load weekly report detail.</p>`;
    }
  }

  function wireViewReportButtons() {
    const viewButtons = document.querySelectorAll(".view-report-btn");

    viewButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.id);
        setActiveViewReportButton(button);
        await loadWeeklyReportDetail(id);
      });
    });
  }

  async function loadWeeklyReportHistory() {
    if (!weeklyHistoryMessageEl || !weeklyHistoryTableBody) return;

    weeklyHistoryMessageEl.textContent = "";
    weeklyHistoryMessageEl.className = "message";
    weeklyHistoryTableBody.innerHTML = "";

    try {
      const response = await fetch("/api/reports");
      const reports = await response.json();

      if (!response.ok) {
        throw new Error(reports.error || "Failed to load weekly reports.");
      }

      if (!Array.isArray(reports) || reports.length === 0) {
        weeklyHistoryMessageEl.textContent = "No weekly report history found.";
        weeklyHistoryMessageEl.className = "message error";
        return;
      }

      reports.forEach((report) => {
        const row = document.createElement("tr");

        row.innerHTML = `
        <td>${formatDate(report.week_start)}</td>
        <td>${formatDate(report.week_end)}</td>
        <td>${report.submitted ?? 0}</td>
        <td>${formatDate(report.submitted_at)}</td>
        <td>
          <button type="button" class="view-report-btn" data-id="${report.id}">View</button>
        </td>
      `;

        weeklyHistoryTableBody.appendChild(row);
      });

      wireViewReportButtons();
    } catch (error) {
      console.error("Failed to load weekly report history:", error);
      weeklyHistoryMessageEl.textContent = "Failed to load weekly report history.";
      weeklyHistoryMessageEl.className = "message error";
    }
  }

async function checkAuth() {
  const response = await fetch("/api/auth/me");

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  APP_ENV = data.app_env || "production";
  return data.user;
}

  function wireSelectionCheckboxes() {
    const checkboxes = document.querySelectorAll(".select-checkbox");

    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number(checkbox.dataset.id);

        if (checkbox.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }

        updateSelectionCount();
      });
    });
  }

function wireEditButtons() {
  const editButtons = document.querySelectorAll(".edit-btn");

  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      const contact = contacts.find((item) => item.id === id);

      if (!contact) return;

      editId = id;
      selectedIds.clear();
      updateSelectionCount();

      Object.keys(contact).forEach((key) => {
        const field = form?.elements?.[key];
        if (field) {
          field.value =
            key === "date_contacted" || key === "next_follow_up_date"
              ? formatDate(contact[key])
              : (contact[key] || "");
        }
      });

      if (form?.elements?.website) {
        form.elements.website.value = contact.website || "";
      }

      showSection("contactFormSection");
      renderErrors(errorsDiv, []);
      renderMessage(
        messageDiv,
        "Editing contact. Update fields and click Save Contact."
      );
    });
  });
}

function wireDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".delete-btn");

  deleteButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const id = Number(button.dataset.id);

      try {
        const response = await fetch(`/api/contacts/${id}`, {
          method: "DELETE"
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to delete contact");
        }

        selectedIds.clear();
        await loadContacts();
        renderTable();
        renderMessage(messageDiv, "Contact deleted successfully.");
        renderErrors(errorsDiv, []);
        clearWeeklyReportDetail();
      } catch (error) {
        console.error("Delete failed:", error);
        renderMessage(messageDiv, "Failed to delete contact.", "error");
      }
    });
  });
}
function renderTable() {
  console.log("RENDER TABLE CALLED", contacts);
  const tableBody = document.querySelector("#contactsTable tbody");
  const savedContactsSummary = document.getElementById("savedContactsSummary");

  if (!tableBody) return;

  tableBody.innerHTML = "";

  const activeContacts = contacts.filter((c) => {
    const status = String(c.status || "").trim().toLowerCase();
    return status !== "rejected" && status !== "closed" && status !== "submitted";
  });

  const totalSaved = activeContacts.length;

  const totalReported = activeContacts.filter((c) => {
    return String(c.reported_unemployment || "No").trim().toLowerCase() === "yes";
  }).length;

  if (savedContactsSummary) {
    savedContactsSummary.textContent =
      `Total Saved: ${totalSaved} | Total Reported: ${totalReported}`;
  }

  const filteredContacts = activeContacts.filter((c) => {
    return String(c.reported_unemployment || "No").trim().toLowerCase() !== "yes";
  });

  const sortedContacts = sortSavedContacts(
    filteredContacts,
    currentSortField,
    currentSortDirection
  );

  sortedContacts.forEach((c) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <input type="checkbox" class="select-checkbox" data-id="${c.id}" ${selectedIds.has(c.id) ? "checked" : ""} />
      </td>
      <td>${formatDate(c.date_contacted)}</td>
      <td>${escapeHtml(c.company || "")}</td>
      <td class="${getStatusClass(c.status)}">${escapeHtml(c.status || "")}</td>
      <td>${escapeHtml(c.reported_unemployment || "No")}</td>
      <td>
        ${isAdminUser() ? `
          <button type="button" class="edit-btn" data-id="${c.id}">Edit</button>
          <button type="button" class="delete-btn" data-id="${c.id}">Delete</button>
        ` : ""}
      </td>
    `;

    tableBody.appendChild(row);
  });

  wireSelectionCheckboxes();
  wireEditButtons();
  wireDeleteButtons();
  updateSelectionCount();
  applyRoleBasedAccess();
}

function wireSavedContactsSorting() {
  const sortDateHeader = document.getElementById("sortDateHeader");
  const sortCompanyHeader = document.getElementById("sortCompanyHeader");

  sortDateHeader?.addEventListener("click", () => {
    if (currentSortField === "date_contacted") {
      currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
      currentSortField = "date_contacted";
      currentSortDirection = "desc";
    }

    renderTable();
  });

  sortCompanyHeader?.addEventListener("click", () => {
    if (currentSortField === "company") {
      currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
    } else {
      currentSortField = "company";
      currentSortDirection = "asc";
    }

    renderTable();
  });
}

function showSection(sectionId) {
  console.log("SHOW SECTION:", sectionId);

  document.querySelectorAll(".careerops-section").forEach((section) => {
    section.classList.remove("active-section");
  });

  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add("active-section");
    currentSectionIndex = sectionOrder.indexOf(sectionId);
    updateNavButtons();
  } else {
    console.error("SECTION NOT FOUND:", sectionId);
  }
}

function updateNavButtons() {
  const backBtn = document.getElementById("backBtn");
  const nextBtn = document.getElementById("nextBtn");
  const mainMenuBtn = document.getElementById("mainMenuBtn");

  if (!backBtn || !nextBtn || !mainMenuBtn) return;

  backBtn.style.display = currentSectionIndex === 0 ? "none" : "inline-block";
  mainMenuBtn.style.display = currentSectionIndex === 0 ? "none" : "inline-block";

  if (sectionOrder[currentSectionIndex] === "weeklyReportHistorySection") {
    nextBtn.style.display = "none";
  } else if (currentSectionIndex === 0) {
    nextBtn.style.display = "none";
  } else {
    nextBtn.style.display = "inline-block";
  }
}

function goBackSection() {
  if (currentSectionIndex > 0) {
    showSection(sectionOrder[currentSectionIndex - 1]);
  }
}

function goNextSection() {
  if (currentSectionIndex < sectionOrder.length - 1) {
    showSection(sectionOrder[currentSectionIndex + 1]);
  }
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
}  

console.log("🚀 DOMContentLoaded fired");
document.addEventListener("DOMContentLoaded", async () => {
  renderDemoBanner();

  document.getElementById("mainMenuBtn")?.addEventListener("click", () => {
    showSection("landingPage");
  });

  document.getElementById("backBtn")?.addEventListener("click", () => {
    goBackSection();
  });

  document.getElementById("nextBtn")?.addEventListener("click", () => {
    goNextSection();
  });

  document.getElementById("savedContactsTab")?.addEventListener("click", (event) => {
    event.preventDefault();
    console.log("NAV CLICK: savedContactsSection");
    showSection("savedContactsSection");
  });

  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const target = button.dataset.target;
      if (!target) return;

      console.log("NAV CLICK:", target);
      showSection(target);
    });
  });

  const user = await checkAuth();
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  window.currentUser = user;
  console.log("currentUser:", window.currentUser);

  form = document.getElementById("contactForm");
  errorsDiv = document.getElementById("formErrors");
  messageDiv = document.getElementById("formMessage");
  resetButton = document.getElementById("resetButton");
  unemploymentForm = document.getElementById("unemploymentForm");
  dateInput = document.getElementById("date_contacted");
  companyInput = document.getElementById("company");
  companySuggestions = document.getElementById("companySuggestions");
  selectionCountEl = document.getElementById("selectionCount");
  generateReportBtn = document.getElementById("generateReportBtn");
  viewButton = document.getElementById("viewButton");
  viewButton?.addEventListener("click", handleViewSelectedClick);
  weeklyHistoryMessageEl = document.getElementById("weekly-report-history-message");
  weeklyHistoryTableBody = document.querySelector("#weekly-report-history-table tbody");
  weeklyReportDetailEl = document.getElementById("weekly-report-detail");
  closeWeeklyReportDetailBtn = document.getElementById("closeWeeklyReportDetailBtn");
  const startValidationRunBtn = document.getElementById("startValidationRunBtn");
  const completeValidationRunBtn = document.getElementById("completeValidationRunBtn");
  wireSavedContactsSorting();

  applyRoleBasedAccess();
  console.log("📡 About to call loadContacts");

  const today = new Date().toISOString().split("T")[0];
  contacts = [];
  selectedIds.clear();
  editId = null;

  document.getElementById("mainMenuBtn")?.addEventListener("click", () => {
    showSection("landingPage");
  });

  document.getElementById("backBtn")?.addEventListener("click", () => {
    goBackSection();
  });

  document.getElementById("nextBtn")?.addEventListener("click", () => {
    goNextSection();
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await logout();
  });

  document.getElementById("savedContactsTab")?.addEventListener("click", (event) => {
  event.preventDefault();
  console.log("NAV CLICK: savedContactsSection");
  showSection("savedContactsSection");
});

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();

    const target = button.dataset.target;
    if (!target) return;

    console.log("NAV CLICK:", target);
    showSection(target);
  });
});

  const today = new Date().toISOString().split("T")[0];
  contacts = [];
  selectedIds.clear();
  editId = null;

  try {
    await startAnalyticsSession();
    startAnalyticsHeartbeat();
  } catch (error) {
    console.error("Analytics startup failed:", error);
  }

  messageDiv = document.getElementById("formMessage");

  try {
    if (dateInput) {
      dateInput.value = today;
    }

    await loadContacts();
    renderTable();
    await loadValidationRuns();
    await loadWeeklyReportHistory();
    updateSelectionCount();
    clearWeeklyReportDetail();

    await loadAnalyticsSummary();
    await loadAnalyticsTrend();
  } catch (error) {
    console.error("Initial page load failed:", error);
  }

  setTimeout(loadActiveUsers, 2000);
  setInterval(loadActiveUsers, 15000);

  setTimeout(loadStaleSessions, 2000);
  setInterval(loadStaleSessions, 15000);

  setTimeout(loadSessionsToday, 2000);
  setInterval(loadSessionsToday, 15000);

  setTimeout(loadAnalyticsSummary, 2000);
  setInterval(loadAnalyticsSummary, 30000);

  setInterval(loadAnalyticsTrend, 60000);

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const contact = Object.fromEntries(formData.entries());
    const validation = validateContact(contact);

    if (!validation.valid) {
      renderErrors(errorsDiv, validation.errors);
      return;
    }

    renderErrors(errorsDiv, []);

    try {
      let response;
      let result;

      if (editId !== null) {
        response = await fetch(`/api/contacts/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(contact)
        });

        result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to update contact");
        }

        renderMessage(messageDiv, "Contact updated successfully.");
        editId = null;
      } else {
        response = await fetch("/api/contacts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(contact)
        });

        result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to create contact");
        }

        renderMessage(messageDiv, "Contact saved successfully.");
      }

      await loadContacts();
      selectedIds.clear();
      renderTable();

      form.reset();
      if (dateInput) {
        dateInput.value = today;
      }
    } catch (error) {
      console.error("Save failed:", error);
      renderMessage(messageDiv, error.message || "Failed to save contact.", "error");
    }
  });

  resetButton?.addEventListener("click", () => {
    form?.reset();
    if (dateInput) {
      dateInput.value = today;
    }
    editId = null;
    renderErrors(errorsDiv, []);
    renderMessage(messageDiv, "");
  });

  async function loadCompanyDetails(companyName) {
    console.log("loadCompanyDetails called with:", companyName);
    try {
      const response = await fetch(
        `/api/companies/details?company=${encodeURIComponent(companyName)}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return;
        }
        throw new Error("Failed to fetch company details");
      }

      const companyDetails = await response.json();

      document.getElementById("company").value = companyDetails.company || "";
      document.getElementById("recruiter_name").value = companyDetails.recruiter_name || "";
      document.getElementById("location").value = companyDetails.location || "";
      document.getElementById("role_level").value = companyDetails.role_level || "";
      document.getElementById("role_type").value = companyDetails.role_type || "";
      document.getElementById("status").value = companyDetails.status || "";
      document.getElementById("relationship_status").value = companyDetails.relationship_status || "";
      document.getElementById("phone").value = companyDetails.phone || "";
      document.getElementById("email").value = companyDetails.email || "";
      document.getElementById("address").value = companyDetails.address || "";
      document.getElementById("website").value = companyDetails.website || "";
      document.getElementById("notes").value = companyDetails.notes || "";

      if (companyDetails.date_contacted) {
        document.getElementById("date_contacted").value =
          String(companyDetails.date_contacted).split("T")[0];
      }
    } catch (error) {
      console.error("loadCompanyDetails failed:", error);
      renderMessage(messageDiv, "Failed to load company details.", "error");
    }
  }

  document.getElementById("unemploymentExportBtn")?.addEventListener("click", () => {
    if (!weeklyHistoryTableBody || !weeklyHistoryTableBody.children.length) {
      if (weeklyHistoryMessageEl) {
        weeklyHistoryMessageEl.textContent = "No weekly report history found.";
        weeklyHistoryMessageEl.className = "message error";
      }
      return;
    }

    const firstRow = weeklyHistoryTableBody.children[0];
    const cells = firstRow.querySelectorAll("td");
    const start = cells[0]?.textContent.trim();
    const end = cells[1]?.textContent.trim();

    if (!start || !end) {
      if (weeklyHistoryMessageEl) {
        weeklyHistoryMessageEl.textContent = "Unable to determine report date range.";
        weeklyHistoryMessageEl.className = "message error";
      }
      return;
    }

    window.location.href = `/api/reports/unemployment/export?start=${start}&end=${end}`;
  });

  closeWeeklyReportDetailBtn?.addEventListener("click", () => {
    clearWeeklyReportDetail();
    showSection("savedContactsSection");
  });

  generateReportBtn?.addEventListener("click", async () => {
    if (selectedIds.size !== 4) {
      renderMessage(messageDiv, "You must select exactly 4 employers.", "error");
      return;
    }
    if (!confirm('This will mark selected companies as reported and remove them from the active list. Continue?')) {
      return;
    }

    try {
      const payload = {
        selectedIds: Array.from(selectedIds)
      };

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate report");
      }

      renderMessage(messageDiv, "Weekly report generated successfully.");
      selectedIds.clear();

      await loadContacts();
      renderTable();
      await loadWeeklyReportHistory();
      updateSelectionCount();
      clearWeeklyReportDetail();
    } catch (error) {
      console.error("Generate report failed:", error);
      renderMessage(messageDiv, "Failed to generate weekly report.", "error");
    }
  });

  if (unemploymentForm) {
    unemploymentForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        company: document.getElementById("unemployment_company")?.value.trim(),
        date_reported: document.getElementById("date_reported")?.value,
        notes: document.getElementById("unemployment_notes")?.value.trim()
      };
      try {
        const response = await fetch("/api/unemployment-report", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error("Failed to save unemployment report");
        }

        unemploymentForm.reset();
        renderMessage(messageDiv, "Unemployment report saved successfully.");

        await loadContacts();
        renderTable();
      } catch (error) {
        console.error("Unemployment form save failed:", error);
        renderMessage(messageDiv, "Failed to save unemployment report.", "error");
      }
    });
  }
  
  companyInput?.addEventListener("input", async () => {
    const query = companyInput.value.trim();

    if (query.length < 2) {
      if (companySuggestions) {
        companySuggestions.innerHTML = "";
      }
      return;
    }

    try {
      const response = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`);
      const companies = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load company suggestions");
      }

      if (companySuggestions) {
        companySuggestions.innerHTML = companies
          .map(
            (company) => `
            <div class="suggestion-item">${escapeHtml(company)}</div>
          `
          )
          .join("");
      }

      document.querySelectorAll(".suggestion-item").forEach((item) => {
        item.addEventListener("mousedown", async (event) => {
          event.preventDefault();

          const selectedCompany = item.textContent.trim();
          console.log("Selected company:", selectedCompany);

          companyInput.value = selectedCompany;
          companySuggestions.innerHTML = "";

          await loadCompanyDetails(selectedCompany);
        });
      });
    } catch (error) {
      console.error("Company search failed:", error);
      if (companySuggestions) {
        companySuggestions.innerHTML = "";
      }
    }
  });

  companyInput?.addEventListener("blur", () => {
    setTimeout(() => {
      if (companySuggestions) {
        companySuggestions.innerHTML = "";
      }
    }, 150);
  });

  if (startValidationRunBtn) {
    startValidationRunBtn.addEventListener("click", async () => {
      await startValidationRun();
    });
  }

  if (completeValidationRunBtn) {
  completeValidationRunBtn.addEventListener("click", async () => {
    await completeValidationRun();
  });
}
});