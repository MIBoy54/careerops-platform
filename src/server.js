import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { validateWeeklyReport } from "./validateWeeklyReport.js";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../ui")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../ui/index.html"));
});

app.post("/validate-weekly-report", (req, res) => {
  const report = req.body;
  const result = validateWeeklyReport(report);

  if (!result.valid) {
    return res.status(400).json({
      message: "Weekly report validation failed",
      ...result
    });
  }

  return res.status(200).json({
    message: "Weekly report validation passed",
    ...result
  });
});

app.listen(PORT, () => {
  console.log(`CareerOps API listening on http://localhost:${PORT}`);
});