import { Router } from "express";
import { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import { db } from "../db/client";
import { savedReports } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const reportConfigSchema = z.object({
  metrics: z.array(z.string()).min(1),
  filters: z.record(z.unknown()).default({}),
  groupBy: z.string().default("month"),
  dateRange: z.object({ from: z.string(), to: z.string() }),
  chartType: z.enum(["line", "bar", "area", "pie"]).default("line"),
});

const createReportSchema = z.object({
  name: z.string().min(1).max(200),
  config: reportConfigSchema,
  isShared: z.boolean().default(false),
});

router.get(
  "/",
  requireAuth,
  requirePermission("reports:read"),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest;
    const reports = await db
      .select()
      .from(savedReports)
      .where(or(eq(savedReports.userId, user.id), eq(savedReports.isShared, true)));
    res.json({ data: reports });
  })
);

router.post(
  "/",
  requireAuth,
  requirePermission("reports:write"),
  validate(createReportSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as AuthenticatedRequest;
    const { name, config, isShared } = req.body;

    const [report] = await db
      .insert(savedReports)
      .values({ userId: user.id, name, config, isShared })
      .returning();

    res.status(201).json({ data: report });
  })
);

router.get(
  "/:id",
  requireAuth,
  requirePermission("reports:read"),
  asyncHandler(async (req, res) => {
    const { user } = req as unknown as AuthenticatedRequest;
    const report = await db
      .select()
      .from(savedReports)
      .where(
        and(
          eq(savedReports.id, req.params.id),
          or(eq(savedReports.userId, user.id), eq(savedReports.isShared, true))
        )
      )
      .limit(1);

    if (!report[0]) {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    res.json({ data: report[0] });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("reports:write"),
  asyncHandler(async (req, res) => {
    const { user } = req as unknown as AuthenticatedRequest;
    const deleted = await db
      .delete(savedReports)
      .where(and(eq(savedReports.id, req.params.id), eq(savedReports.userId, user.id)))
      .returning();

    if (!deleted[0]) {
      res.status(404).json({ error: "Report not found or unauthorized" });
      return;
    }
    res.json({ message: "Report deleted" });
  })
);

export default router;
