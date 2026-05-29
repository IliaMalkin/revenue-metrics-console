import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import "dotenv/config";
import { db } from "./client";
import {
  roles,
  users,
  customers,
  transactions,
  events,
} from "./schema";
import type { Permission } from "@dashboard/shared";

// date-fns helpers (inline to avoid import issues)
function subM(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}
function addD(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomFloat(min: number, max: number): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}
function weightedRandom<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item.value;
  }
  return items[items.length - 1].value;
}

async function seed() {
  console.log("Seeding database...");
  const now = new Date();

  // 1. Roles
  console.log("Creating roles...");
  const [adminRole, managerRole, viewerRole] = await db
    .insert(roles)
    .values([
      { name: "admin", permissions: ["*"] as Permission[] },
      {
        name: "manager",
        permissions: [
          "metrics:read",
          "reports:read",
          "reports:write",
          "reports:export",
          "users:read",
        ] as Permission[],
      },
      {
        name: "viewer",
        permissions: ["metrics:read", "reports:read"] as Permission[],
      },
    ])
    .returning();

  // 2. Users (demo accounts)
  console.log("Creating demo users...");
  const passwordHash = await bcrypt.hash("demo123", 10);
  await db.insert(users).values([
    {
      email: "admin@demo.com",
      passwordHash,
      fullName: "Admin User",
      roleId: adminRole.id,
    },
    {
      email: "manager@demo.com",
      passwordHash,
      fullName: "Manager User",
      roleId: managerRole.id,
    },
    {
      email: "viewer@demo.com",
      passwordHash,
      fullName: "Viewer User",
      roleId: viewerRole.id,
    },
  ]);

  // 3. Customers (500+)
  console.log("Creating customers...");
  const PLAN_CONFIG = [
    { plan: "starter", weight: 0.5, mrrMin: 29, mrrMax: 49 },
    { plan: "growth", weight: 0.35, mrrMin: 99, mrrMax: 199 },
    { plan: "enterprise", weight: 0.15, mrrMin: 499, mrrMax: 999 },
  ];

  const COUNTRIES = ["US", "GB", "DE", "FR", "CA", "AU", "NL", "SE", "ES", "IT"];
  const COUNTRY_WEIGHTS = [0.4, 0.12, 0.1, 0.08, 0.08, 0.06, 0.05, 0.04, 0.04, 0.03];

  const customerData: typeof customers.$inferInsert[] = [];
  const startDate = subM(now, 18);

  for (let i = 0; i < 600; i++) {
    const planCfg = weightedRandom(
      PLAN_CONFIG.map((p) => ({ value: p, weight: p.weight }))
    );
    const signedUpAt = new Date(
      startDate.getTime() + Math.random() * (now.getTime() - startDate.getTime())
    );

    // ~15% churn rate
    const isChurned = Math.random() < 0.15;
    const isTrial = !isChurned && Math.random() < 0.08;

    const country = weightedRandom(
      COUNTRIES.map((c, idx) => ({ value: c, weight: COUNTRY_WEIGHTS[idx] }))
    );

    customerData.push({
      name: faker.company.name(),
      email: faker.internet.email().toLowerCase(),
      plan: planCfg.plan,
      mrr: String(randomFloat(planCfg.mrrMin, planCfg.mrrMax)),
      status: isChurned ? "churned" : isTrial ? "trial" : "active",
      signedUpAt,
      churnedAt: isChurned ? addD(signedUpAt, randomBetween(30, 365)) : null,
      country,
    });
  }

  const insertedCustomers = await db
    .insert(customers)
    .values(customerData)
    .returning();

  // 4. Transactions (5000+)
  console.log("Creating transactions...");
  const transactionData: typeof transactions.$inferInsert[] = [];

  for (const customer of insertedCustomers) {
    const numTransactions = randomBetween(3, 20);
    for (let i = 0; i < numTransactions; i++) {
      const type = weightedRandom([
        { value: "payment" as const, weight: 0.8 },
        { value: "upgrade" as const, weight: 0.08 },
        { value: "downgrade" as const, weight: 0.06 },
        { value: "refund" as const, weight: 0.06 },
      ]);

      const mrrNum = parseFloat(String(customer.mrr));
      let amount: number;
      if (type === "payment") amount = mrrNum;
      else if (type === "upgrade") amount = randomFloat(mrrNum * 0.5, mrrNum * 2);
      else if (type === "downgrade") amount = -randomFloat(mrrNum * 0.2, mrrNum * 0.5);
      else amount = -randomFloat(mrrNum * 0.1, mrrNum);

      const createdAt = new Date(
        customer.signedUpAt.getTime() +
          Math.random() * (now.getTime() - customer.signedUpAt.getTime())
      );

      transactionData.push({
        customerId: customer.id,
        type,
        amount: String(Math.abs(amount).toFixed(2)),
        currency: "USD",
        createdAt,
      });
    }
  }

  // Insert in batches
  for (let i = 0; i < transactionData.length; i += 500) {
    await db.insert(transactions).values(transactionData.slice(i, i + 500));
  }

  // 5. Events (20000+)
  console.log("Creating events...");
  const EVENT_TYPES = [
    "signup",
    "login",
    "feature_use",
    "upgrade",
    "support_ticket",
    "export",
    "api_call",
    "settings_change",
  ];

  const eventData: typeof events.$inferInsert[] = [];

  for (const customer of insertedCustomers) {
    const numEvents = randomBetween(15, 60);
    for (let i = 0; i < numEvents; i++) {
      const eventType = EVENT_TYPES[randomBetween(0, EVENT_TYPES.length - 1)];
      const createdAt = new Date(
        customer.signedUpAt.getTime() +
          Math.random() * (now.getTime() - customer.signedUpAt.getTime())
      );

      eventData.push({
        customerId: customer.id,
        eventType,
        metadata: { source: faker.helpers.arrayElement(["web", "api", "mobile"]) },
        createdAt,
      });
    }
  }

  for (let i = 0; i < eventData.length; i += 1000) {
    await db.insert(events).values(eventData.slice(i, i + 1000));
  }

  console.log(`Seed complete!`);
  console.log(`  Roles: 3`);
  console.log(`  Users: 3 (demo accounts)`);
  console.log(`  Customers: ${insertedCustomers.length}`);
  console.log(`  Transactions: ${transactionData.length}`);
  console.log(`  Events: ${eventData.length}`);
  console.log(``);
  console.log(`Demo accounts:`);
  console.log(`  admin@demo.com   / demo123`);
  console.log(`  manager@demo.com / demo123`);
  console.log(`  viewer@demo.com  / demo123`);

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
