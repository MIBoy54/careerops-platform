import { INDUSTRIES, summarizeIndustries } from "./contactIndustry.js";
import { STAGES, POSITIONS, contactDimensions, summarizeContacts, filterContacts, sortContacts, badgeTone } from './contactStatusView.js';
import { contactStatusBucket, INTERVIEW_STAGES, POSITION_STATUSES } from './contactWorkflow.js';
import { createSessionTrendLoader } from "./sessionTrendChart.js";
console.log("app.js loaded");
let APP_ENV = "production";

import { validateContact } from "./validateContact.js";

function isCurrentUserAdmin() {
    return (
        globalThis.currentUser &&
        globalThis.currentUser.role === "admin"
    );
}

function canHardDelete() {
    return isCurrentUserAdmin();
}

function canWriteDatabase() {
    return isCurrentUserAdmin();
}

function isAdminUser() {
    return isCurrentUserAdmin();
}
console.log("FRONTEND APP_ENV:", globalThis.APP_ENV || "not set");

function applyRoleBasedAccess() {
  const admin = isAdminUser();

  const isDemo =
    APP_ENV === "demo";

  console.log("BANNER CHECK:", {
    APP_ENV,
    host: window.location.hostname,
    isDemo
  });

  const formFields = document.querySelectorAll(
    "#contactForm input, #contactForm select, #contactForm textarea, #contactForm button"
  );

  formFields.forEach((el) => {
    const searchControl = el.id === "company" || el.id === "resetButton" ||
      el.closest("#companySuggestions");
    el.disabled = !admin && !searchControl;
  });

  if (generateReportBtn) {
    generateReportBtn.disabled =
      isDemoEnvironment() || !canWriteDatabase() || selectedIds.size !== 4;

    generateReportBtn.classList.toggle("disabled-btn", generateReportBtn.disabled);
  }

console.log("IS DEMO:", isDemo, "HOST:", window.location.hostname);

  let banner = document.getElementById("environmentBanner");

    if (!banner) {
    banner = document.createElement("div");
    banner.id = "environmentBanner";

    banner.style.background = "#f59e0b";
    banner.style.color = "#000";
    banner.style.textAlign = "center";
    banner.style.padding = "8px";
    banner.style.fontWeight = "bold";
    banner.style.letterSpacing = "0.5px";
    banner.style.position = "fixed";
    banner.style.top = "0";
    banner.style.left = "0";
    banner.style.right = "0";
    banner.style.zIndex = "9999";

    document.body.prepend(banner);
  }

  if (isDemo) {
    banner.style.display = "block";
    banner.textContent = "CAREEROPS PLATFORM • DEMO • PROTECTED PROD VIEW";
    document.body.style.paddingTop = "40px";
  } else {
    banner.style.display = "none";
    banner.textContent = "";
    document.body.style.paddingTop = "0";
  }
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
let selectedReportRange = null;

let activeUsersRefreshMs = 348000; // default 5m 48s
let activeUsersInterval = null;

const contactFilters = { stage: "all", position: "all", reported: "all" };

const sectionOrder = [
  "telemetrySection",
  "dashboardSection",
  "contactFormSection",
  "savedContactsSection",
  "detailViewerSection",
  "weeklyReportHistorySection"
];

function escapeHtml(value) {
  return String(value !== null && value !== undefined ? value : "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function valueOrDefault(value, fallback) {
  return value !== null && value !== undefined ? value : fallback;
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
    Number(valueOrDefault(data.totals.total_visits, 0)).toLocaleString();

  document.getElementById("uniqueVisitors").textContent =
    Number(valueOrDefault(data.totals.unique_visitors, 0)).toLocaleString();

  document.getElementById("totalTime").textContent =
    formatSeconds(valueOrDefault(data.totals.total_time_spent_seconds, 0));

  document.getElementById("avgTime").textContent =
    formatSeconds(valueOrDefault(data.totals.avg_time_spent_seconds, 0));

  const lastVisitor = data.totals.last_visitor;

  document.getElementById("lastUpdated").textContent =
    lastVisitor
      ? new Date(lastVisitor).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true
        })
      : "No visits this month";

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

function renderAnalyticsMonth() {
  const heading =
    document.getElementById("analyticsHeading");

  if (!heading) return;

  heading.textContent =
    `System Analytics (for ${new Date().toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    })})`;
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

const loadAnalyticsTrend = createSessionTrendLoader(document.getElementById("sessionTrendChart"));

async function loadValidationRuns() {
  try {
    const response = await fetch(`/api/validation-runs?ts=${Date.now()}`, {
      credentials: "same-origin",
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Failed to load validation runs");
    }

    validationRuns = await response.json();

    renderMessage(
      document.getElementById("validationRunMessage"),
      ""
    );

    //renderValidationRunsTable();
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

async function loadQualityGateSummary() {
  const container = document.getElementById("validationRunsTable");
  if (!container) return;

  if (!container.children.length) container.innerHTML = `<div class="quality-empty">Loading quality gates...</div>`;

  try {
    const response = await fetch("/api/github/actions-summary", {cache:"no-store"});

    if (!response.ok) {
      throw new Error("Failed API response");
    }

    const gates = await response.json();

    console.log("QUALITY GATES:", gates);
    const checked = document.getElementById("qualityGateCheckedAt");
    if (checked) checked.textContent = gates[0]?.checkedAt
      ? "Checked: " + new Date(gates[0].checkedAt).toLocaleString()
      : "";

    container.innerHTML = gates
      .map((gate) => {
        const failed = ['failure','failed','timed_out','action_required','startup_failure'].includes(gate.status);
        const running = ['queued','in_progress','waiting','pending','requested'].includes(gate.status);
        const statusClass = gate.status === 'success' ? 'quality-success'
          : failed ? 'quality-failed' : running ? 'quality-running' : 'quality-neutral';
        const icon = gate.status === 'success' ? '✓' : failed ? '✕' : running ? '…' : '—';
        const label = ({success:'Passed',failure:'Failed',failed:'Failed',timed_out:'Timed out',
          action_required:'Action required',startup_failure:'Startup failed',queued:'Queued',
          in_progress:'Running',waiting:'Waiting',pending:'Pending',requested:'Requested',
          cancelled:'Cancelled',skipped:'Skipped',unknown:'No run',unavailable:'Unavailable'})[gate.status] || 'Unknown';

        const completedAt = gate.completedAt
          ? new Date(gate.completedAt).toLocaleString()
          : "Not available";

        return `
          <article class="quality-card ${statusClass}">
            <div class="quality-gate-icon">${icon}</div>

            <div class="quality-card-content">
              <div class="quality-run-title">${escapeHtml(gate.environment)} Quality Gate</div>

              <div class="quality-run-meta">
                ${escapeHtml(label)} · CareerOps CI #${escapeHtml(String(gate.runNumber ?? "—"))} · ${escapeHtml(gate.workflow || "")}
              </div>

              <div class="quality-run-meta">
                Branch ${escapeHtml(gate.branch || "")} · Commit ${escapeHtml(gate.commit || "")}
              </div>

              <div class="quality-run-details">
                <div>
                  <span class="quality-label">Last Run</span>
                  ${completedAt}
                </div>

                <div>
                  <span class="quality-label">Duration</span>
                  ${escapeHtml(gate.duration || "Not available")}
                </div>
              </div>
            </div>

            <div class="quality-gate-branch">${escapeHtml(gate.environment)}</div>
          </article>
        `;
      })
      .join("");
  } catch (error) {
    console.error("Failed to load quality gate summary:", error);
    container.innerHTML = `<div class="quality-empty">Failed to load quality gates.</div>`;
  }
}

function renderValidationRunsTable() {
  const container = document.getElementById("validationRunsTable");

  if (!container) {
    console.error("validationRunsTable container missing");
    return;
  }

  if (!validationRuns.length) {
    container.innerHTML = `
      <div class="quality-empty">
        No validation runs recorded.
      </div>
    `;
    return;
  }

  container.innerHTML = validationRuns
    .map((run) => {
    let statusClass = "quality-running";

    if (run.status === "COMPLETED") {
    statusClass = "quality-success";
    } else if (run.status === "FAILED") {
    statusClass = "quality-failed";
    }

      return `
        <div class="quality-card ${statusClass}">
          <div class="quality-card-header">
            <div>
              <div class="quality-run-title">${run.run_type}</div>
              <div class="quality-run-meta">
                Run #${run.id} • ${run.trigger_source}
              </div>
            </div>

            <div class="quality-status-pill">
              ${run.status}
            </div>
          </div>

          <div class="quality-card-grid">
            <div>
              <label>Started</label>
              <span>${run.started_at || "-"}</span>
            </div>

            <div>
              <label>Completed</label>
              <span>${run.completed_at || "-"}</span>
            </div>

            <div>
              <label>Duration</label>
              <span>${run.duration || "-"}</span>
            </div>

            <div>
              <label>Notes</label>
              <span>${run.notes || "-"}</span>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}
  async function startValidationRun() {
    const messageDiv = document.getElementById("validationRunMessage");

    try {
        const response = await fetch("/api/validation-runs/start", {
          method: "POST",
          credentials: "same-origin",
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
      //await loadValidationRuns();
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
      credentials: "same-origin",
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
      //await loadValidationRuns();
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
    }, 15000);
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


function getCompAverage(compRange) {

  if (!compRange ||
      String(compRange).trim() === "" ||
      String(compRange).trim().toUpperCase() === "NULL") {
    return null;
  }

  const cleaned = String(compRange)
    .replace(/,/g, "")
    .replace(/\$/g, "")
    .replace(/[Kk]/g, "000");

  const numbers = cleaned.match(/\d+/g);

  if (!numbers || numbers.length === 0) {
    return null;
  }

  if (numbers.length === 1) {
    return Number(numbers[0]);
  }

  const low = Number(numbers[0]);
  const high = Number(numbers[1]);

  return (low + high) / 2;
}

async function loadDemoRefreshStatus() {
  const timeEl = document.getElementById("dashboardDemoRefreshTime");
  const detailsEl = document.getElementById("dashboardDemoRefreshDetails");

  if (!timeEl || !detailsEl) return;

  try {
    const response = await fetch("/api/demo-refresh/latest");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.snapshot?.capturedAt) {
      document.getElementById("dashboardDemoRefreshLabel").textContent = "Your DEMO snapshot:";
      timeEl.textContent = new Date(data.snapshot.capturedAt).toLocaleString(undefined, { timeZoneName: "short" });
      detailsEl.textContent = " · Protected LIVE data at your time of entry";
      return;
    }
    const refresh = data.refresh;

    if (!refresh || !refresh.completed_at) {
      timeEl.textContent = "No completed refresh recorded";
      detailsEl.textContent = "";
      return;
    }

    const completedAt = new Date(refresh.completed_at);

    timeEl.textContent = completedAt.toLocaleString();
    detailsEl.textContent =
      ` · ${refresh.status} · ${Number(refresh.rows_synced || 0).toLocaleString()} rows synced`;
  } catch (error) {
    console.error("Failed to load demo refresh status:", error);
    timeEl.textContent = "Unavailable";
    detailsEl.textContent = "";
  }
}

function updateDashboard() {
  loadDemoRefreshStatus();
  updateWorkflowTotals();
  const total = contacts.length;

  const appliedSubmitted = contacts.filter(
    c => getContactStatusBucket(c) === "appliedSubmitted"
  ).length;

  const interviewing = contacts.filter(
    c => getContactStatusBucket(c) === "interviewing"
  ).length;

  const offers = contacts.filter(c =>
  String(c.status || "").trim().toLowerCase() === "offer"
).length;

  const accepted = contacts.filter(c =>
    String(c.status || "").trim().toLowerCase() === "accepted"
    ).length;

  const offerRate = interviewing > 0
        ? ((offers / interviewing) * 100).toFixed(1)
      : "0.0";

  setText("dashboardFunnelOfferRate", `${offerRate}%`);
  setText("dashboardOpenInterviews", interviewing);

  const rejectedClosed = contacts.filter(
    c => getContactStatusBucket(c) === "rejectedClosed"
  ).length;

  const reported = contacts.filter(c =>
    contactDimensions(c).reported === "Reported"
  ).length;

  const notReported = total - reported;

  const stages = summarizeContacts(contacts).stage;
  const interviewCount = stages["Recruiter Interview"] + stages["HR Interview"] + stages["Hiring Interview"];
  const interviewRate = total > 0
    ? ((interviewCount / total) * 100).toFixed(1)
    : "0.0";

  setText("dashboardAppliedSubmitted", appliedSubmitted);
  setText("dashboardInterviewing", interviewing);
  setText("dashboardRejectedClosed", rejectedClosed);
  setText("dashboardTotal", total);
  setText("dashboardReported", reported);
  setText("dashboardNotReported", notReported);
  document.getElementById("dashboardInterviewRate").textContent = `${interviewRate}%`;

  // Funnel card
  setText("dashboardFunnelTotal", total);
  setText("dashboardFunnelApplied", appliedSubmitted);
  setText("dashboardFunnelInterviewing", interviewing);
  setText("dashboardFunnelInterviewRate", `${interviewRate}%`);

const salary100 = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg < 100000;
}).length;

const salary125 = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg >= 100000 && avg < 125000;
}).length;

const salary150 = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg >= 125000 && avg < 150000;
}).length;

const salary175 = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg >= 150000 && avg < 175000;
}).length;

const salary200 = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg >= 175000 && avg < 200000;
}).length;

const salary200plus = contacts.filter(c => {
  const avg = getCompAverage(c.comp_range);
  return avg !== null && avg >= 200000;
}).length;

const salaryUnknown = contacts.filter(c =>
  getCompAverage(c.comp_range) === null
).length;

setText("dashboardSalary100", salary100);
setText("dashboardSalary125", salary125);
setText("dashboardSalary150", salary150);
setText("dashboardSalary175", salary175);
setText("dashboardSalary200", salary200);
setText("dashboardSalary200plus", salary200plus);
setText("dashboardSalaryUnknown", salaryUnknown);

const warm = contacts.filter(
    c => String(c.relationship_status).toLowerCase() === "warm"
).length;

const activeRelationship = contacts.filter(
  c => String(c.relationship_status).toLowerCase() === "active"
).length;

const cold = contacts.filter(
    c => String(c.relationship_status).toLowerCase() === "cold"
).length;

const inactive = contacts.filter(
    c => String(c.relationship_status).toLowerCase() === "inactive"
).length;

document.getElementById("dashboardWarm").textContent = warm;
document.getElementById("dashboardActive").textContent = activeRelationship;
document.getElementById("dashboardCold").textContent = cold;
document.getElementById("dashboardInactive").textContent = inactive;

const qaEngineer = contacts.filter(c =>
  String(c.role_level || "").trim().toLowerCase() === "qa engineer"
).length;

const lead = contacts.filter(c =>
  String(c.role_level || "").trim().toLowerCase() === "lead"
).length;

const manager = contacts.filter(c =>
  String(c.role_level || "").trim().toLowerCase() === "manager"
).length;

const seniorManager = contacts.filter(c =>
  String(c.role_level || "").trim().toLowerCase() === "senior manager"
).length;

const executive = contacts.filter(c =>
  String(c.role_level || "").trim().toLowerCase() === "executive"
).length;

document.getElementById("dashboardQaEngineer").textContent = qaEngineer;
document.getElementById("dashboardLead").textContent = lead;
document.getElementById("dashboardManager").textContent = manager;
document.getElementById("dashboardSeniorManager").textContent = seniorManager;
document.getElementById("dashboardExecutive").textContent = executive;

const remote = contacts.filter(c =>
    String(c.location || "").toLowerCase().includes("remote")
).length;

const hybrid = contacts.filter(c =>
    String(c.location || "").toLowerCase().includes("hybrid")
).length;

const onsite = contacts.length - remote - hybrid;

document.getElementById("dashboardRemote").textContent = remote;
document.getElementById("dashboardHybrid").textContent = hybrid;
document.getElementById("dashboardOnsite").textContent = onsite;

const active = appliedSubmitted + interviewing + contacts.filter(c=>contactStatusBucket(c)==="awaitingDecision").length;

setText("dashboardFunnelOffers", offers);
setText("dashboardFunnelAccepted", accepted);
setText("dashboardFunnelOfferRate", `${offerRate}%`);;

document.getElementById("dashboardKpiTotal").textContent = total;
document.getElementById("dashboardKpiActive").textContent = active;
document.getElementById("dashboardKpiInterviews").textContent = interviewCount;
document.getElementById("dashboardKpiInterviewRate").textContent = `${interviewRate}%`;

document.getElementById("dashboardFunnelTotal").textContent = total;
document.getElementById("dashboardFunnelApplied").textContent = appliedSubmitted;
document.getElementById("dashboardFunnelInterviewing").textContent = interviewing;
document.getElementById("dashboardFunnelOffers").textContent = offers;
document.getElementById("dashboardFunnelAccepted").textContent = accepted;

const now = new Date();

function daysSince(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

const last7Days = contacts.filter(c => {
  const days = daysSince(c.date_contacted);
  return days !== null && days <= 7;
}).length;

const last30Days = contacts.filter(c => {
  const days = daysSince(c.date_contacted);
  return days !== null && days <= 30;
}).length;

const followUpsDue = contacts.filter(c => {
  if (!c.next_follow_up_date) return false;

  const dueDate = new Date(c.next_follow_up_date);
  if (Number.isNaN(dueDate.getTime())) return false;

  return dueDate <= now;
}).length;

const fresh = contacts.filter(c => {
  const days = daysSince(c.date_contacted);
  return days !== null && days <= 7;
}).length;

const aging = contacts.filter(c => {
  const days = daysSince(c.date_contacted);
  return days !== null && days > 7 && days <= 14;
}).length;

const stale = contacts.filter(c => {
  const days = daysSince(c.date_contacted);
  return days !== null && days > 14;
}).length;

document.getElementById("dashboardLast7Days").textContent = last7Days;
document.getElementById("dashboardLast30Days").textContent = last30Days;
document.getElementById("dashboardFollowUpsDue").textContent = followUpsDue;

document.getElementById("dashboardFresh").textContent = fresh;
document.getElementById("dashboardAging").textContent = aging;
document.getElementById("dashboardStale").textContent = stale;
}

function getCompMin(compRange) {
    if (!compRange || String(compRange).trim() === "") {
        return null;
    }

    const matches = String(compRange).toUpperCase().match(/\d+/g);

    if (!matches || matches.length === 0) {
        return null;
    }

    let first = Number(matches[0]);

    if (first < 1000) {
        first *= 1000;
    }

    return first;
}

function renderSelectedContacts(selected) {
  if (!weeklyReportDetailEl) return;

  weeklyReportDetailEl.innerHTML = `
    <h3>Selected Employer Details</h3>
    ${selected.map((contact) => `
      <div class="contact-card">
        <p><strong>ID:</strong> ${
          contact.id !== null && contact.id !== undefined
            ? contact.id
            : ""
        }</p>
        <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
        <p><strong>Recruiter Name:</strong> ${escapeHtml(contact.recruiter_name || "")}</p>
        <p><strong>Company:</strong> ${escapeHtml(contact.company || "")}</p>
        <p><strong>Role Type:</strong> ${escapeHtml(contact.role_category || "Unclassified")}</p>
        <p><strong>Hiring Workflow:</strong> ${escapeHtml(contact.hiring_stage || "Unclassified")}</p>
        <p><strong>Position Status:</strong> ${escapeHtml(contact.position_status || "Unclassified")}</p>
        <p><strong>Previous Status:</strong> ${escapeHtml(contact.status || "")}</p>
        <p><strong>Reported to Unemployment:</strong> ${escapeHtml(contact.reported_unemployment || "No")}</p>
      </div>
    `).join("")}
  `;
}

function handleViewSelectedClick() {
  updateSelectionCount();

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

  function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

  function getContactUniqueKey(contact) {
    return [
      normalizeKey(contact.company),
      normalizeKey(contact.role_title),
      normalizeKey(contact.role_level), normalizeKey(contact.role_category),
      normalizeKey(contact.hiring_stage), normalizeKey(contact.position_status)
    ].join("|");
  }


function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getContactStatusBucket(contact) { return contactStatusBucket(contact); }

function showWorkflowContext(contact) {
  if (!form?.elements) return;
  for (const field of ['role_category','hiring_stage','position_status']) {
    if (form.elements[field]) form.elements[field].value = contact[field] ?? "";
  }
  const context = document.getElementById('legacyWorkflowContext');
  if (context) {
    const parts=[];
    if (contact.role_type && (!contact.role_category || contact.role_type !== contact.role_category)) parts.push('Previous category: '+contact.role_type);
    if (contact.status) parts.push('Previous status: '+contact.status);
    context.textContent=parts.join(' · ');
  }
}

const GHOSTED_CUTOFFS = Object.freeze({
  Applied: "2026-08-31",
  Submitted: "2026-09-30"
});

function stageResultsContacts(stage) {
  if (Object.hasOwn(GHOSTED_CUTOFFS, stage)) {
    return contacts.filter(contact => normalizeStatus(contact.status) === normalizeStatus(stage));
  }
  return filterContacts(contacts, { stage });
}

function updateWorkflowTotals() {
  const summary = summarizeContacts(contacts);
  for (const stage of Object.keys(GHOSTED_CUTOFFS)) {
    summary.stage[stage] = stageResultsContacts(stage).length;
  }
  const group = (title, entries) => '<section><h3>' + title + '</h3><dl>' + Object.entries(entries).filter(([label]) => label !== 'Unclassified').map(([label, count]) => '<div><dt>' + (title === 'Hiring stage' && (INTERVIEW_STAGES.includes(label) || Object.hasOwn(GHOSTED_CUTOFFS, label) || label === "Offer Letter") ? '<button type="button" data-results-stage="' + escapeHtml(label) + '">' + escapeHtml(label) + '</button>' : escapeHtml(label)) + '</dt><dd>' + count + '</dd></div>').join('') + '</dl></section>';
  const html = '<p><strong>All records: ' + summary.total + '</strong></p><div class="contact-totals-grid">' + group('Hiring stage', summary.stage) + group('Position status', summary.position) + group('Reporting', summary.reported) + '</div><p class="summary-note">All records includes contacts without a hiring stage or position status. Filters change the table below.</p>';
  for (const id of ['contactTotals', 'dashboardContactTotals']) {
    const element = document.getElementById(id);
    if (!element) continue;
    element.innerHTML = html;
    for (const button of element.querySelectorAll('[data-results-stage]')) {
      button.addEventListener('click', () => showHiringResults(button.dataset.resultsStage));
    }
  }
}
let hiringResultsReturnStage = null;

function updateInterviewDateVisibility() {
  const stage = document.getElementById("hiring_stage").value;
  document.getElementById("interviewDateField").hidden = !INTERVIEW_STAGES.includes(stage);
}

function loadContactForEditing(contact) {
  form.reset();
  editId = contact.id;
  for (const [key,value] of Object.entries(contact)) {
    const field = form.elements[key];
    if (field) field.value = key === "date_contacted" || key === "next_follow_up_date"
      ? formatDate(value) : value ?? "";
  }
  showWorkflowContext(contact);
  const status = document.getElementById("companySearchStatus");
  if (status) status.textContent = "Selected " + (contact.company || "contact") + ".";
  renderMessage(messageDiv, canWriteDatabase()
    ? "Existing contact loaded. Update fields and click Save Contact."
    : "Contact loaded for viewing. Changes are disabled.");
  updateInterviewDateVisibility();
  applyRoleBasedAccess();
}

function showHiringResults(stage) {
  const dialog = document.getElementById("interviewResults");
  const body = dialog.querySelector("tbody");
  dialog.querySelector("h2").textContent = stage + " results";
  const message = dialog.querySelector("[role=status]");
  message.textContent = "";
  body.replaceChildren();
  const editable = APP_ENV === "production" && canWriteDatabase();
  dialog.querySelector("#interviewEditHeader").hidden = !editable;
  const interview = INTERVIEW_STAGES.includes(stage);
  const cutoff = GHOSTED_CUTOFFS[stage];
  const dateField = interview ? "interview_date" : "date_contacted";
  dialog.querySelector("#resultsDateHeader").textContent = interview ? "Interview Date" : "Date Contacted";
  dialog.querySelector("#resultsRelationshipHeader").hidden = interview;
  const matches = stageResultsContacts(stage);
  const rows = sortContacts(interview
    ? matches.map(contact => ({ ...contact, date_contacted: contact.interview_date }))
    : matches);
  if (!rows.length) message.textContent = "No contacts in this hiring stage.";
  for (const contact of rows) {
    const row = body.insertRow();
    const date = formatDate(contact[dateField]);
    row.insertCell().textContent = date;
    row.insertCell().textContent = contact.company ?? "";
    if (!interview) row.insertCell().textContent = contact.relationship_status ?? "";
    const cell = row.insertCell();
    const ghostedDefault = cutoff && date >= cutoff;
    if (interview) {
      renderInterviewPositionStatus(cell, contact, stage, dialog, message);
    } else {
      cell.textContent = ghostedDefault ? "Ghosted" : contact.position_status ?? "";
    }
    if (editable) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit Contact";
      edit.setAttribute("aria-label", "Edit Contact for " + (contact.company ?? "contact"));
      edit.addEventListener("click", () => {
        dialog.close();
        showSection("contactFormSection");
        loadContactForEditing(contacts.find(record => record.id === contact.id));
        if (ghostedDefault) form.elements.position_status.value = "Ghosted";
        hiringResultsReturnStage = stage;
        form.elements[interview ? "interview_date" : "position_status"].focus();
      });
      row.insertCell().append(edit);
    }
  }
  if (!dialog.open) dialog.showModal();
}

function renderInterviewPositionStatus(cell, contact, stage, dialog, message) {
  const previousStatus = contact.position_status ?? null;
  if (APP_ENV === "demo" || !canWriteDatabase()) {
    cell.textContent = previousStatus ?? "";
    return;
  }
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Position status for " + (contact.company ?? "contact"));
  if (!POSITION_STATUSES.includes(previousStatus)) {
    const placeholder = new Option(previousStatus ?? "Select status", "");
    placeholder.disabled = true;
    select.add(placeholder);
  }
  for (const status of POSITION_STATUSES) select.add(new Option(status, status));
  select.value = POSITION_STATUSES.includes(previousStatus) ? previousStatus : "";
  select.addEventListener("change", async () => {
    select.disabled = true;
    message.textContent = "";
    try {
      const response = await fetch("/api/contacts/" + encodeURIComponent(contact.id) + "/interview-status", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, previousStatus, status: select.value })
      });
      if (!response.ok) throw new Error((await response.json()).error || "Status update failed.");
      await loadContacts();
      if (dialog.open) {
        showHiringResults(stage);
        message.textContent = "Position status saved.";
      }
    } catch (error) {
      message.textContent = error.message;
      select.value = POSITION_STATUSES.includes(previousStatus) ? previousStatus : "";
    } finally {
      select.disabled = false;
    }
  });
  cell.append(select);
}

function updateContactStatusTotals() { updateWorkflowTotals(); }

async function loadContacts() {
  console.log("LOAD CONTACTS CALLED");

  const response = await fetch("/api/contacts", {
    credentials: "same-origin"
  });

  console.log("LOAD CONTACTS STATUS:", response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("LOAD CONTACTS RESPONSE BODY:", errorText);
    throw new Error(`Failed to load contacts (${response.status})`);
  }

contacts = await response.json();
selectedIds = new Set([...selectedIds].filter(id => contacts.some(contact => contact.id === id && contactDimensions(contact).reported === "Not Reported")));

updateContactStatusTotals();
updateDashboard();

console.log("LOAD CONTACTS RESULT COUNT:", contacts.length);
console.log("LOAD CONTACTS RESULT:", contacts);
console.log("DASHBOARD UPDATE COMPLETE");
console.log("DASHBOARD CONTACTS:", contacts.length);

savedContacts = [...contacts];
if (companyInput && document.activeElement === companyInput) {
  companyInput.dispatchEvent(new Event("input"));
}

renderTable();

console.log("ABOUT TO CALL INDUSTRY MIX");
updateIndustryMix();
  console.log("RETURNED FROM INDUSTRY MIX");
updateLeadSourceMix();
}

function updateIndustryMix() {
  const list = document.getElementById("industryMixList");
  if (!list) return;
  const entries = summarizeIndustries(contacts);
  list.replaceChildren(...entries.map(({ industry, count }) => {
    const row = document.createElement("p");
    row.textContent = industry + ": " + count;
    return row;
  }));
  if (!entries.length) list.textContent = "No contacts yet.";
}

function updateLeadSourceMix() {
  const sourceCounts = {};

  const sourceMap = {
    linkedin: "LinkedIn",
    indeed: "Indeed",
    jobright: "Jobright",
    glassdoor: "Glassdoor",
    ziprecruiter: "ZipRecruiter"
  };

  contacts.forEach(c => {
    const rawSource = String(c.recruiter_name || "")
      .trim();

    const source = rawSource.toLowerCase();

    // Skip blanks and test data
    if (!source || source.includes("test")) {
      return;
    }

    const normalizedSource =
      sourceMap[source] || rawSource;

        sourceCounts[normalizedSource] =
          (sourceCounts[normalizedSource] || 0) + 1;
      });

  const html = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([source, count]) =>
      `<p>${escapeHtml(source)}: ${count}</p>`
    )
    .join("");

  const leadSourceList = document.getElementById("leadSourceList");

  if (leadSourceList) {
    leadSourceList.innerHTML = html;
  }
}

function updateSelectionCount() {
  // Selection is independent of the current filters and rendered rows.

  const count = selectedIds.size;

  if (selectionCountEl) {
    selectionCountEl.textContent = `Selected for Weekly Report: ${count} of 4`;
  }

  if (viewButton) {
    viewButton.disabled = count === 0;
    viewButton.classList.toggle("disabled-btn", count === 0);
  }

  if (generateReportBtn) {
    const disabled =
      isDemoEnvironment() || !canWriteDatabase() || selectedIds.size !== 4;

    generateReportBtn.disabled = disabled;
    generateReportBtn.classList.toggle("disabled-btn", disabled);
  }
}

  function getSelectedContacts() {
    return contacts.filter((c) => selectedIds.has(c.id));
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

function getCurrentAnalyticsMonthLabel() {
  return new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric"
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

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadWeeklyReportDetail(reportId) {
  const header = document.getElementById(
    "weekly-report-detail-header"
  );

  if (!weeklyReportDetailEl) {
    return;
  }

  weeklyReportDetailEl.innerHTML =
    "<p>Loading report detail...</p>";

  try {
    const response = await fetch(
      `/api/reports/${reportId}?ts=${Date.now()}`,
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const report = await response.json();

    if (!response.ok) {
      throw new Error(
        report.error || "Failed to load weekly report detail."
      );
    }

    if (header) {
      header.style.display = "block";
    }

    weeklyReportDetailEl.innerHTML = `
  <h3>Weekly Report Summary</h3>
  <p><strong>ID:</strong> ${report.id}</p>
  <p><strong>Week Start:</strong> ${formatDate(report.week_start)}</p>
  <p><strong>Week End:</strong> ${formatDate(report.week_end)}</p>
  <p><strong>Submitted:</strong> ${
    report.submitted !== null && report.submitted !== undefined
      ? report.submitted
      : 0
  }</p>
  <p><strong>Submitted At:</strong> ${formatDate(report.submitted_at)}</p>

  <h3>Selected Employer Details</h3>
  ${
    report.employers && report.employers.length
      ? report.employers.map((contact) => `
          <div class="contact-card">
            <p><strong>ID:</strong> ${
              contact.id !== null && contact.id !== undefined
                ? contact.id
                : ""
            }</p>
            <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
            <p><strong>Recruiter Name:</strong> ${escapeHtml(contact.recruiter_name || "")}</p>
            <p><strong>Company:</strong> ${escapeHtml(contact.company || "")}</p>
            <p><strong>Email:</strong> ${escapeHtml(contact.email || "")}</p>
            <p><strong>Phone:</strong> ${escapeHtml(contact.phone || "")}</p>
            <p><strong>Role Type:</strong> ${escapeHtml(contact.role_category || "Unclassified")}</p>
        <p><strong>Hiring Workflow:</strong> ${escapeHtml(contact.hiring_stage || "Unclassified")}</p>
        <p><strong>Position Status:</strong> ${escapeHtml(contact.position_status || "Unclassified")}</p>
        <p><strong>Previous Status:</strong> ${escapeHtml(contact.status || "")}</p>
            <p><strong>Relationship Status:</strong> ${escapeHtml(contact.relationship_status || "")}</p>
            <p><strong>Level:</strong> ${escapeHtml(contact.role_level || "")}</p>
            <p><strong>Location:</strong> ${escapeHtml(contact.location || "")}</p>
          </div>
        `).join("")
      : "<p>No employers found for this report.</p>"
  }
`;

  } catch (error) {
    console.error(
      "Failed to load weekly report detail:",
      error
    );

    if (header) {
      header.style.display = "none";
    }
  }
}

  function wireViewReportButtons() {
    const viewButtons = document.querySelectorAll(".view-report-btn");

    viewButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const id = Number(button.dataset.id);

        // 🔥 NEW: capture dates from row
        const row = button.closest("tr");
        const cells = row.querySelectorAll("td");

        selectedReportRange = {
          start: cells[0] && cells[0].textContent
            ? cells[0].textContent.trim()
            : "",
          end: cells[1] && cells[1].textContent
            ? cells[1].textContent.trim()
            : ""
        };

        setActiveViewReportButton(button);
        await loadWeeklyReportDetail(id);
        showSection("detailViewerSection");
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
        <td>
          <input
            type="radio"
            name="selectedReport"
            value="${formatDate(report.week_start)}_${formatDate(report.week_end)}"
            aria-label="Select weekly report ${formatDate(report.week_start)} to ${formatDate(report.week_end)}"
            class="report-radio"
          />
        </td>

        <td>${formatDate(report.week_start)}</td>
        <td>${formatDate(report.week_end)}</td>
        <td>
          ${
            Number(report.submitted) > 0
              ? `<span class="status-badge success">Reported</span>`
              : `<span class="status-badge">Not Reported</span>`
          }
        </td>
        <td>${formatDate(report.submitted_at)}</td>

        <td>
          <button
            type="button"
            class="view-report-btn"
            data-id="${report.id}">
            View
          </button>
        </td>
      `;

      weeklyHistoryTableBody.appendChild(row);

      const radio = row.querySelector(".report-radio");

      const handleWeeklyReportSelect = () => {
        selectedReportRange = {
          start: formatDate(report.week_start),
          end: formatDate(report.week_end)
        };

        document
          .querySelectorAll("#weekly-report-history-table tbody tr")
          .forEach((tr) => tr.classList.remove("selected-row"));

        row.classList.add("selected-row");

        const exportBtn = document.getElementById("unemploymentExportBtn");

        if (exportBtn) {
          exportBtn.disabled = false;
          exportBtn.classList.remove("disabled-btn");
        }

        if (weeklyHistoryMessageEl) {
          weeklyHistoryMessageEl.textContent =
            `Selected report: ${selectedReportRange.start} to ${selectedReportRange.end}`;
          weeklyHistoryMessageEl.className = "message success";
        }
      };

      radio.addEventListener("change", handleWeeklyReportSelect);
      radio.addEventListener("click", handleWeeklyReportSelect);
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
      console.log("EDIT BUTTON DATA ID:", button.dataset.id);
      console.log("EDIT ID NUMBER:", id);
      const contact = contacts.find((item) => item.id === id);

      if (!contact) return;

      form.reset();
      editId = id;

    Object.keys(contact).forEach((key) => {
      const field =
        form && form.elements
          ? form.elements[key]
          : null;

      if (field) {
        field.value =
          key === "date_contacted" || key === "next_follow_up_date"
            ? formatDate(contact[key])
            : (contact[key] || "");
      }
    });

    showWorkflowContext(contact);
    updateInterviewDateVisibility();
    if (form && form.elements && form.elements.website) {
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

function isDemoEnvironment() {
  return (
    APP_ENV === "demo"
  );
}

function wireDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".delete-btn");

  deleteButtons.forEach((button) => {
    if (isDemoEnvironment()) {
      button.disabled = true;
      button.title = "Delete is disabled in DEMO/Sandbox.";
      button.classList.add("disabled-btn");
      return;
    }

    button.addEventListener("click", async () => {
      if (!canHardDelete()) {
        renderMessage(messageDiv, "Delete is disabled for this user.", "error");
        return;
      }

      const id = Number(button.dataset.id);

      try {
        const response = await fetch(`/api/contacts/${id}`, {
          method: "DELETE",
          credentials: "same-origin"
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
  console.log("TABLE BODY FOUND:", !!tableBody);

  if (!tableBody) return;

  tableBody.innerHTML = "";

  const filteredContacts = filterContacts(contacts, contactFilters);
  const sortedContacts = sortContacts(filteredContacts, currentSortField, currentSortDirection);
  setText('contactVisibleCount', 'Showing ' + sortedContacts.length + ' of ' + contacts.length + ' records');
  updateSortHeaders();

    sortedContacts.forEach((c) => {
    const row = document.createElement("tr");
    const dimensions = contactDimensions(c);
    const badge = value => '<span class="contact-badge tone-' + badgeTone(value) + '">' + escapeHtml(value) + '</span>';
    const legacy = c.status ? '<small class="legacy-status">Previous status: ' + escapeHtml(c.status) + '</small>' : '';

    row.innerHTML = `
      <td>
        <input type="checkbox" class="select-checkbox" data-id="${c.id}" aria-label="Select ${escapeHtml(c.company || "contact")} for weekly report" ${dimensions.reported === "Reported" ? 'disabled title="Already reported"' : ""} ${selectedIds.has(c.id) ? "checked" : ""} />
      </td>
      <td>${formatDate(c.date_contacted)}</td>
      <td>${escapeHtml(c.company || "")}</td>
      <td>${badge(dimensions.stage)}</td>
      <td>${badge(dimensions.position)}${legacy}</td>
      <td>${badge(dimensions.reported)}</td>
      <td>
      ${isAdminUser() ? `<button type="button" class="edit-btn" data-id="${c.id}">Edit</button>` : ""}
      ${isAdminUser() ? `<button type="button" class="delete-btn" data-id="${c.id}">Delete</button>` : ""}
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

function updateSortHeaders() {
  document.querySelectorAll('#contactsTable [data-sort]').forEach(button => {
    const active = button.dataset.sort === currentSortField;
    button.closest('th').setAttribute('aria-sort', active ? (currentSortDirection === 'asc' ? 'ascending' : 'descending') : 'none');
    button.querySelector('.sort-indicator').textContent = active ? (currentSortDirection === 'asc' ? ' ↑' : ' ↓') : ' ↕';
    const label = button.dataset.sortLabel || button.textContent.replace(/[↑↓↕]/g, '').trim();
    button.dataset.sortLabel = label;
    const nextDirection = active && currentSortDirection === 'asc' ? 'descending' : (button.dataset.sort === 'date_contacted' && !active ? 'descending' : 'ascending');
    button.setAttribute('aria-label', 'Sort ' + label + ' ' + nextDirection);
    button.closest('th').title = 'Sort ' + label + ' ' + nextDirection;
  });
}
function wireSavedContactsSorting() {
  document.querySelectorAll('#contactsTable [data-sort]').forEach(button => {
    button.closest('th').addEventListener('click', () => {
      const field = button.dataset.sort;
      currentSortDirection = currentSortField === field ? (currentSortDirection === 'asc' ? 'desc' : 'asc') : (field === 'date_contacted' ? 'desc' : 'asc');
      currentSortField = field;
      renderTable();
    });
  });
  updateSortHeaders();
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

    const activeSection = document.querySelector(
      ".careerops-section.active-section"
    );

    console.log(
      "ACTIVE SECTION NOW:",
      activeSection ? activeSection.id : null
    );

    document.querySelectorAll(".nav-list button").forEach((btn) => {
      btn.classList.remove("active");

      if (btn.dataset.target === sectionId) {
        btn.classList.add("active");
      }
    });

    const pageTitle = document.getElementById("pageTitle");

    if (pageTitle) {
      const heading = target.querySelector("h1, h2");
      pageTitle.textContent = heading ? heading.textContent : "Dashboard";
    }

    updateNavButtons();
  } else {
    console.error("SECTION NOT FOUND:", sectionId);
  }
}

window.showSection = showSection;

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

async function loadActiveUsers() {
  try {
    const response = await fetch("/api/analytics/active-users");

    if (!response.ok) {
      throw new Error("Failed to load active users");
    }

    const data = await response.json();

    const activeUsersEl =
      document.getElementById("activeUsers");

    if (activeUsersEl) {
  activeUsersEl.textContent =
    data.active_users !== null &&
    data.active_users !== undefined
      ? data.active_users
      : 0;
}
  } catch (error) {
    console.error(
      "Active users load failed:",
      error
    );
  }
}

async function loadStaleSessions() {
  try {
    const response = await fetch("/api/analytics/stale-sessions");

    if (!response.ok) {
      throw new Error("Failed to load stale sessions");
    }

    const data = await response.json();

    const staleSessionsEl =
      document.getElementById("staleSessions");

    if (staleSessionsEl) {
  staleSessionsEl.textContent =
    data.stale_sessions !== null &&
    data.stale_sessions !== undefined
      ? data.stale_sessions
      : 0;
}
  } catch (error) {
    console.error(
      "Stale sessions load failed:",
      error
    );
  }
}

async function loadSessionsToday() {
  try {
    const response = await fetch("/api/analytics/sessions-today");

    if (!response.ok) {
      throw new Error("Failed to load sessions today");
    }

    const data = await response.json();

    const sessionsTodayEl =
      document.getElementById("sessionsToday");

    if (sessionsTodayEl) {
  sessionsTodayEl.textContent =
    data.sessions_today !== null &&
    data.sessions_today !== undefined
      ? data.sessions_today
      : 0;
}
  } catch (error) {
    console.error("Sessions today load failed:", error);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 DOMContentLoaded fired");

    const user = await checkAuth();

    if (!user) {
        window.location.href = "/login.html";
        return;
    }

  window.currentUser = user;

  applyRoleBasedAccess();

showSection("telemetrySection");

      const mainMenuBtn = document.getElementById("mainMenuBtn");
      if (mainMenuBtn) {
        mainMenuBtn.addEventListener("click", () => {
          showSection("contactFormSection");
        });
      }

      const backBtn = document.getElementById("backBtn");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          goBackSection();
        });
      }

      const nextBtn = document.getElementById("nextBtn");
      if (nextBtn) {
        nextBtn.addEventListener("click", () => {
          goNextSection();
        });
      }

      const weeklyReportHistoryTable =
        document.getElementById("weekly-report-history-table");

    if (weeklyReportHistoryTable) {
      weeklyReportHistoryTable.addEventListener("change", (event) => {
        if (!event.target.classList.contains("report-radio")) return;

    const row = event.target.closest("tr");

    document
      .querySelectorAll("#weekly-report-history-table tbody tr")
      .forEach((tr) => tr.classList.remove("selected-row"));

    if (row) {
      row.classList.add("selected-row");
    }

    const [start, end] = event.target.value.split("_");
    selectedReportRange = { start, end };

    const exportBtn = document.getElementById("unemploymentExportBtn");

    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.classList.remove("disabled-btn");
    }
  });
}

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logout();
  });
}

    window.currentUser = user;
    console.log("currentUser:", window.currentUser);
    form = document.getElementById("contactForm");
    const industryOptions = document.getElementById("industryOptions");
    if (industryOptions) {
      industryOptions.replaceChildren(...INDUSTRIES.map(value => {
        const option = document.createElement("option");
        option.value = value;
        return option;
      }));
    }
    errorsDiv = document.getElementById("formErrors");
    messageDiv = document.getElementById("formMessage");
    resetButton = document.getElementById("resetButton");
    unemploymentForm = document.getElementById("unemploymentForm");
    dateInput = document.getElementById("date_contacted");
    document.getElementById("hiring_stage").addEventListener("change", () => {
      document.getElementById("interview_date").value = "";
      updateInterviewDateVisibility();
    });
    form.addEventListener("reset", () => queueMicrotask(updateInterviewDateVisibility));
    companyInput = document.getElementById("company");
    companySuggestions = document.getElementById("companySuggestions");
    selectionCountEl = document.getElementById("selectionCount");
    generateReportBtn = document.getElementById("generateReportBtn");

if (isDemoEnvironment() && generateReportBtn) {
  generateReportBtn.disabled = true;
  generateReportBtn.classList.add("disabled-btn");
  generateReportBtn.title = "Disabled in DEMO/Sandbox";
}

viewButton = document.getElementById("viewButton");

    if (viewButton) {
      viewButton.addEventListener("click", handleViewSelectedClick);
    }

    weeklyHistoryMessageEl = document.getElementById("weekly-report-history-message");
    weeklyHistoryTableBody = document.querySelector("#weekly-report-history-table tbody");
    weeklyReportDetailEl = document.getElementById("weekly-report-detail");
    closeWeeklyReportDetailBtn = document.getElementById("closeWeeklyReportDetailBtn");

    const startValidationRunBtn = document.getElementById("startValidationRunBtn");
    const completeValidationRunBtn = document.getElementById("completeValidationRunBtn");
    const documentationBtn = document.getElementById("documentationBtn");

    if (documentationBtn) {
      documentationBtn.addEventListener("click", () => {
        window.open(
          "https://github.com/MIBoy54/careerops-platform/blob/main/README.md",
          "_blank"
        );
      });
  }

function wireCompanyAutocomplete() {
  if (!companyInput || !companySuggestions) return;
  const status = document.getElementById("companySearchStatus");
  let matches = [];
  let activeIndex = -1;
  let blurTimer;
  const close = () => {
    clearTimeout(blurTimer);
    companySuggestions.replaceChildren();
    companySuggestions.style.display = "none";
    companyInput.setAttribute("aria-expanded", "false");
    companyInput.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };
  const render = () => {
    close();
    const query = companyInput.value.trim().toLowerCase();
    if (query.length < 2) {
      matches = [];
      if (status) status.textContent = "";
      return;
    }
    matches = contacts.filter(contact =>
      String(contact.company || "").trim().toLowerCase().includes(query)
    ).sort((a,b) => formatDate(b.date_contacted).localeCompare(formatDate(a.date_contacted)) ||
      Number(b.id) - Number(a.id));
    if (status) status.textContent = matches.length
      ? matches.length + " matching contacts. Use Up/Down and Enter to select."
      : "No matching contacts.";
    if (!matches.length) return;
    companySuggestions.innerHTML = '<div class="suggestion-heading" role="presentation"><span>Date</span><span>Company/Agency</span><span>Role</span></div>' +
      matches.map((contact,index) => `
        <button type="button" role="option" aria-selected="false" tabindex="-1"
          id="company-option-${index}" class="suggestion-item" data-contact-id="${escapeHtml(String(contact.id))}">
          <span>${escapeHtml(formatDate(contact.date_contacted) || "—")}</span>
          <span>${escapeHtml(contact.company || "")}</span>
          <span>${escapeHtml(contact.role_level || "—")}</span>
        </button>`).join("");
    companySuggestions.style.display = "block";
    companyInput.setAttribute("aria-expanded", "true");
  };
  const select = contact => {
    if (!contact || !form) return;
    close();
    hiringResultsReturnStage = null;
    loadContactForEditing(contact);
  };
  companyInput.addEventListener("input", render);
  companyInput.addEventListener("focus", render);
  companyInput.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault();close();if(status)status.textContent="";return; }
    if (!matches.length || companySuggestions.style.display === "none") return;
    if (event.key === "Enter") { event.preventDefault();select(matches[activeIndex < 0 ? 0 : activeIndex]);return; }
    if (!["ArrowDown","ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    activeIndex = event.key === "ArrowDown" ? (activeIndex+1)%matches.length
      : (activeIndex<=0?matches.length:activeIndex)-1;
    const options = [...companySuggestions.querySelectorAll('[role="option"]')];
    options.forEach((option,index) => option.setAttribute("aria-selected",String(index===activeIndex)));
    const active = options[activeIndex];
    companyInput.setAttribute("aria-activedescendant",active.id);
    active.scrollIntoView({block:"nearest"});
  });
  companySuggestions.addEventListener("mousedown", event => event.preventDefault());
  companySuggestions.addEventListener("click", event => {
    const item = event.target.closest(".suggestion-item");
    if (item) select(matches.find(contact => String(contact.id) === item.dataset.contactId));
  });
  companyInput.addEventListener("blur", () => { blurTimer = setTimeout(close,150); });
  form.addEventListener("reset", () => {
    close();matches=[];if(status)status.textContent="";
    const context=document.getElementById("legacyWorkflowContext");if(context)context.textContent="";
  });
}

wireCompanyAutocomplete();

    for (const [key, id, choices] of [
      ['stage', 'stageFilter', STAGES], ['position', 'positionFilter', POSITIONS],
      ['reported', 'reportingFilter', ['Reported', 'Not Reported']]
    ]) {
      const filter = document.getElementById(id);
      if (!filter) continue;
      filter.innerHTML = '<option value="all">All</option>' + choices.map(value => '<option>' + escapeHtml(value) + '</option>').join('');
      filter.value = contactFilters[key];
      filter.addEventListener('change', () => { contactFilters[key] = filter.value; renderTable(); });
    }

      wireSavedContactsSorting();

      applyRoleBasedAccess();
      console.log("📡 About to call loadContacts");

      const today = new Date().toISOString().split("T")[0];
      contacts = [];
      selectedIds.clear();
      editId = null;

      const savedContactsTab = document.getElementById("savedContactsTab");

      if (savedContactsTab) {
        savedContactsTab.addEventListener("click", (event) => {
          event.preventDefault();
          console.log("NAV CLICK: savedContactsSection");
          showSection("savedContactsSection");
        });
      }

  document.querySelectorAll("[data-target]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();

      const target = button.dataset.target;
      if (!target) return;

      console.log("NAV CLICK:", target);
      showSection(target);
    });
  });

  try {
    await startAnalyticsSession();
    startAnalyticsHeartbeat();
  } catch (error) {
    console.error("Analytics startup failed:", error);
  }

messageDiv = document.getElementById("formMessage");

let initialContactsLoaded = false;

try {
  if (dateInput) {
    dateInput.value = today;
  }

  await loadContacts();
  renderTable();
  initialContactsLoaded = true;

  await loadQualityGateSummary();
  setInterval(() => { if (!document.hidden) loadQualityGateSummary(); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadQualityGateSummary();
  });

  await loadWeeklyReportHistory();

  updateSelectionCount();
  clearWeeklyReportDetail();

  await loadAnalyticsSummary();
  await loadAnalyticsTrend();

  renderAnalyticsMonth();

} catch (error) {
  console.error("Initial page load failed:", error);
}

setTimeout(loadActiveUsers, 2000);

if (activeUsersInterval) {
  clearInterval(activeUsersInterval);
  }

activeUsersInterval = setInterval(
  loadActiveUsers,
  activeUsersRefreshMs
);

  setTimeout(loadStaleSessions, 2000);
  setInterval(loadStaleSessions, 15000);

  setTimeout(loadSessionsToday, 2000);
  setInterval(loadSessionsToday, 15000);

  setTimeout(loadAnalyticsSummary, 2000);
  setInterval(loadAnalyticsSummary, 30000);

  setInterval(loadAnalyticsTrend, 60000);

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canWriteDatabase()) {
        renderMessage(messageDiv, "Contact changes are disabled for this user.", "error");
        return;
      }

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

        console.log("SAVE editId:", editId);
        console.log("SAVE URL:", editId !== null ? `/api/contacts/${editId}` : "/api/contacts");

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
        if (hiringResultsReturnStage) {
          const stage = hiringResultsReturnStage;
          hiringResultsReturnStage = null;
          showSection("dashboardSection");
          showHiringResults(stage);
        }
      } catch (error) {
        console.error("Save failed:", error);
        renderMessage(messageDiv, error.message || "Failed to save contact.", "error");
      }
    });

    if (resetButton) {
     resetButton.addEventListener("click", () => {
        form.reset();
        editId = null;
        hiringResultsReturnStage = null;

        if (companySuggestions) {
          companySuggestions.innerHTML = "";
          companySuggestions.style.display = "none";
        }

        renderErrors(errorsDiv, []);
        renderMessage(messageDiv, "");
      });
    }

    resetButton = document.getElementById("resetButton");

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
        document.getElementById("comp_range").value = companyDetails.comp_range || "";
        document.getElementById("role_level").value = companyDetails.role_level || "";
        document.getElementById("role_category").value = companyDetails.role_category || "";
        showWorkflowContext(companyDetails);
        document.getElementById("relationship_status").value = companyDetails.relationship_status || "";
        document.getElementById("phone").value = companyDetails.phone || "";
        document.getElementById("email").value = companyDetails.email || "";
        document.getElementById("address").value = companyDetails.address || "";
        document.getElementById("website").value = companyDetails.website || "";
        document.getElementById("industry").value = companyDetails.industry || "";
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

    const unemploymentExportBtn = document.getElementById("unemploymentExportBtn");

    if (unemploymentExportBtn) {
      unemploymentExportBtn.addEventListener("click", () => {
        if (!selectedReportRange) {
          if (weeklyHistoryMessageEl) {
            weeklyHistoryMessageEl.textContent = "Please select a report first.";
            weeklyHistoryMessageEl.className = "message error";
          }
          return;
        }

        const { start, end } = selectedReportRange;

        window.location.href =
          `/api/reports/unemployment/export?start=${start}&end=${end}`;
      });
    }

    if (closeWeeklyReportDetailBtn) {
      closeWeeklyReportDetailBtn.addEventListener("click", () => {
        clearWeeklyReportDetail();
        showSection("savedContactsSection");
      });
    }

    if (generateReportBtn) {
      generateReportBtn.addEventListener("click", async () => {
        if (selectedIds.size !== 4) {
          renderMessage(messageDiv, "You must select exactly 4 employers.", "error");
          return;
        }

        if (!confirm("This will mark selected companies as reported. They will remain visible under All or Reported. Continue?")) {
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
    }

    if (unemploymentForm) {
      unemploymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const unemploymentCompany =
          document.getElementById("unemployment_company");

        const dateReported =
          document.getElementById("date_reported");

        const unemploymentNotes =
          document.getElementById("unemployment_notes");

        const payload = {
          company:
            unemploymentCompany
              ? unemploymentCompany.value.trim()
              : "",

          date_reported:
            dateReported
              ? dateReported.value
              : "",

          notes:
            unemploymentNotes
              ? unemploymentNotes.value.trim()
              : ""
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

    if (companyInput) {
      companyInput.addEventListener("input", async () => {
        // existing logic
      });
    }

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

  } // closes if (form)

  if (initialContactsLoaded) {
    document.documentElement.dataset.careeropsReady = "true";
  }

}); // closes DOMContentLoaded
  



