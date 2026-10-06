import { createHash } from "node:crypto";
import type { SqlExecutor } from "./db";
import { SUN_VERTICALS } from "./sun-tenant-profile";

export const CUSTOMER_ACTIONS = ["lead", "feedback", "sommelier", "marketplace"] as const;
export const ACTIONS_VERSION = "nexid.tenant-actions.v1";
export const QUIZ_MANAGER = "nexid.tenant-loyalty.v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class ConfigurationError extends Error {
  constructor(reason: string, public status = 400) { super(reason); }
}
export const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const invalid = (): never => { throw new ConfigurationError("configuration_invalid"); };
function text(v: unknown, max: number, required = false) {
  if (typeof v !== "string" || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)) return invalid();
  const s = v.trim(); if (required && !s) return invalid(); return s;
}
function integer(v: unknown, max: number, nullable = false): number | null {
  if (nullable && v === null) return null;
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= max ? v : invalid();
}
function date(v: unknown, nullable = false): string | null {
  if (nullable && v === null) return null;
  if (typeof v !== "string" || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T/.test(v) || !Number.isFinite(Date.parse(v))) return invalid();
  return new Date(v).toISOString();
}
export function parseConfigurationWrite(value: unknown) {
  const v = record(value);
  if (!["profile", "program", "quiz"].includes(String(v.kind)) || !["save_draft", "publish", "withdraw"].includes(String(v.action))) return invalid();
  const kind = v.kind as "profile" | "program" | "quiz", action = v.action as "save_draft" | "publish" | "withdraw";
  if (typeof v.operationId !== "string" || !UUID.test(v.operationId)) return invalid();
  if (kind !== "profile" && (typeof v.id !== "string" || !UUID.test(v.id))) return invalid();
  const revision = v.expectedRevision;
  if (revision !== null && (typeof revision !== "string" || revision.length > 64 || !/^\d{4}-\d{2}-\d{2}[ T].*(?:Z|[+-]\d{2}(?::\d{2})?)$/.test(revision) || !Number.isFinite(Date.parse(revision)))) return invalid();
  if (revision === null && action !== "save_draft") return invalid();
  const common = { kind, action, id: kind === "profile" ? null : String(v.id).toLowerCase(), expectedRevision: revision as string | null, operationId: v.operationId.toLowerCase() };
  if (action === "withdraw") return { ...common, fields: {} };
  const publish = action === "publish";
  if (kind === "profile") {
    if (!Array.isArray(v.allowedActions) || v.allowedActions.length > CUSTOMER_ACTIONS.length || v.allowedActions.some(a => !CUSTOMER_ACTIONS.includes(a)) || new Set(v.allowedActions).size !== v.allowedActions.length) return invalid();
    return { ...common, fields: { allowedActions: [...v.allowedActions].sort() } };
  }
  const vertical = text(v.vertical, 32, true); if (!(SUN_VERTICALS as readonly string[]).includes(vertical)) return invalid();
  if (kind === "program") {
    const startAt = date(v.startAt), endAt = date(v.endAt, true);
    if (endAt && startAt && Date.parse(endAt) < Date.parse(startAt)) return invalid();
    return { ...common, fields: {
      name: text(v.name, 120, publish), pointsName: text(v.pointsName, 60, publish), vertical, startAt, endAt,
      pointsPerValidTap: integer(v.pointsPerValidTap, 10_000, !publish), cooldownSeconds: integer(v.cooldownSeconds, 604800, !publish),
    } };
  }
  if (typeof v.programId !== "string" || !UUID.test(v.programId)) return invalid();
  if (!Array.isArray(v.questions) || v.questions.length > 12 || (publish && v.questions.length === 0)) return invalid();
  const questions = v.questions.map(raw => {
    const q = record(raw), id = text(q.id, 64, true), prompt = text(q.prompt, 500, publish);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || !Array.isArray(q.options) || q.options.length > 6 || (publish && q.options.length < 2)) return invalid();
    const options = q.options.map(o => text(o, 240, publish));
    const correctIndex = integer(q.correctIndex, 5);
    if (publish && (correctIndex! >= options.length || new Set(options).size !== options.length)) return invalid();
    return { id, prompt, options, correctIndex, explanation: text(q.explanation ?? "", 1000), insightTag: "tenant-configured" };
  });
  if (new Set(questions.map(q => q.id)).size !== questions.length) return invalid();
  const startsAt = date(v.startsAt), endsAt = date(v.endsAt, true);
  if (endsAt && startsAt && Date.parse(endsAt) < Date.parse(startsAt)) return invalid();
  const passThreshold = integer(v.passThreshold, 12)!; if (publish && passThreshold > questions.length) return invalid();
  if (publish && (integer(v.pointsPerCorrect, 1_000_000)! * questions.length + integer(v.completionBonus, 1_000_000)! > 1_000_000)) return invalid();
  return { ...common, fields: {
    programId: v.programId.toLowerCase(), title: text(v.title, 160, publish), description: text(v.description ?? "", 1000), vertical,
    startsAt, endsAt, questions, pointsPerCorrect: integer(v.pointsPerCorrect, 1_000_000), completionBonus: integer(v.completionBonus, 1_000_000), passThreshold,
  } };
}
export type ConfigurationWrite = ReturnType<typeof parseConfigurationWrite>;
type Tenant = { id: string; slug: string };
const revisionOf = (r: Record<string, unknown>) => String(r.revision);
function profileFromRow(r: Record<string, unknown>) {
  const p = record(record(r.metadata).postTap);
  return { revision: revisionOf(r), lastOperationId: record(record(r.metadata)._nexidConfigurationWrite).operationId ?? null, status: ["published", "paused"].includes(String(p.status)) && p.version === ACTIONS_VERSION ? p.status : "draft", allowedActions: Array.isArray(p.allowedActions) ? p.allowedActions.filter(a => CUSTOMER_ACTIONS.includes(a as typeof CUSTOMER_ACTIONS[number])) : [] };
}
function programFromRow(r: Record<string, unknown>) {
  const rules = record(r.rules_json);
  return { id: r.id, revision: revisionOf(r), lastOperationId: record(rules._nexidConfigurationWrite).operationId ?? null, name: r.name, vertical: r.vertical, status: r.status, pointsName: r.points_name,
    pointsPerValidTap: Number.isSafeInteger(rules.pointsPerValidTap) ? rules.pointsPerValidTap : null,
    cooldownSeconds: Number.isSafeInteger(rules.cooldownSeconds) ? rules.cooldownSeconds : null, startAt: r.start_at, endAt: r.end_at };
}
function quizFromRow(r: Record<string, unknown>) {
  return { id: r.id, revision: revisionOf(r), lastOperationId: record(record(r.product_filter_json)._nexidConfigurationWrite).operationId ?? null, programId: r.program_id, title: r.title, description: String(r.description ?? ""), vertical: r.vertical, status: r.status,
    startsAt: r.starts_at, endsAt: r.ends_at, questions: r.questions_json, pointsPerCorrect: r.points_per_correct, completionBonus: r.completion_bonus, passThreshold: r.pass_threshold,
    managed: record(r.product_filter_json).managedBy === QUIZ_MANAGER && record(r.product_filter_json).scope === "tenant" };
}
const projection = (kind: string, r: Record<string, unknown>) => kind === "profile" ? profileFromRow(r) : kind === "program" ? programFromRow(r) : quizFromRow(r);
export async function readConfiguration(tenant: Tenant, query: SqlExecutor) {
  const [profiles, programs, quizzes] = await Promise.all([
    query`SELECT *, updated_at::text AS revision FROM tenant_sun_profiles WHERE tenant_id = ${tenant.id}::uuid`,
    query`SELECT *, updated_at::text AS revision FROM loyalty_programs WHERE tenant_id = ${tenant.id}::uuid ORDER BY created_at DESC,id LIMIT 101`,
    query`SELECT *, updated_at::text AS revision FROM loyalty_quizzes WHERE tenant_id = ${tenant.id}::uuid ORDER BY created_at DESC,id LIMIT 301`,
  ]);
  if (profiles.length !== 1) throw new ConfigurationError("configuration_profile_required", 503);
  return { profile: profileFromRow(profiles[0]), programs: programs.slice(0,100).map(programFromRow), quizzes: quizzes.slice(0,300).map(quizFromRow),
    limits: { programs: 100, quizzes: 300, programsTruncated: programs.length > 100, quizzesTruncated: quizzes.length > 300 } };
}
async function readResource(tenant: Tenant, input: ConfigurationWrite, query: SqlExecutor) {
  return (input.kind === "profile" ? await query`SELECT *, updated_at::text AS revision FROM tenant_sun_profiles WHERE tenant_id = ${tenant.id}::uuid`
    : input.kind === "program" ? await query`SELECT *, updated_at::text AS revision FROM loyalty_programs WHERE tenant_id = ${tenant.id}::uuid AND id = ${input.id}::uuid`
    : await query`SELECT *, updated_at::text AS revision FROM loyalty_quizzes WHERE tenant_id = ${tenant.id}::uuid AND id = ${input.id}::uuid`)[0];
}
export async function writeConfiguration(tenant: Tenant, actorId: string, input: ConfigurationWrite, query: SqlExecutor) {
  if (!UUID.test(actorId)) throw new ConfigurationError("configuration_unavailable", 503);
  const fingerprint = createHash("sha256").update(JSON.stringify({ tenantId: tenant.id, actorId, ...input })).digest("hex");
  const marker = { operationId: input.operationId, fingerprint };
  const before = await readResource(tenant, input, query);
  const beforeJson = input.kind === "profile" ? record(before?.metadata) : input.kind === "program" ? record(before?.rules_json) : record(before?.product_filter_json);
  const operation = record(beforeJson._nexidConfigurationWrite);
  if (operation.operationId === input.operationId) {
    if (operation.fingerprint !== fingerprint) throw new ConfigurationError("configuration_idempotency_conflict", 409);
    return { resource: projection(input.kind, before), idempotentReplay: true };
  }
  if (before && revisionOf(before) !== input.expectedRevision || !before && input.expectedRevision !== null) throw new ConfigurationError("configuration_revision_conflict", 409);
  const active = input.kind === "profile" ? record(record(before?.metadata).postTap).status === "published" : before?.status === "active";
  if (active && input.action !== "withdraw") throw new ConfigurationError("configuration_active_edit", 409);
  if (!before && (input.kind === "profile" || input.action !== "save_draft")) throw new ConfigurationError("configuration_profile_required", 503);
  const fields = record(input.fields), patch = JSON.stringify({ _nexidConfigurationWrite: marker });
  const action = `tenant_${input.kind}_${input.action}`;
  let rows: Array<Record<string, unknown>>;
  if (input.kind === "profile") {
    const postTap = JSON.stringify({ version: ACTIONS_VERSION, status: input.action === "publish" ? "published" : input.action === "withdraw" ? "paused" : "draft", allowedActions: input.action === "withdraw" ? profileFromRow(before!).allowedActions : fields.allowedActions });
    rows = await query`
      WITH changed AS (
        UPDATE tenant_sun_profiles SET metadata = COALESCE(metadata, '{}'::jsonb) || ${patch}::jsonb || jsonb_build_object('postTap', ${postTap}::jsonb), updated_at = clock_timestamp()
        WHERE tenant_id = ${tenant.id}::uuid AND updated_at = ${input.expectedRevision}::timestamptz
          AND (${input.action} = 'withdraw' OR COALESCE(metadata #>> '{postTap,status}', '') <> 'published')
        RETURNING *, updated_at::text AS revision
      ), audited AS (
        INSERT INTO audit_logs(actor_id,tenant_id,action,resource_type,resource_id,after_hash)
        SELECT ${actorId}::uuid, tenant_id, ${action}, 'tenant_configuration', tenant_id::text, ${fingerprint} FROM changed RETURNING 1
      ) SELECT changed.*, (SELECT count(*) FROM audited) AS audit_count FROM changed`;
  } else if (input.kind === "program") {
    const rules = JSON.stringify({ ...record(input.action === "withdraw" ? beforeJson : { pointsPerValidTap: fields.pointsPerValidTap, cooldownSeconds: fields.cooldownSeconds }), _nexidConfigurationWrite: marker });
    const name = input.action === "withdraw" ? before?.name : fields.name, pointsName = input.action === "withdraw" ? before?.points_name : fields.pointsName;
    const vertical = input.action === "withdraw" ? before?.vertical : fields.vertical;
    const start = input.action === "withdraw" ? before?.start_at : fields.startAt, end = input.action === "withdraw" ? before?.end_at : fields.endAt;
    const status = input.action === "publish" ? "active" : input.action === "withdraw" ? "paused" : "draft";
    rows = await query`
      WITH locked AS MATERIALIZED (SELECT * FROM loyalty_programs WHERE tenant_id = ${tenant.id}::uuid ORDER BY id FOR UPDATE),
      eligible AS MATERIALIZED (
        SELECT id FROM locked WHERE id = ${input.id}::uuid AND updated_at = ${input.expectedRevision}::timestamptz
          AND (${input.action} = 'withdraw' OR status <> 'active')
          AND (${status} <> 'active' OR NOT EXISTS (SELECT 1 FROM locked other WHERE other.id <> ${input.id}::uuid AND other.status = 'active'
            AND other.start_at <= COALESCE(${end}::timestamptz,'infinity'::timestamptz) AND COALESCE(other.end_at,'infinity'::timestamptz) >= ${start}::timestamptz))
      ), changed AS (
        INSERT INTO loyalty_programs(id,tenant_id,name,vertical,status,mode,points_name,start_at,end_at,rules_json)
        SELECT ${input.id}::uuid, ${tenant.id}::uuid, ${name}, ${vertical}, ${status}::loyalty_program_status,'production',${pointsName},${start}::timestamptz,${end}::timestamptz,${rules}::jsonb
        WHERE (${input.expectedRevision}::text IS NULL AND ${status} = 'draft' AND NOT EXISTS (SELECT 1 FROM locked WHERE id = ${input.id}::uuid)) OR EXISTS(SELECT 1 FROM eligible)
        ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,vertical=EXCLUDED.vertical,status=EXCLUDED.status,points_name=EXCLUDED.points_name,
          start_at=CASE WHEN ${input.action}='withdraw' THEN loyalty_programs.start_at ELSE EXCLUDED.start_at END,
          end_at=CASE WHEN ${input.action}='withdraw' THEN loyalty_programs.end_at ELSE EXCLUDED.end_at END,
          rules_json=loyalty_programs.rules_json || EXCLUDED.rules_json,updated_at=clock_timestamp()
        WHERE loyalty_programs.tenant_id=${tenant.id}::uuid AND loyalty_programs.updated_at=${input.expectedRevision}::timestamptz
        RETURNING *,updated_at::text AS revision
      ), audited AS (
        INSERT INTO audit_logs(actor_id,tenant_id,action,resource_type,resource_id,after_hash)
        SELECT ${actorId}::uuid,tenant_id,${action},'loyalty_program',id::text,${fingerprint} FROM changed RETURNING 1
      ) SELECT changed.*,(SELECT count(*) FROM audited) AS audit_count FROM changed`;
  } else {
    if (before && !quizFromRow(before).managed) throw new ConfigurationError("configuration_legacy_quiz_readonly", 409);
    const f = input.action === "withdraw" ? { programId: before?.program_id, title: before?.title, description: before?.description, vertical: before?.vertical,
      startsAt: before?.starts_at, endsAt: before?.ends_at, questions: before?.questions_json, pointsPerCorrect: before?.points_per_correct, completionBonus: before?.completion_bonus, passThreshold: before?.pass_threshold } : fields;
    const filter = JSON.stringify({ managedBy: QUIZ_MANAGER, scope: "tenant", vertical: f.vertical, _nexidConfigurationWrite: marker });
    const status = input.action === "publish" ? "active" : input.action === "withdraw" ? "paused" : "draft";
    rows = await query`
      WITH parent AS MATERIALIZED (SELECT * FROM loyalty_programs WHERE id=${f.programId}::uuid AND tenant_id=${tenant.id}::uuid AND vertical=${f.vertical} FOR UPDATE),
      locked AS MATERIALIZED (SELECT q.* FROM loyalty_quizzes q JOIN parent p ON p.id=q.program_id WHERE q.tenant_id=${tenant.id}::uuid ORDER BY q.id FOR UPDATE OF q),
      eligible AS MATERIALIZED (
        SELECT id FROM locked WHERE id=${input.id}::uuid AND updated_at=${input.expectedRevision}::timestamptz
          AND (${input.action}='withdraw' OR status<>'active')
          AND (${status}<>'active' OR (EXISTS(SELECT 1 FROM parent WHERE status='active') AND NOT EXISTS (
            SELECT 1 FROM locked other WHERE other.id<>${input.id}::uuid AND other.status='active' AND other.product_filter_json->>'managedBy'=${QUIZ_MANAGER}
              AND other.product_filter_json->>'scope'='tenant' AND other.vertical=${f.vertical}
              AND other.starts_at <= COALESCE(${f.endsAt}::timestamptz,'infinity'::timestamptz) AND COALESCE(other.ends_at,'infinity'::timestamptz)>=${f.startsAt}::timestamptz)))
      ), changed AS (
        INSERT INTO loyalty_quizzes(id,tenant_id,program_id,code,title,description,vertical,product_filter_json,questions_json,points_per_correct,completion_bonus,pass_threshold,status,starts_at,ends_at)
        SELECT ${input.id}::uuid,${tenant.id}::uuid,${f.programId}::uuid,${`managed-${input.id}`},${f.title},${f.description},${f.vertical},${filter}::jsonb,${JSON.stringify(f.questions)}::jsonb,
          ${f.pointsPerCorrect},${f.completionBonus},${f.passThreshold},${status},${f.startsAt}::timestamptz,${f.endsAt}::timestamptz
        WHERE EXISTS(SELECT 1 FROM parent) AND ((${input.expectedRevision}::text IS NULL AND ${status}='draft' AND NOT EXISTS(SELECT 1 FROM locked WHERE id=${input.id}::uuid)) OR EXISTS(SELECT 1 FROM eligible))
        ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,vertical=EXCLUDED.vertical,product_filter_json=loyalty_quizzes.product_filter_json || EXCLUDED.product_filter_json,
          questions_json=EXCLUDED.questions_json,points_per_correct=EXCLUDED.points_per_correct,completion_bonus=EXCLUDED.completion_bonus,pass_threshold=EXCLUDED.pass_threshold,
          status=EXCLUDED.status,starts_at=CASE WHEN ${input.action}='withdraw' THEN loyalty_quizzes.starts_at ELSE EXCLUDED.starts_at END,
          ends_at=CASE WHEN ${input.action}='withdraw' THEN loyalty_quizzes.ends_at ELSE EXCLUDED.ends_at END,updated_at=clock_timestamp()
        WHERE loyalty_quizzes.tenant_id=${tenant.id}::uuid AND loyalty_quizzes.program_id=${f.programId}::uuid AND loyalty_quizzes.updated_at=${input.expectedRevision}::timestamptz
        RETURNING *,updated_at::text AS revision
      ), audited AS (
        INSERT INTO audit_logs(actor_id,tenant_id,action,resource_type,resource_id,after_hash)
        SELECT ${actorId}::uuid,tenant_id,${action},'loyalty_quiz',id::text,${fingerprint} FROM changed RETURNING 1
      ) SELECT changed.*,(SELECT count(*) FROM audited) AS audit_count FROM changed`;
  }
  if (rows[0]) return { resource: projection(input.kind, rows[0]), idempotentReplay: false };
  // Fresh snapshot recovers a concurrent winner without replaying a write.
  const current = await readResource(tenant, input, query);
  const json = input.kind === "profile" ? record(current?.metadata) : input.kind === "program" ? record(current?.rules_json) : record(current?.product_filter_json);
  const last = record(json._nexidConfigurationWrite);
  if (current && last.operationId === input.operationId && last.fingerprint === fingerprint) return { resource: projection(input.kind, current), idempotentReplay: true };
  throw new ConfigurationError(current && revisionOf(current) !== input.expectedRevision ? "configuration_revision_conflict" : "configuration_active_conflict", 409);
}
