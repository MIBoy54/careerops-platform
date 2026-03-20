import { useState } from "react";
import { validateContact } from "../validateContact";

const initialContact = {
  date_contacted: "",
  recruiter_name: "",
  company: "",
  level: "",
  role_type: "",
  location: "",
  comp_range: "",
  status: "",
  relationship_status: "",
  next_follow_up_date: "",
  notes: "",
  phone: "",
  email: "",
  address: "",
  website: ""
};

export default function EmployerContactForm() {
  const [contact, setContact] = useState(initialContact);
  const [errors, setErrors] = useState([]);
  const [savedMessage, setSavedMessage] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setContact((prev) => ({
      ...prev,
      [name]: value
    }));

    setSavedMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();

    const result = validateContact(contact);

    if (!result.valid) {
      setErrors(result.errors);
      setSavedMessage("");
      return;
    }

    setErrors([]);
    setSavedMessage("Contact saved successfully.");

    console.log("Saved contact:", contact);

    // Later:
    // - save to local storage
    // - write to API
    // - append to table/grid
  }

  function handleReset() {
    setContact(initialContact);
    setErrors([]);
    setSavedMessage("");
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Employer Contact Form</h1>
        <p style={styles.subtitle}>
          Create or update recruiter and employer contact information.
        </p>

        {errors.length > 0 && (
          <div style={styles.errorBox}>
            <strong>Please fix the following:</strong>
            <ul style={styles.errorList}>
              {errors.map((error, index) => (
                <li key={`${error}-${index}`}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {savedMessage && <div style={styles.successBox}>{savedMessage}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.grid}>
            <Field
              label="Date Contacted"
              name="date_contacted"
              type="date"
              value={contact.date_contacted}
              onChange={handleChange}
            />

            <Field
              label="Recruiter Name *"
              name="recruiter_name"
              value={contact.recruiter_name}
              onChange={handleChange}
            />

            <Field
              label="Company / Agency *"
              name="company"
              value={contact.company}
              onChange={handleChange}
            />

            <Field
              label="Level (Mgr/Dir/Exec)"
              name="level"
              value={contact.level}
              onChange={handleChange}
            />

            <Field
              label="Role Type"
              name="role_type"
              value={contact.role_type}
              onChange={handleChange}
            />

            <Field
              label="Location"
              name="location"
              value={contact.location}
              onChange={handleChange}
            />

            <Field
              label="Comp Range"
              name="comp_range"
              value={contact.comp_range}
              onChange={handleChange}
            />

            <Field
              label="Status *"
              name="status"
              value={contact.status}
              onChange={handleChange}
            />

            <Field
              label="Relationship Status"
              name="relationship_status"
              value={contact.relationship_status}
              onChange={handleChange}
            />

            <Field
              label="Next Follow-Up Date"
              name="next_follow_up_date"
              type="date"
              value={contact.next_follow_up_date}
              onChange={handleChange}
            />

            <Field
              label="Phone"
              name="phone"
              value={contact.phone}
              onChange={handleChange}
            />

            <Field
              label="Email"
              name="email"
              type="email"
              value={contact.email}
              onChange={handleChange}
            />

            <Field
              label="Address"
              name="address"
              value={contact.address}
              onChange={handleChange}
            />

            <Field
              label="Website"
              name="website"
              value={contact.website}
              onChange={handleChange}
            />
          </div>

          <div style={styles.notesBlock}>
            <label htmlFor="notes" style={styles.label}>
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              value={contact.notes}
              onChange={handleChange}
              rows={5}
              style={styles.textarea}
            />
          </div>

          <div style={styles.buttonRow}>
            <button type="submit" style={styles.primaryButton}>
              Save Contact
            </button>
            <button
              type="button"
              onClick={handleReset}
              style={styles.secondaryButton}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, name, value, onChange, type = "text" }) {
  return (
    <div style={styles.field}>
      <label htmlFor={name} style={styles.label}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        style={styles.input}
      />
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f7f7f7",
    padding: "32px"
  },
  card: {
    maxWidth: "1100px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.08)"
  },
  title: {
    marginTop: 0,
    marginBottom: "8px"
  },
  subtitle: {
    marginTop: 0,
    marginBottom: "24px",
    color: "#555"
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "20px"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "16px"
  },
  field: {
    display: "flex",
    flexDirection: "column"
  },
  label: {
    fontWeight: 600,
    marginBottom: "6px"
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cfcfcf",
    fontSize: "14px"
  },
  textarea: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #cfcfcf",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box"
  },
  notesBlock: {
    display: "flex",
    flexDirection: "column"
  },
  buttonRow: {
    display: "flex",
    gap: "12px"
  },
  primaryButton: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
  },
  secondaryButton: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #999",
    backgroundColor: "#fff",
    cursor: "pointer"
  },
  errorBox: {
    backgroundColor: "#fff4f4",
    border: "1px solid #e0a8a8",
    color: "#8a1f1f",
    padding: "12px 16px",
    borderRadius: "8px"
  },
  errorList: {
    marginTop: "8px",
    marginBottom: 0
  },
  successBox: {
    backgroundColor: "#f1fff3",
    border: "1px solid #9ed7a5",
    color: "#1b5e20",
    padding: "12px 16px",
    borderRadius: "8px"
  }
};