import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock DB
vi.mock("../db/client", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue("$2b$10$hashedpassword"),
  },
}));

beforeEach(() => {
  process.env.JWT_SECRET = "test_jwt";
  process.env.REFRESH_SECRET = "test_refresh_secret_for_unit_tests_min";
});

describe("Auth API", () => {
  it("login returns 400 for missing body", async () => {
    const app = express();
    app.use(express.json());
    const { default: authRouter } = await import("../routes/auth");
    app.use("/api/auth", authRouter);

    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("login returns 400 for invalid email", async () => {
    const app = express();
    app.use(express.json());
    const { default: authRouter } = await import("../routes/auth");
    app.use("/api/auth", authRouter);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("login returns 401 when user not found", async () => {
    const { db } = await import("../db/client");
    (db as any).limit = vi.fn().mockResolvedValue([]);

    const app = express();
    app.use(express.json());
    const { default: authRouter } = await import("../routes/auth");
    app.use("/api/auth", authRouter);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" });
    expect(res.status).toBe(401);
  });
});

describe("validate middleware", () => {
  it("rejects requests with missing required fields", async () => {
    const { validate } = await import("../middleware/validate");
    const { z } = await import("zod");
    const schema = z.object({ name: z.string(), age: z.number() });

    const app = express();
    app.use(express.json());
    app.post("/test", validate(schema), (req, res) => {
      res.json({ ok: true });
    });

    const res = await request(app).post("/test").send({ name: "test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation error");
  });

  it("passes valid requests through", async () => {
    const { validate } = await import("../middleware/validate");
    const { z } = await import("zod");
    const schema = z.object({ name: z.string() });

    const app = express();
    app.use(express.json());
    app.post("/test", validate(schema), (req, res) => {
      res.json({ ok: true, name: req.body.name });
    });

    const res = await request(app).post("/test").send({ name: "Alice" });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
