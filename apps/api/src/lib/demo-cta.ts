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
