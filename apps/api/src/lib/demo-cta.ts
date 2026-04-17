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
  const warrantyAction = newestFirst.find((entry) => entry.action === "register_warranty");
  const tokenAction = newestFirst.find((entry) => entry.action === "tokenize_request");

  const ownership = {
    ownership_status: ownershipAction ? "claimed" : "unclaimed",
    claimed_at: ownershipAction?.created_at || null,
    claim_source: ownershipAction ? String((ownershipAction.payload?.source as string) || "public_cta") : null,
    issuer: ownershipAction ? String((ownershipAction.payload?.issuer as string) || "nexID") : null,
    owner_reference: ownershipAction ? String((ownershipAction.payload?.owner_reference as string) || "consumer") : null,
    claim_evidence: ownershipAction ? String((ownershipAction.payload?.claim_evidence as string) || "sun_validation") : null,
    transfer_capability: "state-only",
    revocation_capability: "issuer-review",
  };

  const ledger = {
    ledger_status: tokenAction ? String((tokenAction.payload?.ledger_status as string) || "simulated") : "off",
    ledger_network: tokenAction ? String((tokenAction.payload?.ledger_network as string) || "not_selected") : "not_selected",
    ledger_ref: tokenAction ? String((tokenAction.payload?.ledger_ref as string) || "") || null : null,
    asset_ref: tokenAction ? String((tokenAction.payload?.asset_ref as string) || `${bid}:${uid}`) : null,
    anchor_hash: tokenAction ? String((tokenAction.payload?.anchor_hash as string) || "") || null : null,
    issuer_wallet: tokenAction ? String((tokenAction.payload?.issuer_wallet as string) || "") || null : null,
    last_anchor_at: tokenAction ? String((tokenAction.payload?.last_anchor_at as string) || "") || null : null,
  };

  const timeline = [
    { stage: "batch_created", status: "known", at: null },
    { stage: "manifest_imported", status: "known", at: null },
    { stage: "activated", status: "known", at: null },
    { stage: "validated", status: "known", at: null },
    { stage: "opened_or_tamper", status: "known", at: null },
    ...oldestFirst.map((entry) => ({ stage: entry.action, status: "recorded", at: entry.created_at })),
    { stage: "ownership_claimed", status: ownershipAction ? "recorded" : "pending", at: ownershipAction?.created_at || null },
    { stage: "warranty_registered", status: warrantyAction ? "recorded" : "pending", at: warrantyAction?.created_at || null },
    { stage: "resale_or_transfer", status: "pending", at: null },
    { stage: "tokenization_requested", status: tokenAction ? "recorded" : "pending", at: tokenAction?.created_at || null },
    { stage: "ledger_anchored", status: ledger.ledger_status === "anchored" ? "recorded" : "pending", at: ledger.last_anchor_at || null },
  ];

  return { ownership, ledger, timeline };
}
