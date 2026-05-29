import { db } from "../db/client";
import { customers } from "../db/schema";
import { and, gte, lte, inArray, eq, sql, count } from "drizzle-orm";
import type { MetricFilters } from "@dashboard/shared";

export function buildCustomerFilter(filters: MetricFilters) {
  const conditions = [];
  if (filters.plans?.length) {
    conditions.push(inArray(customers.plan, filters.plans));
  }
  if (filters.countries?.length) {
    conditions.push(inArray(customers.country, filters.countries));
  }
  return conditions.length ? and(...conditions) : undefined;
}

export function buildDateFilter(
  table: { createdAt: ReturnType<typeof sql> },
  dateFrom?: string,
  dateTo?: string
) {
  const conditions = [];
  if (dateFrom) conditions.push(gte(table.createdAt as any, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(table.createdAt as any, new Date(dateTo)));
  return conditions.length ? and(...conditions) : undefined;
}

export async function computeMRR(filters: MetricFilters): Promise<number> {
  const conditions = [eq(customers.status, "active")];
  if (filters.plans?.length) {
    conditions.push(inArray(customers.plan, filters.plans));
  }
  if (filters.countries?.length) {
    conditions.push(inArray(customers.country, filters.countries));
  }

  const result = await db
    .select({ total: sql<string>`coalesce(sum(${customers.mrr}::numeric), 0)` })
    .from(customers)
    .where(and(...conditions));

  return parseFloat(result[0]?.total ?? "0");
}

export async function computeActiveUsers(filters: MetricFilters): Promise<number> {
  const conditions = [eq(customers.status, "active")];
  if (filters.plans?.length) {
    conditions.push(inArray(customers.plan, filters.plans));
  }
  if (filters.countries?.length) {
    conditions.push(inArray(customers.country, filters.countries));
  }

  const result = await db
    .select({ total: count() })
    .from(customers)
    .where(and(...conditions));

  return result[0]?.total ?? 0;
}

export async function computeChurnRate(filters: MetricFilters): Promise<number> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (filters.plans?.length) {
    conditions.push(inArray(customers.plan, filters.plans) as any);
  }
  if (filters.countries?.length) {
    conditions.push(inArray(customers.country, filters.countries) as any);
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(customers)
    .where(whereClause);

  const [{ churned }] = await db
    .select({ churned: count() })
    .from(customers)
    .where(and(eq(customers.status, "churned"), whereClause));

  if (!total) return 0;
  return parseFloat(((churned / total) * 100).toFixed(2));
}
