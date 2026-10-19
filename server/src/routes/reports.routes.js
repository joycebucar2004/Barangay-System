import { Router } from "express";
import { reportPeriodSummary, listResidentExpenses } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

export const reportsRouter = Router();

reportsRouter.get("/my-expenses", authRequired, requireRole("resident"), async (req, res, next) => {
  try {
    res.json({ expenses: await listResidentExpenses(req.userId) });
  } catch (err) {
    next(err);
  }
});

const colors = ["#1a3a6b", "#d4a017", "#2ecc71", "#9b59b6", "#e74c3c", "#3498db", "#f39c12"];

function periodRange(period, selectedDate) {
  let start;
  let end;
  let bucketFormat;
  let buckets;
  const datePart = (date) => date.toISOString().slice(0, 10);

  if (period === "daily") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return null;
    const date = new Date(`${selectedDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || datePart(date) !== selectedDate || date.getUTCFullYear() > 9998) return null;
    start = selectedDate;
    date.setUTCDate(date.getUTCDate() + 1);
    end = datePart(date);
    bucketFormat = "%Y-%m-%d";
    buckets = [{ key: selectedDate, label: selectedDate }];
  } else if (period === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(selectedDate)) return null;
    const [year, month] = selectedDate.split("-").map(Number);
    if (month < 1 || month > 12 || year < 1000 || year > 9998) return null;
    const date = new Date(Date.UTC(year, month - 1, 1));
    start = datePart(date);
    date.setUTCMonth(date.getUTCMonth() + 1);
    end = datePart(date);
    bucketFormat = "%d";
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    buckets = Array.from({ length: days }, (_, i) => ({ key: String(i + 1).padStart(2, "0"), label: String(i + 1) }));
  } else if (period === "yearly") {
    if (!/^\d{4}$/.test(selectedDate)) return null;
    const year = Number(selectedDate);
    if (year < 1000 || year > 9998) return null;
    start = `${selectedDate}-01-01`;
    end = `${year + 1}-01-01`;
    bucketFormat = "%b";
    buckets = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => ({ key: month, label: month }));
  } else {
    return null;
  }

  return { start, end, bucketFormat, buckets };
}

reportsRouter.get("/summary", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const period = String(req.query.period || "monthly");
    const currentMonth = new Date().toISOString().slice(0, 7);
    const selectedDate = String(req.query.date || currentMonth);
    const range = periodRange(period, selectedDate);
    if (!range) return res.status(400).json({ error: "Choose a valid day, month, or year for the report" });
    const report = await reportPeriodSummary(range);
    report.distribution = report.distribution.map((d, i) => ({ ...d, color: colors[i % colors.length] }));
    res.json(report);
  } catch (err) {
    next(err);
  }
});
