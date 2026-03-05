import type { DashboardRole } from "../i18n/types";

export const roleAccess: Record<DashboardRole, Array<"overview" | "tenants" | "batches" | "tags" | "analytics" | "events" | "resellers" | "subscriptions" | "apiKeys">> = {
  "super-admin": ["overview", "tenants", "batches", "tags", "analytics", "events", "resellers", "subscriptions", "apiKeys"],
  "tenant-admin": ["overview", "batches", "tags", "analytics", "events", "subscriptions", "apiKeys"],
  reseller: ["overview", "batches", "analytics", "events", "resellers", "subscriptions"],
  viewer: ["overview", "analytics", "events"],
};
