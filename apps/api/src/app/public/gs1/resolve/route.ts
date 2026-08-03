export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { enforceCriticalRateLimit } from "../../../../lib/critical-rate-limit";
import {
  Gs1RegistryError,
  normalizeGs1Identity,
  resolveActiveGs1Identity,
} from "../../../../lib/gs1-digital-link-registry";
import { agroPublicLinks, hasConfiguredAgroProfile, normalizeAgroProductProfile } from "../../../../lib/agro-product-profile";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

export async function GET(req: Request) {
  const limited = await enforceCriticalRateLimit(req, {
    rateClass: "public",
    tenantId: "platform",
    subjectId: "gs1-resolver",
  });
  if (limited) return limited;
  const search = new URL(req.url).searchParams;
  try {
    const requested = normalizeGs1Identity({
      gtin: search.get("gtin"),
      lot: search.get("lot"),
      serial: search.get("serial"),
    });
    const identity = await resolveActiveGs1Identity(requested);
    if (!identity) {
      return json({ ok: false, reason: "gs1_identity_not_found" }, 404, {
        "cache-control": "no-store",
      });
    }
    const productRows = await sql/*sql*/`
      SELECT b.sdm_config, tp.locale_data
      FROM batches b
      LEFT JOIN tag_profiles tp ON tp.tag_id = ${identity.tagId}::uuid
      WHERE b.id = ${identity.batchId}::uuid
        AND b.tenant_id = ${identity.tenantId}::uuid
      LIMIT 1
    ` as Array<{ sdm_config?: unknown; locale_data?: unknown }>;
    const agro = normalizeAgroProductProfile({
      batchConfig: productRows[0]?.sdm_config,
      tagLocaleData: productRows[0]?.locale_data,
      registryMetadata: identity.metadata,
      identity,
    });
    const configuredAgro = hasConfiguredAgroProfile(agro) ? agro : null;
    return json({
      ok: true,
      registry: {
        id: identity.id,
        gtin: identity.gtin,
        lot: identity.lot,
        serial: identity.serial,
        tenantSlug: identity.tenantSlug,
        bid: identity.bid,
        displayName: identity.displayName,
        agro: configuredAgro,
        publicLinks: configuredAgro ? agroPublicLinks(configuredAgro) : {},
      },
      assurance: {
        identityRegistered: true,
        cryptographicNfcAuthentication: false,
      },
    }, 200, {
      "cache-control": "no-store, max-age=0, must-revalidate",
      "x-content-type-options": "nosniff",
    });
  } catch (error) {
    if (error instanceof Gs1RegistryError) {
      return json({ ok: false, reason: error.code }, error.status, { "cache-control": "no-store" });
    }
    return json({ ok: false, reason: "gs1_registry_unavailable" }, 503, {
      "cache-control": "no-store",
      "retry-after": "5",
    });
  }
}
