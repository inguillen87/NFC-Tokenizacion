export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin } from "../../../lib/auth";
import { ensureSdkSchema } from "../../../lib/commercial-runtime-schema";
import { sql } from "../../../lib/db";
import { json } from "../../../lib/http";
import { checkWebhookPermission } from "../webhooks/policy";

const NO_STORE = { "cache-control": "no-store" };

export async function GET(req: Request) {
  const auth = await checkAdmin(req, ["super_admin", "tenant_admin", "tenant_operator", "reseller"]);
  if (auth) return auth;
  const permission = checkWebhookPermission(req, "read");
  if (permission) return permission;

  try {
    await ensureSdkSchema();
    const rows = await sql/*sql*/`
      SELECT code, display_name, event_version, delivery_mode,
        native_integration, approval_status, schema_json, claim_text, updated_at
      FROM enterprise_connector_profiles
      WHERE active = true
      ORDER BY code ASC
      LIMIT 100
    `;
    return json({
      ok: true,
      profiles: rows,
      deliveryContract: {
        eventName: "sdk.external_event",
        signature: "HMAC-SHA256 v2",
        statement: "Profiles are generic outbound mappings unless native_integration=true and approval_status=production_enabled.",
      },
    }, 200, NO_STORE);
  } catch (error) {
    const code = String((error as { code?: unknown })?.code || "");
    return json({
      ok: false,
      reason: ["42P01", "42703"].includes(code)
        ? "enterprise_event_profile_migration_required"
        : "enterprise_event_profiles_unavailable",
      ...(["42P01", "42703"].includes(code)
        ? { requiredMigration: "20260802230000_0088_enterprise_event_profile.sql" }
        : {}),
    }, 503, { ...NO_STORE, "retry-after": "1" });
  }
}
