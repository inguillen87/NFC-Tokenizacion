export type UserRole = "super-admin" | "tenant-admin" | "reseller" | "viewer";

export type ScanResult = "VALID" | "INVALID" | "NOT_REGISTERED" | "NOT_ACTIVE" | "REPLAY_SUSPECT";

export type MetricCard = {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "good" | "warn" | "danger";
};
