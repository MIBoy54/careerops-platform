export function validateContact(contact) {
  const errors = [];

  if (!contact.recruiter_name?.trim()) {
    errors.push("Recruiter name is required.");
  }

  if (!contact.company?.trim()) {
    errors.push("Company is required.");
  }

  if (!contact.status?.trim()) {
    errors.push("Status is required.");
  }

  // Optional field format validations
  if (contact.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email.trim())) {
      errors.push("Email format is invalid.");
    }
  }

  if (contact.website?.trim()) {
    const website = contact.website.trim();
    if (!/^https?:\/\/.+\..+/.test(website)) {
      errors.push("Website format is invalid.");
    }
  }

  if (contact.next_follow_up_date?.trim()) {
    const date = new Date(contact.next_follow_up_date.trim());
    if (isNaN(date.getTime())) {
      errors.push("Next follow-up date is invalid.");
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}