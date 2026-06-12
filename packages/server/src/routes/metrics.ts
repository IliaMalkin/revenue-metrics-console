import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/asyncHandler";
import type { MetricFilters } from "@dashboard/shared";
import * as metricsService from "../services/metricsService";

const router = Router();

function parseFilters(query: Record<string, string | string[] | undefined>): MetricFilters {
  return {
    dateFrom: query.dateFrom as string | undefined,
    dateTo: query.dateTo as string | undefined,
    plans: query.plans
      ? Array.isArray(query.plans)
        ? query.plans
        : (query.plans as string).split(",")
      : undefined,
    countries: query.countries
      ? Array.isArray(query.countries)
        ? query.countries
        : (query.countries as string).split(",")
      : undefined,
  };
}

router.get(
  "/overview",
  requireAuth,
  requirePermission("metrics:read"),
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as Record<string, string>);
    const data = await metricsService.getOverviewMetrics(filters);
    res.json({ data });
  })
);

router.get(
  "/revenue/timeseries",
  requireAuth,
  requirePermission("metrics:read"),
  asyncHandler(async (req, res) => {
    const months = parseInt(String(req.query.months ?? "12"));
    const filters = parseFilters(req.query as Record<string, string>);
    const data = await metricsService.getRevenueTimeseries(months, filters);
    res.json({ data });
  })
);

router.get(
  "/distribution/plans",
  requireAuth,
  requirePermission("metrics:read"),
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as Record<string, string>);
    const data = await metricsService.getPlanDistribution(filters);
    res.json({ data });
  })
);

router.get(
  "/distribution/countries",
  requireAuth,
  requirePermission("metrics:read"),
  asyncHandler(async (req, res) => {
    const filters = parseFilters(req.query as Record<string, string>);
    const data = await metricsService.getCountryDistribution(filters);
    res.json({ data });
  })
);

export default router;
