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
export type RecipientVerificationStatus = "verified" | "tampered" | "review_required";

const STATUS_RANK: Record<SealStatus, number> = {
  UNASSIGNED: 0,
  ASSIGNED: 1,
  SEALED: 2,
  IN_TRANSIT: 3,
  DELIVERED_CLOSED: 4,
  DELIVERED_OPENED: 5,
  QUARANTINED: 6,
  VOIDED: 7,
};

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

export function resolveSealStatusForScan(
  currentStatus: SealStatus | string | null | undefined,
  context: SecureDeliveryScanContext,
  ttRaw: string | null | undefined
): SealStatus {
  const nextStatus = nextSealStatusForScan(context, ttRaw);
  const current = String(currentStatus || "UNASSIGNED").toUpperCase() as SealStatus;
  const currentRank = STATUS_RANK[current] ?? STATUS_RANK.UNASSIGNED;
  const nextRank = STATUS_RANK[nextStatus];

  if (current === "VOIDED") return "VOIDED";
  return nextRank >= currentRank ? nextStatus : current;
}

export function recipientVerificationStatusForSealStatus(status: SealStatus | string | null | undefined): RecipientVerificationStatus {
  if (status === "DELIVERED_CLOSED") return "verified";
  if (status === "DELIVERED_OPENED") return "tampered";
  return "review_required";
}

export function shouldCreateDeliveryClaimForStatus(status: SealStatus | string | null | undefined) {
  return status === "DELIVERED_OPENED" || status === "QUARANTINED";
}
