import bcrypt from "bcrypt";
import session from "express-session";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs/promises";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔥 LOADING SERVER FILE:", __filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const APP_ENV = (process.env.APP_ENV || 'production').trim()

const IS_SANDBOX = APP_ENV === "demo";

const dbNameMap = {
  production: 'careerops',
  demo: 'careerops_demo',
  dev: 'careerops_dev'
}

const DB_NAME = process.env.DB_NAME || dbNameMap[APP_ENV] || 'careerops'

if (!DB_NAME) {
  throw new Error(`Invalid APP_ENV: ${APP_ENV}`);
}

const DEMO_MODE = String(process.env.DEMO_MODE).trim().toLowerCase() === "true";

const ACTIVE_THRESHOLD_MINUTES = 1;
const STALE_THRESHOLD_MINUTES = 5;

const app = express();

app.use((req, res, next) => {
  console.log(`REQ ${req.method} ${req.url}`);
  next();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

const isCIMode = process.env.CI === "true";

let inMemoryContacts = [];
let inMemoryContactId = 1;

console.log("DB ENV CHECK", {
  DB_HOST: process.env.DB_HOST,
  DB_NAME: DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PORT: process.env.DB_PORT,
  DB_PASSWORD_SET: !!process.env.DB_PASSWORD
});

console.log("MODE CHECK", {
  DEMO_MODE_RAW: process.env.DEMO_MODE,
  DEMO_MODE_ENABLED: DEMO_MODE
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10000
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`REQ ${req.method} ${req.url}`);
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "careerops-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // IMPORTANT for Railway (no HTTPS termination in Node)
      httpOnly: true
    }
  })
);

