type PolygonWalletDiagnosticPayload = Record<string, unknown>;

type PolygonWalletViewer = {
  scope: "super_admin" | "tenant_admin" | "reseller" | "readonly_demo";
  tenantSlug: string | null;
};

/**
 * Platform wallet addresses, balances, RPC endpoints and executor diagnostics
 * belong to the operator control plane. Tenant users only receive the bounded
 * capability signal needed to operate their own tokenization queue.
 */
export function polygonWalletViewForViewer(
  payload: PolygonWalletDiagnosticPayload,
  viewer: PolygonWalletViewer,
): PolygonWalletDiagnosticPayload {
  if (viewer.scope === "super_admin") return payload;

  const ready = payload.ready === true && payload.chainReady === true;
  const mode = String(payload.mode || "disabled");
  const network = String(payload.network || "polygon-amoy");

  return {
    ok: payload.ok === true,
    scope: "tenant",
    tenant: { slug: viewer.tenantSlug || null },
    ready,
    chainReady: ready,
    verificationLevel: ready ? "tenant_capability_verified" : "tenant_capability_unavailable",
    mode,
    network,
    autoTokenize: payload.autoTokenize === true,
    checks: [{
      key: "tenant_capability",
      label: "Managed Polygon capability",
      status: ready ? "pass" : mode === "simulated" ? "warn" : "fail",
      detail: ready
        ? "The managed execution path is available for this tenant's authorized requests."
        : mode === "simulated"
          ? "Simulation is available; no blockchain transaction or token is created."
          : "The managed execution path is not currently available.",
    }],
  };
}
