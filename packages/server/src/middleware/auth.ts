import type { Request, Response, NextFunction, RequestHandler } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { db } from "../db/client";
import { users, roles } from "../db/schema";
import { eq } from "drizzle-orm";
import type { User, Role } from "@dashboard/shared";

export interface AuthenticatedRequest extends Request {
  user: User;
}

export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

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
        role: {
          id: roles.id,
          name: roles.name,
          permissions: roles.permissions,
          createdAt: roles.createdAt,
        },
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = result[0];
    if (!user || !user.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }

    (req as AuthenticatedRequest).user = {
      ...user,
      isActive: user.isActive ?? true,
      avatarUrl: user.avatarUrl ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt?.toISOString() ?? "",
      role: {
        ...user.role,
        createdAt: user.role.createdAt?.toISOString() ?? "",
        permissions: user.role.permissions as Role["permissions"],
        name: user.role.name as Role["name"],
      },
    };
    next();
  } catch {
    res.status(401).json({ error: "Token expired or invalid" });
  }
}