function requireAuth(req, res, next) {
  console.log("requireAuth session user:", req.session.user);

  if (IS_SANDBOX) {
    if (!req.session.user) {
      req.session.user = {
        id: 0,
        email: "guest@careerops.com",
        full_name: "Sandbox User",
        role: "guest"
      };
    }
    return next();
  }

  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedName = full_name ? String(full_name).trim() : null;

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const [existingUsers] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [trimmedEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: "User already exists." });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `
      INSERT INTO users (email, password_hash, full_name)
      VALUES (?, ?, ?)
      `,
      [trimmedEmail, password_hash, trimmedName]
    );

    req.session.user = {
      id: result.insertId,
      email: trimmedEmail,
      full_name: trimmedName
    };

    res.status(201).json({
      message: "User registered successfully.",
      user: req.session.user
    });
  } catch (error) {
    console.error("Register failed:", error);
    res.status(500).json({ error: "Failed to register user." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    const [users] = await pool.query(
      `
      SELECT id, email, full_name, password_hash
      FROM users
      WHERE email = ?
      `,
      [trimmedEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.email === "b.r.lewis@outlook.com" ? "admin" : "guest"
    };

    const acceptsHtml = (req.headers.accept || "").includes("text/html");

    if (acceptsHtml) {
      return res.redirect("/");
    }

    res.json({
      message: "Login successful.",
      user: req.session.user
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout failed:", err);
      return res.status(500).json({ error: "Failed to log out." });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logout successful." });
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  res.json({
    user: req.session.user,
    app_env: APP_ENV
  });
});

app.use(express.static(path.join(__dirname, "../ui")));
app.use("/src", express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));

function getWeekStart() {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getWeekEnd() {
  const start = getWeekStart();
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
function formatReportFileDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}${month}${year}`;
}

async function ensureReportsDir() {
  const reportsDir = path.join(process.cwd(), "reports");
  await fs.mkdir(reportsDir, { recursive: true });
  return reportsDir;
}

app.get("/setup-db", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recruiter_tracker (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date_contacted DATE,
        recruiter_name VARCHAR(255),
        company VARCHAR(255),
        role_level VARCHAR(100),
        role_type VARCHAR(100),
        location VARCHAR(255),
        comp_range VARCHAR(100),
        status VARCHAR(50),
        relationship_status VARCHAR(50),
        phone VARCHAR(50),
        email VARCHAR(255),
        address VARCHAR(255),
        website VARCHAR(255),
        notes TEXT,
        reported_to_unemployment VARCHAR(10),
        follow_up_date DATE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        week_start DATE,
        week_end DATE,
        submitted BOOLEAN DEFAULT FALSE,
        submitted_at TIMESTAMP NULL
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_job_contacts (
        report_id INT,
        recruiter_tracker_id INT
      );
    `);

    res.send("Database setup complete!");
  } catch (err) {
    console.error("setup-db failed:", err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.get("/", (req, res) => {
  try {
    const indexPath = path.join(__dirname, "../ui/index.html");
    console.log("ROOT HIT", {
      hasUser: !!req.session?.user,
      demoMode: DEMO_MODE,
      indexPath
    });

    if (!req.session?.user && !DEMO_MODE) {
      console.log("ROOT REDIRECT -> /login.html");
      return res.redirect("/login.html");
    }

    console.log("ROOT SENDFILE ->", indexPath);
    return res.sendFile(indexPath);
  } catch (err) {
    console.error("Root route error:", err);
    return res.status(500).send("Server error");
  }
});

app.get("/api/contacts", requireAuth, async (req, res) => {
  console.log("HIT PROTECTED /api/contacts ROUTE");
  console.log("GET /api/contacts MODE:", DEMO_MODE);

  const isCIMode = process.env.CI === "true";

  try {
    // 👉 CI shortcut (no DB)
    if (isCIMode) {
      console.log("CI GET /api/contacts RETURNING:", inMemoryContacts.length, inMemoryContacts);
      return res.json(inMemoryContacts);
    }

    const [rows] = await pool.query(`
      SELECT
        id,
        date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        reported_to_unemployment AS reported_unemployment,
        follow_up_date AS next_follow_up_date,
        phone,
        email,
        address,
        website,
        notes
      FROM recruiter_tracker
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("GET /api/contacts failed:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

    app.get('/api/validation-runs', async (req, res) => {
      console.log('HIT NEW /api/validation-runs ROUTE');
      try {
        const [rows] = await pool.query(`
      SELECT
        id,
        run_type,
        status,
        started_at,
        completed_at,
        duration_ms,
        trigger_source,
        notes,
        created_at
      FROM validation_runs
      ORDER BY id DESC
    `);

        res.json(rows);
      } catch (err) {
        console.error('validation-runs failed:', err);
        res.status(500).json({ error: 'Failed to load validation run history.' });
      }
    });

    app.get("/api/companies/search", requireAuth, async (req, res) => {
      try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
          return res.json([]);
        }

        const [rows] = await pool.query(
          `
      SELECT DISTINCT company
      FROM recruiter_tracker
      WHERE company IS NOT NULL
        AND company <> ''
        AND company LIKE ?
      ORDER BY company ASC
      LIMIT 10
      `,
          [`%${q}%`]
        );

        res.json(rows.map((row) => row.company));
      } catch (error) {
        console.error("GET /api/companies/search failed:", error);
        res.status(500).json({ error: "Failed to search companies" });
      }
    });

    app.get("/api/reports", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(`
  SELECT
    wr.id,
    wr.week_start,
    wr.week_end,
    wr.submitted,
    wr.submitted_at
  FROM weekly_reports wr
  INNER JOIN (
    SELECT
      week_start,
      week_end,
      MAX(id) AS max_id
    FROM weekly_reports
    WHERE submitted = 1
    GROUP BY week_start, week_end
  ) latest
    ON wr.id = latest.max_id
  ORDER BY wr.week_start DESC, wr.id DESC
`);

        res.json(rows);
      } catch (error) {
        console.error("GET /api/reports failed:", error);
        res.status(500).json({ error: "Failed to load weekly reports" });
      }
    });

    app.get("/api/reports/unemployment", requireAuth, async (req, res) => {
      try {
        const { start, end } = req.query;

        if (!start || !end) {
          return res.status(400).json({
            error: "start and end query parameters are required. Example: /api/reports/unemployment?start=2026-03-19&end=2026-03-25"
          });
        }

        const [rows] = await pool.query(
          `
      SELECT
        id,
        DATE_FORMAT(date_contacted, '%m/%d/%Y') AS date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        phone,
        email,
        address,
        website,
        notes,
        reported_to_unemployment
      FROM recruiter_tracker
      WHERE reported_to_unemployment = 'Yes'
        AND DATE(date_contacted) BETWEEN ? AND ?
      ORDER BY date_contacted DESC, id DESC
      `,
          [start, end]
        );

        res.json({
          report_start: start,
          report_end: end,
          total_jobs_reported: rows.length,
          jobs: rows
        });
      } catch (error) {
        console.error("Unemployment report failed:", error);
        res.status(500).json({ error: "Error generating unemployment report" });
      }
    });

    app.get("/api/reports/unemployment/export", requireAuth, async (req, res) => {
      try {
        const { start, end } = req.query;

        if (!start || !end) {
          return res.status(400).send("Start and end dates required");
        }

        const [rows] = await pool.query(
          `
      SELECT
        id,
        DATE_FORMAT(date_contacted, '%m/%d/%Y') AS date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        phone,
        email,
        address,
        website,
        notes
      FROM recruiter_tracker
      WHERE reported_to_unemployment = 'Yes'
        AND DATE(follow_up_date) BETWEEN ? AND ?
      ORDER BY follow_up_date DESC, id DESC
      `,
          [start, end]
        );

        if (!rows.length) {
          return res.status(404).send("No data for selected range");
        }

        const headers = [
          "ID",
          "Date Contacted",
          "Recruiter Name",
          "Company",
          "Role Level",
          "Role Type",
          "Location",
          "Comp Range",
          "Status",
          "Relationship Status",
          "Phone",
          "Email",
          "Address",
          "Website",
          "Notes"
        ].join(",");

        const csv = [
          headers,
          ...rows.map(row =>
            Object.values(row)
              .map(value => `"${(value ?? "").toString().replace(/"/g, '""')}"`)
              .join(",")
          )
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment(`unemployment_report_${start}_to_${end}.csv`);
        res.send(csv);

      } catch (error) {
        console.error("Unemployment CSV export failed:", error);
        res.status(500).send("Error generating CSV");
      }
    });

    app.get("/api/reports/:id", requireAuth, async (req, res) => {
      try {
        const reportId = req.params.id;

        const [reportRows] = await pool.query(
          `
      SELECT
        id,
        week_start,
        week_end,
        submitted,
        submitted_at
      FROM weekly_reports
      WHERE id = ?
      `,
          [reportId]
        );

        if (!reportRows.length) {
          return res.status(404).json({ error: "Report not found" });
        }

        const report = reportRows[0];

        const [employerRows] = await pool.query(
          `
      SELECT
        rt.id,
        rt.date_contacted,
        rt.recruiter_name,
        rt.company,
        rt.role_level,
        rt.role_type,
        rt.location,
        rt.comp_range,
        rt.status,
        rt.relationship_status,
        rt.phone,
        rt.email,
        rt.address,
        rt.website,
        rt.notes,
        rt.reported_to_unemployment
      FROM report_job_contacts rjc
      JOIN recruiter_tracker rt
        ON rt.id = rjc.recruiter_tracker_id
      WHERE rjc.report_id = ?
      ORDER BY rt.date_contacted DESC, rt.id DESC
      `,
          [reportId]
        );

        res.json({
          ...report,
          employers: employerRows
        });
      } catch (error) {
        console.error("GET /api/reports/:id failed:", error);
        res.status(500).json({ error: "Failed to load weekly report detail" });
      }
    });

    app.get("/api/contacts/export", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(`
      SELECT
        id,
        date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        phone,
        email,
        address,
        website,
        notes
      FROM recruiter_tracker
      ORDER BY date_contacted DESC
    `);

        if (rows.length === 0) {
          return res.status(404).send("No data found");
        }

        const headers = [
          "ID",
          "Date Contacted",
          "Recruiter Name",
          "Company",
          "Role Level",
          "Role Type",
          "Location",
          "Comp Range",
          "Status",
          "Relationship Status",
          "Phone",
          "Email",
          "Address",
          "Website",
          "Notes"
        ].join(",");

        const csv = [
          headers,
          ...rows.map(row =>
            Object.values(row)
              .map((value, index) => {
                if (index === 1 && value) {
                  const d = new Date(value);
                  const formatted = `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d
                    .getDate()
                    .toString()
                    .padStart(2, "0")}/${d.getFullYear()}`;
                  return `"${formatted}"`;
                }

                return `"${(value ?? "").toString().replace(/"/g, '""')}"`;
              })
              .join(",")
          )
        ].join("\n");

        res.header("Content-Type", "text/csv");
        res.attachment("recruiter_export.csv");
        res.send(csv);
      } catch (error) {
        console.error("CSV export failed:", error);
        res.status(500).send("Error generating CSV");
      }
    });

