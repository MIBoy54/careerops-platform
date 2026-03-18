import express from "express";
import { validateWeeklyReport } from "./validateWeeklyReport.js";

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "CareerOps API is running"
  });
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
})