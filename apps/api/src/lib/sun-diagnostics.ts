import { sql } from './db';
import { verifySunFreshHandoffToken } from './sun-fresh-handoff';

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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function uniqueStrings(value: unknown, extra: string[] = []) {
  const items = Array.isArray(value) ? value : [];
  return Array.from(new Set([...items.filter((item): item is string => typeof item === "string" && item.trim().length > 0), ...extra]));
}

function cloneRecord(value: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value || {})) as Record<string, unknown>;
  } catch {
    return { ...asRecord(value) };
  }
}

function markHistoricalSnapshotContract(input: unknown, snapshot: { id: number; traceId: string; createdAt: string | null }) {
  const contract = cloneRecord(input);
  const tapSecurity = asRecord(contract.tapSecurity);
  contract.tapSecurity = {
    ...tapSecurity,
    snapshot: true,
    freshTap: false,
    actionability: "view_only",
    policy: "snapshot_view_only",
    tokenizationEligible: false,
    requiresFreshTapForCommercialActions: true,
    reason: "historical_snapshot_requires_fresh_tap",
  };
  contract.snapshot = {
    mode: "historical",
    diagnosticId: snapshot.id,
    traceId: snapshot.traceId,
    createdAt: snapshot.createdAt,
    requiresFreshTap: true,
    commercialActions: "blocked_until_new_physical_tap",
  };
  contract.allowedActions = uniqueStrings(contract.allowedActions).filter((action) => action === "provenance" || action === "report");
  contract.blockedActions = uniqueStrings(contract.blockedActions, ["claim", "save", "join", "warranty", "rewards", "tokenization"]);

  const status = asRecord(contract.status);
  const summary = String(status.summary || "Autenticidad visible en modo consulta.");
  contract.status = {
    ...status,
    snapshot: true,
    actionability: "view_only",
    reason: status.reason || "historical_snapshot",
    summary: `${summary} Vista historica: ownership, club, rewards y tokenizacion requieren un nuevo tap fisico.`,
  };

  const tokenization = asRecord(contract.tokenization);
  contract.tokenization = {
    ...tokenization,
    status: String(tokenization.status || "").startsWith("minted") ? tokenization.status : "blocked_snapshot",
  };

  const troubleshooting = uniqueStrings(contract.troubleshooting, [
    "Vista historica: no usar este snapshot para ownership, rewards, garantia o tokenizacion. Escanea fisicamente la etiqueta para generar un tap fresco.",
  ]);
  contract.troubleshooting = troubleshooting;
  return contract;
}

function markFreshHandoffContract(input: unknown, snapshot: { id: number; traceId: string; createdAt: string | null; expiresAt: string | null }) {
  const contract = cloneRecord(input);
  const tapSecurity = asRecord(contract.tapSecurity);
  contract.tapSecurity = {
    ...tapSecurity,
    snapshot: true,
    freshTap: true,
    actionability: "fresh_handoff",
    requiresFreshTapForCommercialActions: false,
    reason: tapSecurity.reason || "fresh_nfc_handoff",
  };
  contract.snapshot = {
    mode: "fresh_handoff",
    diagnosticId: snapshot.id,
    traceId: snapshot.traceId,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    requiresFreshTap: false,
    commercialActions: "allowed_while_handoff_is_fresh",
  };

  const status = asRecord(contract.status);
  contract.status = {
    ...status,
    snapshot: true,
    actionability: "fresh_handoff",
    reason: status.reason || "fresh_nfc_handoff",
  };
  return contract;
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

export async function getSunDiagnosticSnapshot(id: string | number, traceId: string, freshToken?: string | null) {
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
  const diagnosticId = Number(row.id || numericId);
  const traceIdValue = row.trace_id || trace;
  const createdAt = row.created_at || null;
  const contract = result.contract as Record<string, unknown>;
  const identity = asRecord(contract.identity);
  const tokenizationEventId = String(contract.eventId || identity.eventId || "").trim();
  const bid = String(identity.bid || contract.bid || "").trim();
  const fresh = verifySunFreshHandoffToken(freshToken, {
    bid: bid || undefined,
    eventId: tokenizationEventId || undefined,
    diagnosticId,
    traceId: traceIdValue,
  });
  const freshExpiresAt = fresh.ok ? new Date(fresh.payload.exp * 1000).toISOString() : null;
  return {
    ok: true,
    diagnostic_id: diagnosticId,
    trace_id: traceIdValue,
    created_at: createdAt,
    snapshot_access: fresh.ok ? "fresh_handoff" : "historical",
    contract: fresh.ok
      ? markFreshHandoffContract(result.contract, { id: diagnosticId, traceId: traceIdValue, createdAt, expiresAt: freshExpiresAt })
      : markHistoricalSnapshotContract(result.contract, { id: diagnosticId, traceId: traceIdValue, createdAt }),
  };
}
