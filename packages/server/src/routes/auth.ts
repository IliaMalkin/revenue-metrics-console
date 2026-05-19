import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { db } from "../db/client";
import { users, roles, refreshTokens } from "../db/schema";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import type { AuthenticatedRequest } from "../middleware/auth";
import type { Role, RoleName } from "@dashboard/shared";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(1),
  roleId: z.union([z.number().int().positive(), z.string()]).optional(),
});

router.post("/register", validate(registerSchema), asyncHandler(async (req, res) => {
  const { email, password, fullName, roleId } = req.body as z.infer<typeof registerSchema>;

  // Check if email is already taken
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  // Resolve roleId: accept numeric id or role name string
  let resolvedRoleId: number;

  if (roleId === undefined || roleId === null) {
    // Default to viewer
    const viewerRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, "viewer"))
      .limit(1);
    if (!viewerRole[0]) {
      res.status(500).json({ error: "Default role not found" });
      return;
    }
    resolvedRoleId = viewerRole[0].id;
  } else if (typeof roleId === "number") {
    resolvedRoleId = roleId;
  } else {
    // roleId is a string role name
    const foundRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, roleId as RoleName))
      .limit(1);
    if (!foundRole[0]) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }
    resolvedRoleId = foundRole[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [newUser] = await db
    .insert(users)
    .values({ email, passwordHash, fullName, roleId: resolvedRoleId })
    .returning({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      roleId: users.roleId,
    });

  // Fetch the role name to include in response
  const roleResult = await db
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(eq(roles.id, resolvedRoleId))
    .limit(1);

  res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    fullName: newUser.fullName,
    role: roleResult[0] ?? { id: resolvedRoleId, name: "viewer" },
  });
}));

router.post("/login", validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>;

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      roleId: users.roleId,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      role: {
        id: roles.id,
        name: roles.name,
        permissions: roles.permissions,
        createdAt: roles.createdAt,
      },
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(users.email, email))
    .limit(1);

  const user = result[0];
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, roleId: user.roleId });
  const refreshToken = signRefreshToken({ userId: user.id });

  // Store refresh token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokens).values({ userId: user.id, token: refreshToken, expiresAt });

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl ?? null,
      roleId: user.roleId,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt?.toISOString() ?? "",
      role: {
        ...user.role,
        name: user.role.name as Role["name"],
        permissions: user.role.permissions as Role["permissions"],
        createdAt: user.role.createdAt?.toISOString() ?? "",
      },
    },
  });
}));

router.post("/refresh", validate(refreshSchema), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body as z.infer<typeof refreshSchema>;

  try {
    const payload = verifyRefreshToken(refreshToken);

    // Check token in DB
    const stored = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.userId, payload.userId),
          gt(refreshTokens.expiresAt, new Date())
        )
      )
      .limit(1);

    if (!stored[0]) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Get user role for new access token
    const userResult = await db
      .select({ roleId: users.roleId })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!userResult[0]) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const newAccessToken = signAccessToken({
      userId: payload.userId,
      roleId: userResult[0].roleId,
    });

    res.json({ accessToken: newAccessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
}));

router.post("/logout", requireAuth as any, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));
  }
  res.json({ message: "Logged out" });
}));

router.get("/me", requireAuth as any, (req, res) => {
  const { user } = req as AuthenticatedRequest;
  res.json({ user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/change-password", requireAuth as any, validate(changePasswordSchema), asyncHandler(async (req, res) => {
  const { user } = req as AuthenticatedRequest;
  const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

  const result = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!result[0]) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, result[0].passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

  res.json({ message: "Password updated successfully" });
}));

export default router;
