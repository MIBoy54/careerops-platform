import { describe, expect, it } from "vitest";

describe("Data Validation", () => {
  it("passes when required recruiter fields are present", () => {
    const recruiter = {
      name: "Bruce Lewis",
      company: "CloudBees",
      email: "hr@cloudbees.com"
    };

    const isValid =
      !!recruiter.name &&
      !!recruiter.company &&
      !!recruiter.email;

    expect(isValid).toBe(true);
  });

  it("fails when recruiter email is missing", () => {
    const recruiter = {
      name: "Bruce Lewis",
      company: "CloudBees",
      email: ""
    };

    const isValid =
      !!recruiter.name &&
      !!recruiter.company &&
      !!recruiter.email;

    expect(isValid).toBe(false);
  });
});