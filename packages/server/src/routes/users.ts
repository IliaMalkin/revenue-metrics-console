import { Router } from "express";
import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { db } from "../db/client";
import { users, roles, auditLogs } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../middleware/asyncHandler";
import type { AuthenticatedRequest } from "../middleware/auth";

const router = Router();

async function logAudit(
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: unknown
) {
  await db.insert(auditLogs).values({
    userId,
    action,
    targetType,
    targetId,
    metadata: metadata as Record<string, string>,
  });
}

router.get(
  "/roles",
  requireAuth,
  requirePermission("users:read"),
  asyncHandler(async (_req, res) => {
    const result = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles);
    res.json({ data: result });
  })
);

router.get(
  "/",
  requireAuth,
  requirePermission("users:read"),
  asyncHandler(async (req, res) => {
    const result = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
        roleId: users.roleId,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        roleName: roles.name,
        rolePermissions: roles.permissions,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id));

    res.json({ data: result });
  })
);

const updateRoleSchema = z.object({ roleId: z.number().int().positive() });

router.patch(
  "/:id/role",
  requireAuth,
  requirePermission("users:manage"),
  validate(updateRoleSchema),
  asyncHandler(async (req, res) => {
    const { user } = req as unknown as AuthenticatedRequest;
    const { roleId } = req.body;

    const [updated] = await db
      .update(users)
      .set({ roleId })
      .where(eq(users.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await logAudit(user.id, "user.role_changed", "user", req.params.id, { newRoleId: roleId });
    res.json({ data: updated });
  })
);

router.patch(
  "/:id/status",
  requireAuth,
  requirePermission("users:manage"),
  asyncHandler(async (req, res) => {
    const { user } = req as unknown as AuthenticatedRequest;
    const { isActive } = req.body;

    const [updated] = await db
      .update(users)
      .set({ isActive })
      .where(eq(users.id, req.params.id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const action = isActive ? "user.activated" : "user.deactivated";
    await logAudit(user.id, action, "user", req.params.id);
    res.json({ data: updated });
  })
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("users:manage"),
  asyncHandler(async (req, res) => {
    const { user } = req as unknown as AuthenticatedRequest;
    if (req.params.id === user.id) {
      res.status(400).json({ error: "Cannot delete yourself" });
      return;
    }

    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, req.params.id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await logAudit(user.id, "user.deleted", "user", req.params.id);
    res.json({ message: "User deleted" });
  })
);

router.get(
  "/audit-logs",
  requireAuth,
  requirePermission("users:manage"),
  asyncHandler(async (req, res) => {
    const page = parseInt(String(req.query.page ?? "1"));
    const pageSize = Math.min(parseInt(String(req.query.pageSize ?? "50")), 100);
    const offset = (page - 1) * pageSize;

    const [logs, [{ total }]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          targetType: auditLogs.targetType,
          targetId: auditLogs.targetId,
          metadata: auditLogs.metadata,
          createdAt: auditLogs.createdAt,
          userEmail: users.email,
          userFullName: users.fullName,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(auditLogs.createdAt)
        .limit(pageSize)
        .offset(offset),
      db.select({ total: count() }).from(auditLogs),
    ]);

    res.json({ data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  })
);

export default router;