app.post("/api/contacts", requireAuth, async (req, res) => { 
  try {
    const isDemoSandbox = IS_SANDBOX;
    const isAdmin = req.session?.user?.role === "admin";
    const isCIMode = process.env.CI === "true";

    if (!isDemoSandbox && !isAdmin) {
      return res.status(403).json({ error: "Read-only mode." });
    }

    // 👉 CI shortcut (no DB)
if (isCIMode) {
  console.log("CI POST /api/contacts BEFORE:", inMemoryContacts.length);

  const newContact = {
    id: inMemoryContactId++,
    ...req.body
  };

  inMemoryContacts.push(newContact);

  console.log("CI POST /api/contacts AFTER:", inMemoryContacts.length, newContact);

  return res.status(201).json({
    message: "Contact created successfully",
    id: newContact.id
  });
}

    const {
      date_contacted,
      recruiter_name,
      company,
      role_level,
      role_type,
      location,
      comp_range,
      status,
      relationship_status,
      reported_unemployment,
      next_follow_up_date,
      phone,
      email,
      address,
      website,
      notes
    } = req.body;

    console.log("POST /api/contacts payload:", req.body);

    const [result] = await pool.query(
      `
      INSERT INTO recruiter_tracker (
        date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        reported_to_unemployment,
        follow_up_date,
        phone,
        email,
        address,
        website,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        date_contacted || null,
        recruiter_name || null,
        company || null,
        role_level || null,
        role_type || null,
        location || null,
        comp_range || null,
        status || null,
        relationship_status || null,
        reported_unemployment || "No",
        next_follow_up_date || null,
        phone || null,
        email || null,
        address || null,
        website || null,
        notes || null
      ]
    );

    res.status(201).json({
      message: "Contact created successfully",
      id: result.insertId
    });
  } catch (error) {
    console.error("POST /api/contacts failed:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    res.status(500).json({ error: "Failed to create contact" });
  }
});

    app.get("/api/analytics/sessions-today", requireAuth, async (req, res) => {
      try {
        const [tableCheck] = await pool.query(`
      SELECT COUNT(*) AS count
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'analytics_sessions'
    `);

        if (!tableCheck[0]?.count) {
          return res.json({ sessions_today: 0 });
        }

        const [rows] = await pool.query(`
      SELECT COUNT(*) AS sessions_today
      FROM analytics_sessions
      WHERE DATE(created_at) = CURDATE()
    `);

        res.json({
          sessions_today: rows[0]?.sessions_today ?? 0
        });
      } catch (error) {
        console.error("GET /api/analytics/sessions-today failed:", error);
        res.json({ sessions_today: 0 });
      }
    });

    app.get("/api/validation-runs", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(
          `
      SELECT
        id,
        run_type,
        status,
        started_at,
        completed_at,
        duration_ms,
        trigger_source,
        notes,
        created_at
      FROM validation_runs
      ORDER BY id DESC
      `
        );

        res.json(rows);
      } catch (error) {
        console.error("GET /api/validation-runs failed:", error);
        res.status(500).json({ error: "Failed to load validation run history." });
      }
    });

    app.post("/api/validation-runs/start", requireAuth, async (req, res) => {
      try {
        const { run_type, trigger_source, notes } = req.body;

        const [result] = await pool.query(
          `
      INSERT INTO validation_runs (
        run_type,
        status,
        started_at,
        trigger_source,
        notes
      )
      VALUES (?, 'STARTED', NOW(), ?, ?)
      `,
          [run_type, trigger_source || null, notes || null]
        );

        res.status(201).json({
          id: result.insertId,
          message: "Validation run started."
        });
      } catch (error) {
        console.error("POST /api/validation-runs/start failed:", error);
        res.status(500).json({ error: "Failed to start validation run." });
      }
    });

app.put("/api/contacts/:id", requireAuth, async (req, res) => {
  try {
    const isDemoSandbox = DEMO_MODE === true;
    const isAdmin = req.session?.user?.role === "admin";
    const isCIMode = process.env.CI === "true";

    if (!isDemoSandbox && !isAdmin) {
      return res.status(403).json({ error: "Read-only mode." });
    }

    // 👉 CI shortcut (no DB)
    if (isCIMode) {
      const id = Number(req.params.id);
      const index = inMemoryContacts.findIndex((c) => c.id === id);

      if (index === -1) {
        return res.status(404).json({ error: "Contact not found" });
      }

      let finalReportedUnemployment = req.body.reported_unemployment || "No";
      let finalDateReported = req.body.date_reported || null;

      if (String(req.body.status || "").trim().toLowerCase() === "submitted") {
        finalReportedUnemployment = "Yes";
        finalDateReported = new Date().toISOString();
      }

      inMemoryContacts[index] = {
        ...inMemoryContacts[index],
        ...req.body,
        id,
        reported_unemployment: finalReportedUnemployment,
        date_reported: finalDateReported
      };

      return res.json({ message: "Contact updated successfully" });
    }

    const { id } = req.params;
    const {
      date_contacted,
      recruiter_name,
      company,
      role_level,
      role_type,
      location,
      comp_range,
      status,
      relationship_status,
      reported_unemployment,
      date_reported,
      next_follow_up_date,
      phone,
      email,
      address,
      website,
      notes
    } = req.body;
    
    let finalReportedUnemployment = reported_unemployment || "No";
    let finalDateReported = date_reported || null;

    if (String(status || "").trim().toLowerCase() === "submitted") {
      finalReportedUnemployment = "Yes";
      finalDateReported = new Date();
    }

    await pool.query(
      `
        UPDATE recruiter_tracker
        SET
          date_contacted = ?,
          recruiter_name = ?,
          company = ?,
          role_level = ?,
          role_type = ?,
          location = ?,
          comp_range = ?,
          status = ?,
          relationship_status = ?,
          reported_to_unemployment = ?,
          date_reported = ?,
          follow_up_date = ?,
          phone = ?,
          email = ?,
          address = ?,
          website = ?,
          notes = ?
        WHERE id = ?
      `,
      [
        date_contacted || null,
        recruiter_name || null,
        company || null,
        role_level || null,
        role_type || null,
        location || null,
        comp_range || null,
        status || null,
        relationship_status || null,
        finalReportedUnemployment,
        finalDateReported,
        next_follow_up_date || null,
        phone || null,
        email || null,
        address || null,
        website || null,
        notes || null,
        id
      ]
    );

    res.json({ message: "Contact updated successfully" });
  } catch (error) {
    console.error("PUT /api/contacts/:id failed:", error);
    res.status(500).json({ error: "Failed to update contact" });
  }
});

    app.put("/api/analytics/heartbeat", async (req, res) => {
      try {
        const { session_id, page_path, seconds } = req.body;

        if (!session_id || !page_path || typeof seconds !== "number") {
          return res.status(400).json({ error: "Invalid heartbeat payload" });
        }

        await pool.query(
          `
      UPDATE visitor_analytics
      SET
        last_seen = NOW(),
        time_spent_seconds = time_spent_seconds + ?
      WHERE session_id = ? AND page_path = ?
      `,
          [seconds, session_id, page_path]
        );

        await pool.query(
          `
      INSERT INTO analytics_heartbeat_events (
        session_id,
        page_path,
        event_time,
        seconds
      )
      VALUES (?, ?, NOW(), ?)
      `,
          [session_id, page_path, seconds]
        );

        res.status(200).json({ success: true });
      } catch (error) {
        console.error("Heartbeat update failed:", error);
        res.status(500).json({ error: "Heartbeat failed" });
      }
    });

app.delete("/api/contacts/:id", requireAuth, async (req, res) => {
  try {
    const isDemoSandbox = DEMO_MODE === true;
    const isAdmin = req.session?.user?.role === "admin";
    const isCIMode = process.env.CI === "true";

    if (!isDemoSandbox && !isAdmin) {
      return res.status(403).json({ error: "Read-only mode." });
    }

    // 👉 CI shortcut (no DB)
    if (isCIMode) {
      const id = Number(req.params.id);
      inMemoryContacts = inMemoryContacts.filter((c) => c.id !== id);
      return res.json({ message: "Contact deleted successfully" });
    }

    const { id } = req.params;

    await pool.query(
      `
      DELETE FROM recruiter_tracker
      WHERE id = ?
      `,
      [id]
    );

    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/contacts/:id failed:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

    app.put("/api/validation-runs/:id/complete", requireAuth, async (req, res) => {
      try {
        const { id } = req.params;
        const { status, notes } = req.body;

        const [rows] = await pool.query(
          `SELECT started_at FROM validation_runs WHERE id = ?`,
          [id]
        );

        if (!rows.length) {
          return res.status(404).json({ error: "Validation run not found." });
        }

        const startedAt = new Date(rows[0].started_at);
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        await pool.query(
          `
      UPDATE validation_runs
      SET
        status = ?,
        completed_at = NOW(),
        duration_ms = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
      `,
          [status, durationMs, notes || null, id]
        );

        res.json({ message: "Validation run completed." });
      } catch (error) {
        console.error("PUT /api/validation-runs/:id/complete failed:", error);
        res.status(500).json({ error: "Failed to complete validation run." });
      }
    });

    app.post("/api/reports", requireAuth, async (req, res) => {
      const connection = await pool.getConnection();

  try {
    const isDemoSandbox = DEMO_MODE === true;
    const isAdmin = req.session?.user?.role === "admin";

    if (!isDemoSandbox && !isAdmin) {
      return res.status(403).json({ error: "Read-only mode." });
    }

        const { selectedIds = [] } = req.body;
        const uniqueIds = [...new Set(selectedIds.map(Number))];

        if (uniqueIds.length !== 4) {
          return res.status(400).json({
            error: "Selected employers must be unique."
          });
        }
	
        await connection.beginTransaction();

        const [reportResult] = await connection.query(
          `
	  INSERT INTO weekly_reports (week_start, week_end, submitted, submitted_at)
	  VALUES (?, ?, 1, NOW())
	  `,
          [getWeekStart(), getWeekEnd()]
        );

        const reportId = reportResult.insertId;

        const placeholders = uniqueIds.map(() => "(?, ?)").join(", ");
        const values = uniqueIds.flatMap((id) => [reportId, id]);

        await connection.query(
          `
      INSERT INTO report_job_contacts (report_id, recruiter_tracker_id)
      VALUES ${placeholders}
      `,
          values
        );

        const updatePlaceholders = uniqueIds.map(() => "?").join(", ");

        await connection.query(
          `
	  UPDATE recruiter_tracker
	  SET
		reported_to_unemployment = 'Yes',
		follow_up_date = CURDATE()
	  WHERE id IN (${updatePlaceholders})
	  `,
          uniqueIds
        );

        await connection.commit();

        res.status(201).json({
          message: "Weekly report generated successfully",
          reportId
        });
      } catch (error) {
        await connection.rollback();
        console.error("POST /api/reports failed:", error);
        res.status(500).json({ error: "Failed to generate weekly report" });
      } finally {
        connection.release();
      }
    });

    app.get("/api/analytics/summary", requireAuth, async (req, res) => {
      try {
        const [[totals]] = await pool.query(
          `
      SELECT
        COUNT(*) AS total_visits,
        COUNT(DISTINCT session_id) AS unique_visitors,
        COALESCE(SUM(time_spent_seconds), 0) AS total_time_spent_seconds,
        COALESCE(ROUND(AVG(time_spent_seconds), 2), 0) AS avg_time_spent_seconds
      FROM visitor_analytics
      `
        );

        const [pages] = await pool.query(
          `
      SELECT
        page_path,
        COUNT(*) AS visits,
        COUNT(DISTINCT session_id) AS unique_visitors,
        COALESCE(SUM(time_spent_seconds), 0) AS total_time_spent_seconds,
        COALESCE(ROUND(AVG(time_spent_seconds), 2), 0) AS avg_time_spent_seconds
      FROM visitor_analytics
      GROUP BY page_path
      ORDER BY visits DESC
      `
        );

        res.status(200).json({ totals, pages });
      } catch (error) {
        console.error("GET /api/analytics/summary failed:", error);
        res.status(500).json({ error: "Failed to load analytics summary." });
      }
    });

    function isValidSessionId(value) {
      return typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 100;
    }

    app.post("/api/analytics/start", async (req, res) => {
      try {
        const { session_id, page_path } = req.body;

        if (!isValidSessionId(session_id) || !page_path) {
          return res.status(400).json({ error: "session_id and page_path are required." });
        }

    await pool.query(
      `
      INSERT INTO visitor_analytics (
        session_id,
        page_path,
        first_seen,
        last_seen,
        time_spent_seconds
      )
      VALUES (?, ?, NOW(), NOW(), 0)
      `,
      [session_id.trim(), page_path]
    );
        res.status(200).json({ success: true });
      } catch (error) {
        console.error("POST /api/analytics/start failed:", error);
        res.status(500).json({ error: "Failed to start analytics session." });
      }
    });

    app.get("/api/analytics/trend", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(
          `
      SELECT
        DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:00') AS minute_bucket,
        COUNT(*) AS heartbeat_count,
        COUNT(DISTINCT session_id) AS unique_sessions,
        COALESCE(SUM(seconds), 0) AS total_seconds
      FROM analytics_heartbeat_events
      WHERE event_time >= NOW() - INTERVAL 8 HOUR
      GROUP BY DATE_FORMAT(event_time, '%Y-%m-%d %H:%i:00')
      ORDER BY minute_bucket ASC
      `
        );

        res.status(200).json(rows);
      } catch (error) {
        console.error("GET /api/analytics/trend failed:", error);
        res.status(500).json({ error: "Failed to load analytics trend." });
      }
    });

    app.get("/api/analytics/active-users", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(
          `
      SELECT COUNT(DISTINCT session_id) AS active_users
      FROM visitor_analytics
      WHERE last_seen >= NOW() - INTERVAL ${ACTIVE_THRESHOLD_MINUTES} MINUTE
      `
        );

        res.status(200).json({
          active_users: rows[0]?.active_users ?? 0
        });
      } catch (error) {
        console.error("GET /api/analytics/active-users failed:", error);
        res.status(500).json({ error: "Failed to load active users." });
      }
    });

    app.get("/api/analytics/stale-sessions", requireAuth, async (req, res) => {
      try {
        const [rows] = await pool.query(
          `
      SELECT COUNT(DISTINCT session_id) AS stale_sessions
      FROM visitor_analytics
      WHERE last_seen < NOW() - INTERVAL ${STALE_THRESHOLD_MINUTES} MINUTE
      `
        );

        res.status(200).json({
          stale_sessions: rows[0]?.stale_sessions ?? 0
        });
      } catch (error) {
        console.error("GET /api/analytics/stale-sessions failed:", error);
        res.status(500).json({ error: "Failed to load stale sessions." });
      }
    });

    app.get("/api/companies/details", requireAuth, async (req, res) => {
      try {
        const company = (req.query.company || "").trim();

        if (!company) {
          return res.status(400).json({ error: "Company is required." });
        }

        const [rows] = await pool.query(
          `
      SELECT
        id,
        date_contacted,
        recruiter_name,
        company,
        role_level,
        role_type,
        location,
        comp_range,
        status,
        relationship_status,
        phone,
        email,
        address,
        website,
        notes
      FROM recruiter_tracker
      WHERE TRIM(company) = TRIM(?)
      ORDER BY id DESC
      LIMIT 1
      `,
          [company]
        );

        if (!rows.length) {
          return res.status(404).json({ error: "No company record found." });
        }

        console.log("Company details returned:", rows[0]);

        res.json(rows[0]);
      } catch (error) {
        console.error("GET /api/companies/details failed:", error);
        res.status(500).json({ error: "Failed to fetch company details." });
      }
    });

    app.get("/hello", (req, res) => {
      res.send("hello");
    });

    app.get("/db-ping", async (req, res) => {
      try {
        const [rows] = await pool.query("SELECT 1 AS ok");
        res.json(rows[0]);
      } catch (err) {
        console.error("db-ping failed:", err);
        res.status(500).json({
          error: err.message,
          code: err.code,
          errno: err.errno
        });
      }
    });

app.get("/env-check", (req, res) => {
  res.json({
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PORT: process.env.DB_PORT,
    DB_PASSWORD_SET: !!process.env.DB_PASSWORD
  });
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});