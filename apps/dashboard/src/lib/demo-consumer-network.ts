const DEMO_TENANT = "demobodega";
const RESOURCES = new Set(["overview", "members", "products", "taps"]);

function provenance(declaredDemo: number, observedAt: string) {
  return {
    contractVersion: "consumer-network-event-provenance/v1",
    state: "classified",
    primaryScope: "operational_tap",
    timezone: "UTC",
    physicalPresenceClaim: "not_asserted",
    counts: { operationalTap: 0, declaredDemo, imported: 0, legacyUnclassified: 0, mixed: 0 },
    hasIsolatedRecords: declaredDemo > 0,
    latestOperationalAt: null,
    observedAt,
    evidenceBasis: {
      operationalTap: "No hay taps operativos en este escenario sintético.",
      declaredDemo: "Ejemplos ficticios del sandbox Bodega Balmec; no son clientes, permisos ni lecturas físicas.",
      legacyUnclassified: "No se incorporan registros de legado.",
    },
  };
}

/** Read-only fixtures. Never relabel these records as operational or copy a real tenant scope. */
export function demoConsumerNetworkResource(method: string, path: string, tenant: string, now = new Date()) {
  const [namespace, resource, extra] = path.split("/");
  if (namespace !== "consumer-network" || !RESOURCES.has(resource) || extra !== undefined) return null;
  if (method !== "GET") return { status: 405, body: { ok: false, reason: "demo_read_only" } };
  if (tenant !== DEMO_TENANT) return { status: 403, body: { ok: false, reason: "demo_tenant_required" } };

  const observedAt = now.toISOString();
  const previousDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1);
  const timestamp = (hour: number) => new Date(previousDay + hour * 3_600_000).toISOString();
  const envelope = { ok: true, tenant: DEMO_TENANT, demoMode: true, dataSource: "demo" };
  const tapHours = [8, 8, 9, 10, 12, 12, 12, 16, 18, 20];

  if (resource === "overview") {
    return { status: 200, body: {
      ...envelope,
      provenance: provenance(tapHours.length, observedAt),
      identityBoundary: "Perfiles ficticios de demostración. Un tag no identifica a una persona; esta demo no otorga consentimiento de contacto.",
      topProductsByClaims: [],
      overview: {
        totalActivity: 0, totalTaps: 0, customerActions: 0,
        activityWithKnownActor: 0, activityWithoutActor: 0, actorLinkedActivityRate: 0,
        recognizedUnits: 0, knownActors: 0, verifiedIdentityActors: 0, activeTenantMembers: 0,
        consentPurpose: "marketing", consentedActorsByChannel: { email: 0, whatsapp: 0, phone: 0 },
        savedProducts: 0, riskBlockedClaims: 0,
      },
    } };
  }

  if (resource === "members") {
    const items = [1, 2, 3].map((number) => ({
      tenant_slug: DEMO_TENANT,
      display_name: `Perfil ficticio ${String(number).padStart(2, "0")} · Demo`,
      email_masked: null,
      status: "Ejemplo demo",
      points_balance: null,
      last_activity_at: timestamp(12 + number),
      data_provenance: "declared_demo",
    }));
    return { status: 200, body: { ...envelope, items, provenance: provenance(items.length, observedAt) } };
  }

  if (resource === "products") {
    const items = [
      { product_name: "Gran Reserva Malbec · Demo", claimed_count: 1, saved_count: 3 },
      { product_name: "Cabernet Franc Reserva · Demo", claimed_count: 0, saved_count: 2 },
    ].map((product) => ({
      ...product, tenant_slug: DEMO_TENANT, bid: "DEMO-2026-02",
      latest_activity_at: timestamp(20), data_provenance: "declared_demo",
    }));
    return { status: 200, body: {
      ...envelope, items,
      provenance: provenance(items.reduce((total, product) => total + product.saved_count, 0), observedAt),
    } };
  }

  const items = tapHours.map((hour, index) => ({
    tap_event_id: `demo-balmec-tap-${String(index + 1).padStart(2, "0")}`,
    tenant_slug: DEMO_TENANT,
    verdict: null,
    risk_level: null,
    created_at: timestamp(hour),
    data_provenance: "declared_demo",
  }));
  return { status: 200, body: { ...envelope, items, provenance: provenance(items.length, observedAt) } };
}
