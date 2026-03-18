export function validateWeeklyReport(report) {
  const errors = [];

  if (!report.week_start || !report.week_end) {
    errors.push("Missing reporting window.");
  }

  if (!report.job_contacts || report.job_contacts.length === 0) {
    errors.push("At least one job contact is required.");
  }

  if (report.week_start && report.week_end) {
    const start = new Date(report.week_start);
    const end = new Date(report.week_end);

    if (end < start) {
      errors.push("Week end date cannot be before week start date.");
    } else {
      const diffInMs = end - start;
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

      if (diffInDays > 6) {
        errors.push("Reporting window must be 7 days or less.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
