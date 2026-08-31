import "server-only";

import { fetchAdminPage, type AdminPageContext } from "./admin-page-access";
import { normalizePhysicalTapsPayload, type PhysicalTapsResult } from "./physical-taps-contract";

export async function readPhysicalTaps({
  context,
  bid = "DEMO-2026-02",
  limit = 20,
  range = "24h",
  isDemoSession = false,
}: {
  context: AdminPageContext;
  bid?: string;
  limit?: number;
  range?: "24h" | "7d" | "30d" | "90d";
  isDemoSession?: boolean;
}): Promise<PhysicalTapsResult> {
  const checkedAt = new Date().toISOString();
  if (isDemoSession) {
    return {
      availability: "requires_tenant_session",
      payload: null,
      detail: "real_data_requires_tenant_session",
      checkedAt,
    };
  }

  const params = new URLSearchParams({ bid, range, limit: String(Math.min(Math.max(limit, 1), 100)) });
  try {
    const response = await fetchAdminPage(context, `sun/physical-taps?${params.toString()}`);
    if (response.status === 401 || response.status === 403) {
      return { availability: "forbidden", payload: null, detail: `HTTP_${response.status}`, checkedAt };
    }
    if (!response.ok) {
      return { availability: "upstream_error", payload: null, detail: `HTTP_${response.status}`, checkedAt };
    }
    const payload = normalizePhysicalTapsPayload(await response.json().catch(() => null));
    if (!payload) return { availability: "invalid_payload", payload: null, detail: "physical_taps_contract_invalid", checkedAt };
    return { availability: "ready", payload, detail: "tenant_scoped_real_physical_taps", checkedAt };
  } catch {
    return { availability: "unreachable", payload: null, detail: "physical_taps_upstream_unreachable", checkedAt };
  }
}
