export function validateContact(contact) {
  const errors = [];

  if (!contact.date_contacted?.trim()) {
    errors.push("Date Contacted is required.");
  }

  if (!contact.recruiter_name?.trim()) {
    errors.push("Recruiter Name is required.");
  }

  if (!contact.company?.trim()) {
    errors.push("Company / Agency is required.");
  }

  if (!contact.role_level?.trim()) {
    errors.push("Level is required.");
  }

  if (!contact.role_type?.trim()) {
    errors.push("Role Type is required.");
  }

  if (!contact.location?.trim()) {
    errors.push("Location is required.");
  }

  if (!contact.comp_range?.trim()) {
    errors.push("Comp Range is required.");
  }

  if (!contact.status?.trim()) {
    errors.push("Status is required.");
  }

  if (!contact.relationship_status?.trim()) {
    errors.push("Relationship Status is required.");
  }

  if (!contact.phone?.trim()) {
    errors.push("Phone is required.");
  }

  if (!contact.email?.trim()) {
    errors.push("Email is required.");
  }

  if (!contact.address?.trim()) {
    errors.push("Address is required.");
  }

  if (!contact.website?.trim()) {
    errors.push("Website is required.");
  }

  if (!contact.notes?.trim()) {
    errors.push("Notes is required.");
  }

  // Format validations
  if (contact.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      errors.push("Email format is invalid.");
    }
  }

  if (contact.website && !/^https?:\/\/.+\..+/.test(contact.website)) {
    errors.push("Website format is invalid.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}