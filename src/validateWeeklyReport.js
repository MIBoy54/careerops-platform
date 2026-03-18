export function validateWeeklyReport(report) {
  const errors = [];

  if (!report.week_start || !report.week_end) {
    errors.push("Missing reporting window.");
  }

  if (!report.job_contacts || report.job_contacts.length === 0) {
    errors.push("At least one job contact is required.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}