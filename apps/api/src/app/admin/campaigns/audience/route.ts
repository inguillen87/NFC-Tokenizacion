export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { effectiveTenantFilter } from "../../../../lib/admin-tenant-filter";
import { checkAdminWithPermission, getAdminTenantScope } from "../../../../lib/auth";
import {
  CampaignAudienceError,
  normalizeCampaignAudienceChannel,
  normalizeCampaignAudiencePurpose,
  resolveCampaignAudience,
} from "../../../../lib/campaign-audience";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";

const NO_STORE = { "cache-control": "private, no-store, max-age=0" };

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "campaigns:read");
  if (auth) return auth;

  const url = new URL(req.url);
  const { forcedTenantSlug } = getAdminTenantScope(req);
  const tenantSlug = effectiveTenantFilter({
    forcedTenantSlug,
    requestedTenantSlug: url.searchParams.get("tenant"),
  });
  if (!tenantSlug) {
    return json({ ok: false, reason: "campaign_audience_tenant_required" }, 400, NO_STORE);
  }
  const channel = normalizeCampaignAudienceChannel(url.searchParams.get("channel"));
  if (!channel) {
    return json({ ok: false, reason: "campaign_audience_channel_invalid" }, 400, NO_STORE);
  }
  const purpose = normalizeCampaignAudiencePurpose(url.searchParams.get("purpose"));
  if (!purpose) {
    return json({ ok: false, reason: "campaign_audience_purpose_invalid" }, 400, NO_STORE);
  }

  try {
    const audience = await resolveCampaignAudience({
      tenantSlug,
      channel,
      purpose,
      limit: Number(url.searchParams.get("limit") || 100),
    }, sql);
    return json({ ok: true, audience }, 200, NO_STORE);
  } catch (error) {
    if (error instanceof CampaignAudienceError) {
      return json({ ok: false, reason: error.message }, error.status, NO_STORE);
    }
    return json({ ok: false, reason: "campaign_audience_unavailable" }, 503, NO_STORE);
  }
}
