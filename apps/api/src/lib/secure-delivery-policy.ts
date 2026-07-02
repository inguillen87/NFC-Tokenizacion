export type SealStatus =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "SEALED"
  | "IN_TRANSIT"
  | "DELIVERED_CLOSED"
  | "DELIVERED_OPENED"
  | "QUARANTINED"
  | "VOIDED";

export type SecureDeliveryScanContext = "APPLY" | "HANDOFF" | "VERIFY";
export type TamperState = "closed" | "opened" | "unknown";

export function classifyTamperState(ttRaw: string | null | undefined): TamperState {
  const normalized = String(ttRaw || "").trim().toUpperCase();
  if (normalized === "4343") return "closed";
  if (normalized === "4F4F" || normalized === "4F43" || normalized === "4949") return "opened";
  return "unknown";
}

export function nextSealStatusForScan(context: SecureDeliveryScanContext, ttRaw: string | null | undefined): SealStatus {
  const tamperState = classifyTamperState(ttRaw);
  if (tamperState !== "closed") {
    return context === "VERIFY" && tamperState === "opened" ? "DELIVERED_OPENED" : "QUARANTINED";
  }
  if (context === "APPLY") return "SEALED";
  if (context === "HANDOFF") return "IN_TRANSIT";
  return "DELIVERED_CLOSED";
}
