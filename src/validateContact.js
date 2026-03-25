export function validateContact(contact) {
  const errors = [];

  if (!contact.recruiter_name) {
    errors.push("Recruiter name is required.");
  }

  if (!contact.company) {
    errors.push("Company is required.");
  }

  if (!contact.status) {
    errors.push("Status is required.");
  }

// Allow either valid email OR freeform text
if (contact.email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(contact.email)) {
    errors.push("Email format is invalid.");
  }
}

  if (contact.website && !/^https?:\/\/.+\..+/.test(contact.website)) {
    errors.push("Website format is invalid.");
  }

  if (
    contact.next_follow_up_date &&
    Number.isNaN(new Date(contact.next_follow_up_date).getTime())
  ) {
    errors.push("Next follow-up date is invalid.");
  }
if (contact.reported_unemployment === "Yes" && !contact.next_follow_up_date) {
  errors.push("Next Follow-Up Date is required when reported to unemployment.");
}
  return {
    valid: errors.length === 0,
    errors
  };
}