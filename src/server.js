import cors from "cors";
import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

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
const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../ui")));
app.use("/src", express.static(path.join(__dirname)));

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "27@67Hampden",
  database: "recruiter_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../ui/index.html"));
});

app.get("/api/contacts", async (req, res) => {
  try {
    const [rows] = await pool.query(`
    SELECT 
      id,
      date_contacted,
      recruiter_name,
      company,
      role_level AS level,
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
    ORDER BY date_contacted DESC
  `);

    res.json(rows);
  } catch (error) {
    console.error("GET /api/contacts failed:", error);
    res.status(500).json({ error: "Failed to fetch contacts" });
  }
});

app.get("/api/companies/search", async (req, res) => {
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

app.get("/api/reports", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        wr.id,
        wr.week_start,
        wr.week_end,
        wr.submitted,
        wr.submitted_at
      FROM weekly_reports wr
      ORDER BY wr.week_start DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error("GET /api/reports failed:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.get("/api/reports/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[report]] = await pool.query(
      `
      SELECT id, week_start, week_end, submitted, submitted_at
      FROM weekly_reports
      WHERE id = ?
      `,
      [id]
    );

    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }

    const [employers] = await pool.query(
      `
      SELECT
        rt.id,
        rt.date_contacted,
        rt.recruiter_name,
        rt.company,
        rt.role_level AS level,
        rt.role_type,
        rt.location,
        rt.comp_range,
        rt.status,
        rt.relationship_status,
        rt.phone,
        rt.email,
        rt.address,
        rt.website,
        rt.notes
      FROM report_job_contacts rjc
      JOIN recruiter_tracker rt
        ON rt.id = rjc.recruiter_tracker_id
      WHERE rjc.report_id = ?
      ORDER BY rt.company ASC
      `,
      [id]
    );

    res.json({
      ...report,
      employers
    });
  } catch (error) {
    console.error("GET /api/reports/:id failed:", error);
    res.status(500).json({ error: "Failed to fetch report detail" });
  }
});

app.post("/api/contacts", async (req, res) => {
  try {
    const {
      date_contacted,
      recruiter_name,
      company,
      level,
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
        level || null,
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
    console.error("POST /api/contacts failed:", error);
    res.status(500).json({ error: "Failed to create contact" });
  }
});

app.put("/api/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date_contacted,
      recruiter_name,
      company,
      level,
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
        level || null,
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

app.delete("/api/contacts/:id", async (req, res) => {
  try {
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

app.post("/api/reports", async (req, res) => {
  const connection = await pool.getConnection();

  try {
const { selectedIds } = req.body;

if (!Array.isArray(selectedIds) || selectedIds.length !== 4) {
  return res.status(400).json({
    error: "Exactly 4 employers must be selected."
  });
}

const uniqueIds = [...new Set(selectedIds)];

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
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});