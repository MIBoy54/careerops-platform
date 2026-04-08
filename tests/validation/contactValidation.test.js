import { describe, expect, it } from "vitest";
import { validateContact } from "../../src/validateContact.js";

describe("Employer Contact Validation", () => {
it("passes when required fields are present", () => {
  const contact = {
    date_contacted: "2026-03-19",
    recruiter_name: "Jane Smith",
    company: "Acme Recruiting",
    level: "Director",
    role_type: "QE Transformation",
    location: "Remote",
    comp_range: "$150k-$170k",
    status: "Applied",
    relationship_status: "Warm",
    next_follow_up_date: "2026-03-26",
    notes: "Strong initial conversation",
    phone: "555-123-4567",
    email: "jane.smith@acme.com",
    address: "Nashville, TN",
    website: "https://acme.com"
  };

  const result = validateContact(contact);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
it("fails when email format is invalid", () => {
  const contact = {
    recruiter_name: "Jane Smith",
    company: "Acme Recruiting",
    status: "Applied",
    email: "not-an-email"
  };

  const result = validateContact(contact);

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Email format is invalid.");
});
it("fails when website format is invalid", () => {
  const contact = {
    recruiter_name: "Jane Smith",
    company: "Acme Recruiting",
    status: "Applied",
    website: "acme"
  };

  const result = validateContact(contact);

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Website format is invalid.");
});
it("fails when next follow-up date is invalid", () => {
  const contact = {
    recruiter_name: "Jane Smith",
    company: "Acme Recruiting",
    status: "Applied",
    next_follow_up_date: "not-a-date"
  };

  const result = validateContact(contact);

  expect(result.valid).toBe(false);
  expect(result.errors).toContain("Next follow-up date is invalid.");
});
    it("fails when required fields are missing", () => {
    const contact = {
      recruiter_name: "",
      company: "",
      status: ""
    };

    const result = validateContact(contact);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Recruiter name is required.");
    expect(result.errors).toContain("Company is required.");
    expect(result.errors).toContain("Status is required.");
  });
});
