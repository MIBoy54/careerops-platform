const DEMO_MODE = false
import { validateContact } from "../src/validateContact.js";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  const response = await fetch("/api/contacts");

  if (!response.ok) {
    throw new Error("Failed to load contacts");
  }

  contacts = await response.json();
}

function updateSelectionCount() {
  if (selectionCountEl) {
    selectionCountEl.textContent = `Selected for Weekly Report: ${selectedIds.size} of 4`;
  }

  if (generateReportBtn) {
    generateReportBtn.disabled = selectedIds.size !== 4;
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
        <p><strong>Role Type:</strong> ${escapeHtml(contact.role_type || "")}</p>
        <p><strong>Location:</strong> ${escapeHtml(contact.location || "")}</p>
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
      ${
        report.employers && report.employers.length
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
              <p><strong>Role Type:</strong> ${escapeHtml(contact.role_type || "")}</p>
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

      console.log("Editing contact:", contact);
      console.log("Website only:", contact.website);

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

      renderMessage(
        messageDiv,
        "Editing contact. Update fields and click Save Contact."
      );
      renderErrors(errorsDiv, []);
    });
  });
}

function wireDeleteButtons() {
  const deleteButtons = document.querySelectorAll(".delete-btn");

  deleteButtons.forEach((button) => {
button.addEventListener("click", async () => {
  const id = Number(button.dataset.id);

  if (DEMO_MODE) {
    renderMessage(messageDiv, "Demo Mode: Delete disabled.", "error");
    return;
  }

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
  const tableBody = document.querySelector("#contactsTable tbody");
  if (!tableBody) return;

  tableBody.innerHTML = "";

  const filteredContacts = contacts
    .filter((c) => (c.reported_unemployment || "No") === "No")
    .sort((a, b) => {
      const dateCompare = String(b.date_contacted || "").localeCompare(
        String(a.date_contacted || "")
      );
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return String(a.status || "").localeCompare(String(b.status || ""));
    });

  filteredContacts.forEach((c) => {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <input type="checkbox" class="select-checkbox" data-id="${c.id}" ${
          selectedIds.has(c.id) ? "checked" : ""
        } />
      </td>
      <td>${formatDate(c.date_contacted)}</td>
      <td>${escapeHtml(c.company || "")}</td>
      <td class="${getStatusClass(c.status)}">${escapeHtml(c.status || "")}</td>
      <td>${escapeHtml(c.reported_unemployment || "No")}</td>
      <td>
        <button type="button" class="edit-btn" data-id="${c.id}">Edit</button>
        <button type="button" class="delete-btn" data-id="${c.id}">Delete</button>
      </td>
    `;

    tableBody.appendChild(row);
  });

  wireSelectionCheckboxes();
  wireEditButtons();
  wireDeleteButtons();
  updateSelectionCount();
}

document.addEventListener("DOMContentLoaded", () => {
  form = document.getElementById("contactForm");
  errorsDiv = document.getElementById("errors");
  messageDiv = document.getElementById("message");
  resetButton = document.getElementById("resetButton");
  unemploymentForm = document.getElementById("unemploymentForm");
  dateInput = document.getElementById("date_contacted");
  companyInput = document.getElementById("company");
  companySuggestions = document.getElementById("companySuggestions");
  selectionCountEl = document.getElementById("selectionCount");
  generateReportBtn = document.getElementById("generateReportBtn");
  weeklyHistoryMessageEl = document.getElementById("weekly-report-history-message");
  weeklyHistoryTableBody = document.querySelector("#weekly-report-history-table tbody");
  weeklyReportDetailEl = document.getElementById("weekly-report-detail");
  closeWeeklyReportDetailBtn = document.getElementById("closeWeeklyReportDetailBtn");
  viewButton = document.getElementById("viewButton");

  const today = new Date().toISOString().split("T")[0];

  contacts = [];
  selectedIds.clear();
  editId = null;

  initialize();

  async function initialize() {
    if (dateInput) {
      dateInput.value = today;
    }

    await loadContacts();
    renderTable();

    await loadWeeklyReportHistory();
    updateSelectionCount();
    clearWeeklyReportDetail();
  }

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
if (DEMO_MODE) {
  if (editId !== null) {
    renderMessage(messageDiv, "Demo Mode: Changes not saved.", "error");
    editId = null;
  } else {
    renderMessage(messageDiv, "Demo Mode: Record not saved.", "error");
  }

  form.reset();
  return;
}
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
  });

  viewButton?.addEventListener("click", () => {
    const selected = getSelectedContacts();

    if (!selected.length) {
      if (weeklyReportDetailEl) {
        weeklyReportDetailEl.innerHTML =
          `<p class="error">Please select at least one contact.</p>`;
      }
      return;
    }

    renderSelectedContacts(selected);
  });

  generateReportBtn?.addEventListener("click", async () => {
    if (selectedIds.size !== 4) {
      renderMessage(messageDiv, "You must select exactly 4 employers.", "error");
      return;
    }
if (DEMO_MODE) {
  renderMessage(messageDiv, "Demo Mode: Weekly report generation is disabled.", "error");
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
if (DEMO_MODE) {
  renderMessage(messageDiv, "Demo Mode: Unemployment report not saved.", "error");
  unemploymentForm.reset();
  return;
}
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
        item.addEventListener("mousedown", () => {
          companyInput.value = item.textContent.trim();
          if (companySuggestions) {
            companySuggestions.innerHTML = "";
          }
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
});