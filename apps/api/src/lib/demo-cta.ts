import { sql } from "./db";

export async function ensureDemoCtaTable() {
  await sql`CREATE TABLE IF NOT EXISTS demo_cta_actions (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    bid TEXT NOT NULL,
    uid_hex TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

export async function recordDemoCta(action: string, bid: string, uid: string, payload: Record<string, unknown>) {
  await ensureDemoCtaTable();
  const rows = await sql`INSERT INTO demo_cta_actions (action, bid, uid_hex, payload) VALUES (${action}, ${bid}, ${uid.toUpperCase()}, ${JSON.stringify(payload)}::jsonb) RETURNING id, created_at`;
  return rows[0];
}

export async function listDemoCta(bid: string, uid: string) {
  await ensureDemoCtaTable();
  return sql`SELECT action, payload, created_at FROM demo_cta_actions WHERE bid = ${bid} AND uid_hex = ${uid.toUpperCase()} ORDER BY created_at DESC LIMIT 50`;
}

export function buildLifecycleState(bid: string, uid: string, actions: Array<Record<string, unknown>>) {
  const normalized = actions.map((entry) => ({
    action: String(entry.action || ""),
    payload: (entry.payload && typeof entry.payload === "object" ? entry.payload : {}) as Record<string, unknown>,
    created_at: String(entry.created_at || ""),
  }));
  const newestFirst = [...normalized];
  const oldestFirst = [...normalized].reverse();
  const ownershipAction = newestFirst.find((entry) => entry.action === "claim_ownership");
  const warrantyAction = newestFirst.find((entry) => ["warranty_review_requested", "register_warranty"].includes(entry.action));
  const problemReportAction = newestFirst.find((entry) => ["problem_report_request", "report_problem"].includes(entry.action));
  const tokenAction = newestFirst.find((entry) => entry.action === "tokenize_request");

  const ownership = {
    ownership_status: "unavailable_from_demo_log",
    claimed_at: null,
    claim_request_recorded: Boolean(ownershipAction),
    claim_request_at: ownershipAction?.created_at || null,
    claim_source: ownershipAction ? "legacy_demo_action_log" : null,
    issuer: null,
    owner_reference: null,
    claim_evidence: null,
    transfer_capability: "not_available_from_demo_log",
    revocation_capability: "not_available_from_demo_log",
  };

  const ledger = {
    ledger_status: "unavailable_from_demo_log",
    request_recorded: Boolean(tokenAction),
    request_recorded_at: tokenAction?.created_at || null,
    ledger_network: null,
    ledger_ref: null,
    asset_ref: tokenAction ? String((tokenAction.payload?.asset_ref as string) || `${bid}:${uid}`) : null,
    anchor_hash: null,
    issuer_wallet: null,
    last_anchor_at: null,
  };

  const timeline = [
    { stage: "batch_created", status: "unavailable_from_demo_log", at: null },
    { stage: "manifest_imported", status: "unavailable_from_demo_log", at: null },
    { stage: "activated", status: "unavailable_from_demo_log", at: null },
    { stage: "nfc_message_validation", status: "unavailable_from_demo_log", at: null },
    { stage: "tt_or_tamper_signal", status: "unavailable_from_demo_log", at: null },
    ...oldestFirst.map((entry) => ({
      stage: entry.action,
      status: ["warranty_review_requested", "register_warranty", "problem_report_request", "report_problem"].includes(entry.action)
        ? "pending_review"
        : "recorded",
      at: entry.created_at,
    })),
    { stage: "ownership_request", status: ownershipAction ? "request_recorded" : "not_requested", at: ownershipAction?.created_at || null },
    { stage: "warranty_request_recorded", status: warrantyAction ? "pending_review" : "not_requested", at: warrantyAction?.created_at || null },
    { stage: "support_ticket", status: problemReportAction ? "not_created_request_pending_review" : "not_requested", at: null },
    { stage: "resale_or_transfer", status: "pending", at: null },
    { stage: "tokenization_requested", status: tokenAction ? "recorded" : "pending", at: tokenAction?.created_at || null },
    { stage: "ledger_final_state", status: "unavailable_from_demo_log", at: null },
  ];

  return { ownership, ledger, timeline };
}
