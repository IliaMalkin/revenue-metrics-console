import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { asyncHandler } from "../middleware/asyncHandler";
import * as metricsService from "../services/metricsService";

const router = Router();

router.get(
  "/",
  requireAuth as any,
  requirePermission("metrics:read") as any,
  asyncHandler(async (req, res) => {
    const page = parseInt(String(req.query.page ?? "1"));
    const pageSize = Math.min(parseInt(String(req.query.pageSize ?? "25")), 100);
    const filters = {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      type: req.query.type as string | undefined,
    };

    const { data, total } = await metricsService.getTransactionsList(page, pageSize, filters);

    res.json({
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  })
);

export default router;
