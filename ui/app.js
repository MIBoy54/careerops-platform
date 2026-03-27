import { validateContact } from "../src/validateContact.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  const errorsDiv = document.getElementById("errors");
  const messageDiv = document.getElementById("message");
  const resetButton = document.getElementById("resetButton");
  const unemploymentForm = document.getElementById("unemploymentForm");
  const tableBody = document.querySelector("#contactsTable tbody");
  const dateInput = document.getElementById("date_contacted");
  const companyInput = document.getElementById("company");
  const companySuggestions = document.getElementById("companySuggestions");
  const selectionCountEl = document.getElementById("selectionCount");
  const generateReportBtn = document.getElementById("generateReportBtn");
  const weeklyHistoryMessageEl = document.getElementById("weekly-report-history-message");
  const weeklyHistoryTableBody = document.querySelector("#weekly-report-history-table tbody");
  const weeklyReportDetailEl = document.getElementById("weekly-report-detail");
  const today = new Date().toISOString().split("T")[0];
  const contacts = [];
  const selectedIds = new Set();
  const closeWeeklyReportDetailBtn = document.getElementById("closeWeeklyReportDetailBtn");
  const viewButton = document.getElementById("viewButton");
  let editId = null;

  initialize();

async function initialize() {
  dateInput.value = today;

  await loadContacts();
  console.log("contacts loaded:", contacts);
  renderTable();

  await loadWeeklyReportHistory();
  console.log("weekly history loaded");
  updateSelectionCount();
  clearWeeklyReportDetail();
}

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const contact = Object.fromEntries(formData.entries());

    const result = validateContact(contact);

    if (!result.valid) {
      renderErrors(result.errors);
      renderMessage("");
      return;
    }

    renderErrors([]);

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

    renderMessage("Contact updated successfully.");
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

    renderMessage("Contact saved successfully.");
  }

  await loadContacts();
  selectedIds.clear();
  renderTable();

  form.reset();
  dateInput.value = today;
} catch (error) {
  console.error("Save failed:", error);
  renderMessage(error.message || "Failed to save contact.", "error");
}
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    dateInput.value = today;
    editId = null;
    renderErrors([]);
    renderMessage("");
  });

document.getElementById("unemploymentExportBtn").addEventListener("click", () => {
  if (!weeklyHistoryTableBody || !weeklyHistoryTableBody.children.length) {
    weeklyHistoryMessageEl.textContent = "No weekly report history found.";
    weeklyHistoryMessageEl.className = "message error";
    return;
  }

  const firstRow = weeklyHistoryTableBody.children[0];
  const cells = firstRow.querySelectorAll("td");

  const start = cells[0]?.textContent.trim();
  const end = cells[1]?.textContent.trim();

  if (!start || !end) {
    weeklyHistoryMessageEl.textContent = "Unable to determine report date range.";
    weeklyHistoryMessageEl.className = "message error";
    return;
  }

  console.log("Exporting:", start, end);

  window.location.href = `/api/reports/unemployment/export?start=${start}&end=${end}`;
});

    if (closeWeeklyReportDetailBtn) {
    closeWeeklyReportDetailBtn.addEventListener("click", () => {
      clearWeeklyReportDetail();
    });
  }
