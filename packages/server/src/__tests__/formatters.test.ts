import { describe, it, expect, beforeEach } from "vitest";

// Unit tests for utility functions that don't require DB

describe("JWT utilities", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test_jwt";
    process.env.REFRESH_SECRET = "test_refresh_secret_for_unit_tests_min";
  });

  it("signs and verifies access token", async () => {
    const { signAccessToken, verifyAccessToken } = await import("../utils/jwt");
    const payload = { userId: "test-user-id", roleId: 1 };
    const token = signAccessToken(payload);
    expect(token).toBeTruthy();
    expect(token.split(".")).toHaveLength(3); // JWT format

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.roleId).toBe(payload.roleId);
  });

  it("signs and verifies refresh token", async () => {
    const { signRefreshToken, verifyRefreshToken } = await import("../utils/jwt");
    const payload = { userId: "user-123" };
    const token = signRefreshToken(payload);
    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
  });

  it("throws on invalid token", async () => {
    const { verifyAccessToken } = await import("../utils/jwt");
    expect(() => verifyAccessToken("invalid.token.here")).toThrow();
  });
});

describe("RBAC permission checks", () => {
  it("admin has all permissions via wildcard", () => {
    const adminPermissions = ["*"];
    const check = (perms: string[], required: string) =>
      perms.includes("*") || perms.includes(required);

    expect(check(adminPermissions, "metrics:read")).toBe(true);
    expect(check(adminPermissions, "users:manage")).toBe(true);
    expect(check(adminPermissions, "reports:export")).toBe(true);
  });

  it("viewer only has read permissions", () => {
    const viewerPermissions = ["metrics:read", "reports:read"];
    const check = (perms: string[], required: string) =>
      perms.includes("*") || perms.includes(required);

    expect(check(viewerPermissions, "metrics:read")).toBe(true);
    expect(check(viewerPermissions, "reports:read")).toBe(true);
    expect(check(viewerPermissions, "users:manage")).toBe(false);
    expect(check(viewerPermissions, "reports:export")).toBe(false);
  });

  it("manager has correct permissions", () => {
    const managerPermissions = [
      "metrics:read",
      "reports:read",
      "reports:write",
      "reports:export",
      "users:read",
    ];
    const check = (perms: string[], required: string) =>
      perms.includes("*") || perms.includes(required);

    expect(check(managerPermissions, "metrics:read")).toBe(true);
    expect(check(managerPermissions, "reports:export")).toBe(true);
    expect(check(managerPermissions, "users:read")).toBe(true);
    expect(check(managerPermissions, "users:manage")).toBe(false);
  });
});
