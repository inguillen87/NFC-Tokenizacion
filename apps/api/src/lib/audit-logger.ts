import { createHash } from "crypto";
import { sql } from "./db";
import { ensureAuditLogsSchema } from "./commercial-runtime-schema";

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

function computeHash(data: unknown) {
  if (data == null) return null;
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex");
}

export async function logAuditEvent(input: AuditLogInput) {
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
  } catch (error) {
    console.warn("[audit_log_failed]", error instanceof Error ? error.message : "unknown_error");
  }
}
