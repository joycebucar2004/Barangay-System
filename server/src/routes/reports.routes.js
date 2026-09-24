import { Router } from "express";
import { reportMonthlyRequests, reportDocumentDistribution, reportStatusCounts, reportRevenueSummary, reportSourceSummary } from "../db.js";
import { authRequired, requireRole } from "../auth.js";

export const reportsRouter = Router();

const colors = ["#1a3a6b", "#d4a017", "#2ecc71", "#9b59b6", "#e74c3c", "#3498db", "#f39c12"];

reportsRouter.get("/summary", authRequired, requireRole("staff", "admin"), async (req, res, next) => {
  try {
    const [monthly, distributionRaw, statusCounts, revenueSummary, sources] = await Promise.all([
      reportMonthlyRequests(),
      reportDocumentDistribution(),
      reportStatusCounts(),
      reportRevenueSummary(),
      reportSourceSummary(),
    ]);
    const distribution = distributionRaw.map((d, i) => ({ ...d, color: colors[i % colors.length] }));

    res.json({
      totalThisMonth: revenueSummary.totalThisMonth,
      releasedThisMonth: revenueSummary.releasedThisMonth,
      revenue: revenueSummary.revenue,
      revenueThisMonth: revenueSummary.revenueThisMonth,
      outstanding: revenueSummary.outstanding,
      outstandingCount: revenueSummary.outstandingCount,
      revenueByDocType: revenueSummary.revenueByDocType,
      monthly,
      distribution,
      statusCounts,
      sources,
    });
  } catch (err) {
    next(err);
  }
});
