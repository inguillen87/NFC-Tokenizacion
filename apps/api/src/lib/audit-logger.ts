import { createHash } from "crypto";
import { sql } from "./db";
import { ensureAuditLogsSchema } from "./commercial-runtime-schema";
import { redactSecretsDeep } from "./batch-keys";

export type AuditLogInput = {
  actorId: string | null;
  tenantId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

export type AuditLogResult =
  | { ok: true }
  | { ok: false; reason: "audit_log_projection_failed" };

function computeHash(data: unknown) {
  if (data == null) return null;
  const safeData = redactSecretsDeep(data);
  const str = typeof safeData === "string" ? safeData : JSON.stringify(safeData);
  return createHash("sha256").update(str).digest("hex");
}

export async function logAuditEvent(input: AuditLogInput): Promise<AuditLogResult> {
  try {
    await ensureAuditLogsSchema();
    const beforeHash = computeHash(input.beforeData);
    const afterHash = computeHash(input.afterData);
    
    await sql/*sql*/`
      INSERT INTO audit_logs (
        actor_id, tenant_id, action, resource_type, resource_id, before_hash, after_hash, ip_address, user_agent, request_id
      ) VALUES (
        ${input.actorId || null}::uuid,
        ${input.tenantId || null}::uuid,
        ${input.action},
        ${input.resourceType},
        ${input.resourceId || null},
        ${beforeHash},
        ${afterHash},
        ${input.ipAddress || null},
        ${input.userAgent || null},
        ${input.requestId || null}
      )
    `;
    return { ok: true };
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32)
      : "unknown_error";
    console.warn("[audit_log_failed]", code || "unknown_error");
    return { ok: false, reason: "audit_log_projection_failed" };
  }
}
