import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/asyncHandler";
import * as metricsService from "../services/metricsService";

const router = Router();

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          const str = val === null || val === undefined ? "" : String(val);
          return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        })
        .join(",")
    ),
  ];
  return lines.join("\n");
}

router.get(
  "/csv/transactions",
  requireAuth as any,
  requirePermission("reports:export") as any,
  asyncHandler(async (req, res) => {
    const { data } = await metricsService.getTransactionsList(1, 10000, {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });

    const csv = toCSV(data as unknown as Record<string, unknown>[]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions_${Date.now()}.csv`
    );
    res.send(csv);
  })
);

router.get(
  "/csv/revenue",
  requireAuth as any,
  requirePermission("reports:export") as any,
  asyncHandler(async (req, res) => {
    const months = parseInt(String(req.query.months ?? "12"));
    const data = await metricsService.getRevenueTimeseries(months);
    const csv = toCSV(data as unknown as Record<string, unknown>[]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=revenue_${Date.now()}.csv`);
    res.send(csv);
  })
);

export default router;