generateReportBtn.addEventListener("click", async () => {
  if (selectedIds.size !== 4) {
    renderMessage("You must select exactly 4 employers.", "error");
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

    renderMessage("Weekly report generated successfully.");
    selectedIds.clear();
    updateSelectionCount();

    await loadContacts();
    renderTable();
    wireEditButtons();
    wireDeleteButtons();
    wireSelectionCheckboxes();
    await loadWeeklyReportHistory();
  } catch (error) {
    console.error("Generate report failed:", error);
    renderMessage("Failed to generate weekly report.", "error");
  }
});

  if (unemploymentForm) {
  unemploymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      company: document.getElementById("unemployment_company").value.trim(),
      date_reported: document.getElementById("date_reported").value,
      notes: document.getElementById("unemployment_notes").value.trim()
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
      renderMessage("Unemployment report saved successfully.");

      await loadContacts();
      renderTable();
      wireEditButtons();

    } catch (error) {
      console.error("Unemployment form save failed:", error);
      renderMessage("Failed to save unemployment report.", "error");
    }
  });
}
companyInput.addEventListener("input", async () => {
  const query = companyInput.value.trim();

  if (query.length < 2) {
    companySuggestions.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`);
    const companies = await response.json();

    if (!response.ok) {
      throw new Error("Failed to load company suggestions");
    }

    companySuggestions.innerHTML = companies
      .map((company) => `
        <div class="suggestion-item">
          ${escapeHtml(company)}
        </div>
      `)
      .join("");

    document.querySelectorAll(".suggestion-item").forEach((item) => {
      item.addEventListener("mousedown", () => {
        companyInput.value = item.textContent.trim();
        companySuggestions.innerHTML = "";
      });
    });
  } catch (error) {
    console.error("Company search failed:", error);
    companySuggestions.innerHTML = "";
  }
});

companyInput.addEventListener("blur", () => {
  setTimeout(() => {
    companySuggestions.innerHTML = "";
  }, 150);
});
    
async function loadContacts() {
  try {
    const response = await fetch("/api/contacts");
    const data = await response.json();

    console.log("API data:", data);
    console.log("First website values:", data.map(row => ({ id: row.id, company: row.company, website: row.website })));

    contacts.length = 0;
    contacts.push(...data);
  } catch (error) {
    console.error("Load failed:", error);
    renderMessage("Failed to load contacts.", "error");
  }
}

  function renderTable() {
    tableBody.innerHTML = "";

    const filteredContacts = contacts
      .filter((c) => (c.reported_unemployment || "No") === "No")
      .sort((a, b) => {
        const dateCompare = String(b.date_contacted || "").localeCompare(String(a.date_contacted || ""));
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
        <td>${c.company || ""}</td>
        <td class="${getStatusClass(c.status)}">${c.status || ""}</td>
        <td>${c.reported_unemployment || "No"}</td>
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

function wireEditButtons() {
  const editButtons = document.querySelectorAll(".edit-btn");

  editButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const id = Number(button.dataset.id);
      const contact = contacts.find((item) => item.id === id);
      console.log("Editing contact:", contact);
	  console.log("Website only:", contact.website);

      if (!contact) return;

      editId = id;
      selectedIds.clear();
      updateSelectionCount();

      Object.keys(contact).forEach((key) => {
        const field = form.elements[key];
        if (field) {
          field.value =
            key === "date_contacted" || key === "next_follow_up_date"
              ? formatDate(contact[key])
              : (contact[key] || "");
        }
      });

      form.elements["website"].value = contact.website || "";

      renderMessage("Editing contact. Update fields and click Save Contact.");
      renderErrors([]);
    });
  });
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

  function getSelectedContacts() {
    return contacts.filter((c) => selectedIds.has(c.id));
  }

	function renderSelectedContacts(selected) {
	  weeklyReportDetailEl.innerHTML = `
		<h3>Selected Employer Details</h3>
		${selected.map((contact) => `
		  <div class="contact-card">
			<p><strong>ID:</strong> ${contact.id ?? ""}</p>
			<p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
			<p><strong>Company:</strong> ${contact.company || ""}</p>
			<p><strong>Status:</strong> ${contact.status || ""}</p>
			<p><strong>Reported to Unemployment:</strong> ${contact.reported_unemployment || "No"}</p>
		  </div>
		`).join("")}
	  `;
	}

		// all your constants here

	  function updateSelectionCount() {
		selectionCountEl.textContent = `Selected for Weekly Report: ${selectedIds.size} of 4`;
		generateReportBtn.disabled = selectedIds.size !== 4;

		if (viewButton) {
		  viewButton.disabled = selectedIds.size === 0;
		}
	  }

	  // ✅ View button handler (ADD THIS HERE)
	  if (viewButton) {
		viewButton.addEventListener("click", () => {
		  const selected = getSelectedContacts();

		  if (!selected.length) {
			weeklyReportDetailEl.innerHTML = `<p class="error">Please select at least one contact.</p>`;
			return;
		  }

		  renderSelectedContacts(selected);
		});
	  }

	}); // ✅ THIS closes DOMContentLoaded

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
        renderMessage("Contact deleted successfully.");
        renderErrors([]);
        clearWeeklyReportDetail();
      } catch (error) {
        console.error("Delete failed:", error);
        renderMessage("Failed to delete contact.", "error");
      }
    });
  });
}

	function escapeHtml(value) {
	  return String(value)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
	}

	function renderErrors(errors) {
    if (!errors.length) {
      errorsDiv.innerHTML = "";
      return;
    }

    errorsDiv.innerHTML = `
      <div class="error-box">
        <strong>Please fix the following:</strong>
        <ul>
          ${errors.map((error) => `<li>${error}</li>`).join("")}
        </ul>
      </div>
    `;
  }

  function renderMessage(message, type = "success") {
    if (!message) {
      messageDiv.innerHTML = "";
      return;
    }

    const className = type === "error" ? "error-box" : "success-box";
    messageDiv.innerHTML = `<div class="${className}">${message}</div>`;
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

async function loadWeeklyReportHistory() {
  const weeklyHistoryMessageEl = document.getElementById("weekly-report-history-message");
  const weeklyHistoryTableBody = document.querySelector("#weekly-report-history-table tbody");

  if (!weeklyHistoryMessageEl || !weeklyHistoryTableBody) {
    return;
  }

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

function getSelectedContacts() {
  return contacts.filter((contact) => selectedIds.has(contact.id));
}

function renderSelectedContacts(selected) {
  if (!weeklyReportDetailEl) {
    return;
  }

  weeklyReportDetailEl.innerHTML = `
    <h3>Selected Employer Details</h3>
    ${selected.map((contact) => `
      <div class="contact-card">
        <p><strong>ID:</strong> ${contact.id ?? ""}</p>
        <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
        <p><strong>Recruiter Name:</strong> ${contact.recruiter_name || ""}</p>
        <p><strong>Company:</strong> ${contact.company || ""}</p>
        <p><strong>Email:</strong> ${contact.email || ""}</p>
        <p><strong>Phone:</strong> ${contact.phone || ""}</p>
        <p><strong>Status:</strong> ${contact.status || ""}</p>
        <p><strong>Relationship Status:</strong> ${contact.relationship_status || ""}</p>
        <p><strong>Role Type:</strong> ${contact.role_type || ""}</p>
        <p><strong>Location:</strong> ${contact.location || ""}</p>
      </div>
    `).join("")}
  `;
}

async function loadWeeklyReportDetail(reportId) {
  const weeklyReportDetailEl = document.getElementById("weekly-report-detail");
  const header = document.getElementById("weekly-report-detail-header");

  if (!weeklyReportDetailEl) {
    return;
  }

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
          ? report.employers.map((contact) => `
            <div class="contact-card">
              <p><strong>ID:</strong> ${contact.id ?? ""}</p>
              <p><strong>Date Contacted:</strong> ${formatDate(contact.date_contacted)}</p>
              <p><strong>Recruiter Name:</strong> ${contact.recruiter_name || ""}</p>
              <p><strong>Company:</strong> ${contact.company || ""}</p>
              <p><strong>Email:</strong> ${contact.email || ""}</p>
              <p><strong>Phone:</strong> ${contact.phone || ""}</p>
              <p><strong>Status:</strong> ${contact.status || ""}</p>
              <p><strong>Relationship Status:</strong> ${contact.relationship_status || ""}</p>
              <p><strong>Role Type:</strong> ${contact.role_type || ""}</p>
              <p><strong>Location:</strong> ${contact.location || ""}</p>
            </div>
          `).join("")
          : "<p>No employers found for this report.</p>"
      }
    `;
  } catch (error) {
    console.error("Failed to load weekly report detail:", error);

    if (header) {
      header.style.display = "none";
    }

    weeklyReportDetailEl.innerHTML = `<p class="error">Failed to load weekly report detail.</p>`;
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

function setActiveViewReportButton(activeButton) {
  document.querySelectorAll(".view-report-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (activeButton) {
    activeButton.classList.add("active");
  }
}

function clearWeeklyReportDetail() {
  const header = document.getElementById("weekly-report-detail-header");
  const weeklyReportDetailEl = document.getElementById("weekly-report-detail");

  if (header) {
    header.style.display = "none";
  }

  if (weeklyReportDetailEl) {
    weeklyReportDetailEl.innerHTML = "<p>Select employers or a saved report to view details.</p>";
  }

  document.querySelectorAll(".view-report-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
}

if (closeWeeklyReportDetailBtn) {
  closeWeeklyReportDetailBtn.addEventListener("click", () => {
    clearWeeklyReportDetail();
  });
}

if (viewButton) {
  viewButton.addEventListener("click", () => {
    const selected = getSelectedContacts();

    if (!selected.length) {
      weeklyReportDetailEl.innerHTML = `<p class="error">Please select at least one contact.</p>`;
      return;
    }

    clearWeeklyReportDetail();
    renderSelectedContacts(selected);
  });
}

generateReportBtn.addEventListener("click", async () => {
  if (selectedIds.size !== 4) {
    renderMessage("You must select exactly 4 employers.", "error");
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

    renderMessage("Weekly report generated successfully.");
    selectedIds.clear();

    await loadContacts();
    renderTable();
    await loadWeeklyReportHistory();
    updateSelectionCount();
    clearWeeklyReportDetail();
  } catch (error) {
    console.error("Generate report failed:", error);
    renderMessage("Failed to generate weekly report.", "error");
  }
});

if (unemploymentForm) {
  unemploymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      company: document.getElementById("unemployment_company").value.trim(),
      date_reported: document.getElementById("date_reported").value,
      notes: document.getElementById("unemployment_notes").value.trim()
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
      renderMessage("Unemployment report saved successfully.");

      await loadContacts();
      renderTable();
    } catch (error) {
      console.error("Unemployment form save failed:", error);
      renderMessage("Failed to save unemployment report.", "error");
    }
  });
}

companyInput.addEventListener("input", async () => {
  const query = companyInput.value.trim();

  if (query.length < 2) {
    companySuggestions.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`);
    const companies = await response.json();

    if (!response.ok) {
      throw new Error("Failed to load company suggestions");
    }

    companySuggestions.innerHTML = companies
      .map((company) => `
        <div class="suggestion-item">${escapeHtml(company)}</div>
      `)
      .join("");

    document.querySelectorAll(".suggestion-item").forEach((item) => {
      item.addEventListener("mousedown", () => {
        companyInput.value = item.textContent.trim();
        companySuggestions.innerHTML = "";
      });
    });
  } catch (error) {
    console.error("Company search failed:", error);
    companySuggestions.innerHTML = "";
  }
});

companyInput.addEventListener("blur", () => {
  setTimeout(() => {
    companySuggestions.innerHTML = "";
  }, 150);
}); // closes DOMContentLoaded
