export function validateWeeklyReport(report) {
  if (!report.week_start || !report.week_end) {
    return false;
  }

  if (!report.job_contacts || report.job_contacts.length === 0) {
    return false;
  }

  return true;
}