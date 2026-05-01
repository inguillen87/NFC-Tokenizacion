import { sql } from './db';

export type SunDiagnosticTool = 'sun_scan' | 'inspect' | 'compare_tamper' | 'compare_tamper_samples';

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  await sql/*sql*/`
    CREATE TABLE IF NOT EXISTS sun_diagnostics (
      id bigserial PRIMARY KEY,
      trace_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      tool_type text NOT NULL,
      bid text,
      uid_hex text,
      uid_masked text,
      read_counter integer,
      auth_status text,
      replay_status text,
      product_state text,
      tamper_status text,
      tamper_signal text,
      tamper_opened boolean,
      tamper_risk boolean,
      tagtamper_config_detected boolean,
      enc_plain_status_byte text,
      closed_url text,
      opened_url text,
      request_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
      notes jsonb NOT NULL DEFAULT '[]'::jsonb
    )
  `;
  ensured = true;
}

export async function insertSunDiagnostic(input: {
  trace_id?: string | null;
  tool_type: SunDiagnosticTool;
  bid?: string | null;
  uid_hex?: string | null;
  uid_masked?: string | null;
  read_counter?: number | null;
  auth_status?: string | null;
  replay_status?: string | null;
  product_state?: string | null;
  tamper_status?: string | null;
  tamper_signal?: string | null;
  tamper_opened?: boolean | null;
  tamper_risk?: boolean | null;
  tagtamper_config_detected?: boolean | null;
  enc_plain_status_byte?: string | null;
  closed_url?: string | null;
  opened_url?: string | null;
  request_json?: unknown;
  result_json?: unknown;
  notes?: unknown;
}) {
  try {
    await ensureTable();
    const rows = await sql/*sql*/`
      INSERT INTO sun_diagnostics (
        trace_id, tool_type, bid, uid_hex, uid_masked, read_counter, auth_status, replay_status,
        product_state, tamper_status, tamper_signal, tamper_opened, tamper_risk,
        tagtamper_config_detected, enc_plain_status_byte, closed_url, opened_url,
        request_json, result_json, notes
      ) VALUES (
        ${input.trace_id || null}, ${input.tool_type}, ${input.bid || null}, ${input.uid_hex || null}, ${input.uid_masked || null}, ${input.read_counter ?? null}, ${input.auth_status || null}, ${input.replay_status || null},
        ${input.product_state || null}, ${input.tamper_status || null}, ${input.tamper_signal || null}, ${typeof input.tamper_opened === 'boolean' ? input.tamper_opened : null}, ${typeof input.tamper_risk === 'boolean' ? input.tamper_risk : null},
        ${typeof input.tagtamper_config_detected === 'boolean' ? input.tagtamper_config_detected : null}, ${input.enc_plain_status_byte || null}, ${input.closed_url || null}, ${input.opened_url || null},
        ${JSON.stringify(input.request_json || {})}::jsonb, ${JSON.stringify(input.result_json || {})}::jsonb, ${JSON.stringify(input.notes || [])}::jsonb
      )
      RETURNING id
    `;
    return Number(rows?.[0]?.id || 0) || null;
  } catch {
    return null;
  }
}

export async function listSunDiagnostics(limit = 100) {
  await ensureTable();
  return sql/*sql*/`
    SELECT *
    FROM sun_diagnostics
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `;
}

export async function getSunDiagnosticSnapshot(id: string | number, traceId: string) {
  const numericId = Number(id);
  const trace = String(traceId || "").trim();
  if (!Number.isFinite(numericId) || numericId <= 0 || !trace) return null;

  await ensureTable();
  const rows = await sql/*sql*/`
    SELECT id, trace_id, created_at::text AS created_at, result_json
    FROM sun_diagnostics
    WHERE id = ${numericId}
      AND trace_id = ${trace}
      AND tool_type = 'sun_scan'
    LIMIT 1
  `;
  const row = rows[0] as { id?: number; trace_id?: string | null; created_at?: string | null; result_json?: unknown } | undefined;
  if (!row || !row.result_json || typeof row.result_json !== "object") return null;
  const result = row.result_json as { contract?: unknown };
  if (!result.contract || typeof result.contract !== "object") return null;
  return {
    ok: true,
    diagnostic_id: Number(row.id || numericId),
    trace_id: row.trace_id || trace,
    created_at: row.created_at || null,
    contract: result.contract,
  };
}
