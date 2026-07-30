import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { OpsCommandCenter, type OpsCommandStep, type OpsCommandTenantRow } from "../../../components/ops-command-center";
import { BlockchainHsmHealth } from "../../../components/blockchain-hsm-health";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../lib/demo-data-mode";
import { resolveCanonicalTenantRisk } from "../../../lib/tenant-risk";

type TenantRow = Record<string, unknown>;
type BatchRow = Record<string, unknown>;
type TagsPayload = {
  rows?: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
};
type ExperiencesPayload = {
  items?: Array<Record<string, unknown>>;
  moderation?: Record<string, number>;
};
type ProductAssetsPayload = {
  items?: Array<{
    profile?: {
      assetScore?: number | string | null;
      primaryImageUrl?: string | null;
      labelImageUrl?: string | null;
      modelUrl?: string | null;
    } | null;
  }>;
};

type SourceAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";
type SourceResult<T> = { availability: SourceAvailability; data: T | null };

async function fetchJson<T>(
  context: AdminPageContext,
  path: string,
  validate: (value: unknown) => value is T,
): Promise<SourceResult<T>> {
  try {
    const response = await fetchAdminPage(context, path);
    const meta = readDemoDataMetaFromResponse(response);
    if (!response.ok) return { availability: "upstream_error", data: null };
    const payload = await response.json().catch(() => null);
    const upstreamUnavailable = Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && (payload as { ok?: boolean }).ok === false);
    if (upstreamUnavailable) return { availability: "upstream_error", data: null };
    if (meta.demoMode || !validate(payload)) return { availability: "invalid_payload", data: null };
    return { availability: "ready", data: payload };
  } catch {
    return { availability: "unreachable", data: null };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberFrom(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveTenantStatus(scans: number, duplicates: number, tamper: number): OpsCommandTenantRow["status"] {
  if (tamper >= 3 || duplicates > Math.max(scans * 0.12, 4)) return "risk";
  if (scans <= 0) return "pending";
  if (duplicates + tamper > 0) return "healthy";
  return "active";
}

export default async function SuperadminConsumerNetworkPage() {
  const session = await requireDashboardSession();
  if (session.role !== "super-admin") {
    return (
      <main className="space-y-6" data-testid="superadmin-network-access-denied">
        <SectionHeading
          eyebrow="Superadmin network"
          title="Acceso global protegido"
          description="Esta consola opera todos los tenants, billing, IAM y red comercial. Bodega Balmec y otros tenants mantienen su propio workspace sin permisos globales."
        />
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_82%_0%,rgba(251,191,36,.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,8,23,.94))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Scope actual</p>
                <h2 className="mt-2 text-2xl font-black text-white">{session.label || "Tenant workspace"}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Tu sesion puede operar su tenant, proof, CRM, tags y campanas. No puede consultar la red completa ni datos cross-tenant.
                </p>
              </div>
              <StatusChip label="requiere super admin" tone="warn" />
            </div>
          </div>
          <div className="grid gap-3 p-5 md:grid-cols-3">
            <Link
              href="/"
              className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Volver al dashboard tenant
            </Link>
            <Link
              href="/settings"
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-black text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100"
            >
              Revisar cuenta y permisos
            </Link>
            <Link
              href="/auth/clerk/super-admin"
              className="rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm font-black text-amber-100 transition hover:border-amber-200/60 hover:bg-amber-400/16"
            >
              Entrar como Super Admin
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  const adminContext = await createAdminPageContext(session);
  const [tenantsResult, batchesResult, tagsResult, experiencesResult, productAssetsResult] = await Promise.all([
    fetchJson<TenantRow[]>(adminContext, "/api/admin/tenants?withStats=1", Array.isArray),
    fetchJson<BatchRow[]>(adminContext, "/api/admin/batches", Array.isArray),
    fetchJson<TagsPayload>(adminContext, "/api/admin/tags?limit=100", isRecord),
    fetchJson<ExperiencesPayload>(adminContext, "/api/admin/consumer-experiences", isRecord),
    fetchJson<ProductAssetsPayload>(adminContext, "/api/admin/product-assets?limit=80", isRecord),
  ]);

  const allSourcesReady = [tenantsResult, batchesResult, tagsResult, experiencesResult, productAssetsResult]
    .every((result) => result.availability === "ready");
  const unavailableSources = [
    ["tenants", tenantsResult.availability],
    ["batches", batchesResult.availability],
    ["tags", tagsResult.availability],
    ["consumer-experiences", experiencesResult.availability],
    ["product-assets", productAssetsResult.availability],
  ].filter(([, availability]) => availability !== "ready");
  const scopedTenants = tenantsResult.data || [];
  const batches = batchesResult.data || [];
  const tagsPayload = tagsResult.data || {};
  const experiencesPayload = experiencesResult.data || {};
  const productAssetsPayload = productAssetsResult.data || {};
  const totals = tagsPayload.totals || {};
  const tagRows = tagsPayload.rows || [];
  const experiences = experiencesPayload.items || [];
  const productAssets = productAssetsPayload.items || [];
  const moderation = experiencesPayload.moderation || {};
  const activeTags = numberFrom(totals.active_tags);
  const mintedTags = numberFrom(totals.minted_tags);
  const pendingTokenization = numberFrom(totals.pending_tokenization);
  const totalTags = numberFrom(totals.total) || tagRows.length;
  const importedTags = batches.reduce((sum, row) => sum + numberFrom(row.imported_tags || row.quantity || row.qty), 0);
  const plannedTags = batches.reduce((sum, row) => sum + numberFrom(row.requested_quantity || row.quantity || row.qty), 0);
  const secureBatches = batches.filter((row) => String(row.carrier_profile_code || row.carrier_label || "").toLowerCase().includes("424")).length;
  const totalScans = scopedTenants.reduce((sum, row) => sum + numberFrom(row.scans), 0);
  const totalDuplicates = scopedTenants.reduce((sum, row) => sum + numberFrom(row.duplicates), 0);
  const totalTamper = scopedTenants.reduce((sum, row) => sum + numberFrom(row.tamper), 0);
  const pendingExperiences = numberFrom(moderation.pending);
  const approvedExperiences = numberFrom(moderation.approved);
  const assetScores = productAssets.map((item) => numberFrom(item.profile?.assetScore)).filter((score) => score > 0);
  const averageAssetScore = assetScores.length ? Math.round(assetScores.reduce((sum, score) => sum + score, 0) / assetScores.length) : 0;
  const readyAssets = productAssets.filter((item) => numberFrom(item.profile?.assetScore) >= 80).length;
  const realPhotoAssets = productAssets.filter((item) => Boolean(item.profile?.primaryImageUrl)).length;
  const labelAssets = productAssets.filter((item) => Boolean(item.profile?.labelImageUrl)).length;

  const batchByTenant = new Map<string, { batches: number; tags: number }>();
  for (const row of batches) {
    const slug = String(row.tenant_slug || row.tenant_id || "tenant").toLowerCase();
    const current = batchByTenant.get(slug) || { batches: 0, tags: 0 };
    current.batches += 1;
    current.tags += numberFrom(row.active_tags || row.quantity || row.qty || row.requested_quantity);
    batchByTenant.set(slug, current);
  }

  const tenantRows: OpsCommandTenantRow[] = scopedTenants.map((row) => {
    const slug = String(row.slug || row.tenant_slug || row.tenant_id || "tenant").toLowerCase();
    const scans = numberFrom(row.scans);
    const duplicates = numberFrom(row.duplicates);
    const tamper = numberFrom(row.tamper);
    const batchInfo = batchByTenant.get(slug) || { batches: 0, tags: 0 };
    return {
      name: String(row.name || row.slug || slug),
      slug,
      scans,
      riskScore: resolveCanonicalTenantRisk(row),
      batches: batchInfo.batches,
      tags: batchInfo.tags,
      status: resolveTenantStatus(scans, duplicates, tamper),
    };
  });

  const steps: OpsCommandStep[] = [
    {
      label: "Tenants listos para operar",
      body: "Cada marca debe tener origen, reglas de claim, portal, assets y permisos antes de recibir tags masivos.",
      status: scopedTenants.length ? "ready" : "blocked",
      owner: "Super Admin",
    },
    {
      label: "Batches con carrier declarado",
      body: "El dashboard separa QR, NFC UID, NTAG424 DNA y TT para vender la seguridad correcta.",
      status: secureBatches > 0 ? "ready" : batches.length ? "working" : "blocked",
      owner: "Seguridad",
    },
    {
      label: "Tags activos y testeables",
      body: "El reseller o tenant puede ver cuantos tags ya estan listos para pegar y cuantos faltan.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Operaciones",
    },
    {
      label: "Banco visual listo",
      body: "Cada lote premium debe tener foto real, etiqueta frontal, tag aplicado y ficha comercial antes de publicar /sun y marketplace.",
      status: readyAssets > 0 ? "ready" : productAssets.length ? "working" : "blocked",
      owner: "Owner",
    },
    {
      label: "Riesgo bajo control",
      body: "Duplicados, replay y tamper se tratan como bloqueo comercial, no como dato tecnico escondido.",
      status: totalDuplicates + totalTamper > Math.max(totalScans * 0.12, 4) ? "blocked" : totalScans > 0 ? "ready" : "working",
      owner: "Seguridad",
    },
    {
      label: "Club y experiencias con evidencia",
      body: "La red B2C queda moderada: las reviews requieren la evidencia y la identidad definidas por policy.",
      status: approvedExperiences > 0 ? "ready" : pendingExperiences > 0 ? "working" : "working",
      owner: "Growth",
    },
  ];

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Superadmin network"
        title="Consola global para operar tenants, resellers, auditores y clubes"
        description="Una vista ejecutiva y operativa para pasar de piloto a rollout: lotes, tags, riesgo, marketplace, experiencias con evidencia y tokenizacion."
      />

      <BlockchainHsmHealth />

      {!allSourcesReady ? (
        <EnterpriseOpsState
          variant="warning"
          title="Consola global sin snapshot completo"
          description="Una o más APIs operativas no confirmaron datos. Se ocultan métricas, funnels, readiness y prioridades derivadas para no convertir una falla en ceros ni mezclar fixtures demo con producción."
          checklist={unavailableSources.map(([name, availability]) => `${name}: ${availability}`)}
          action={<a href="/superadmin-network" className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100">Reintentar snapshot</a>}
          testId="superadmin-network-source-unavailable"
        />
      ) : null}

      {allSourcesReady ? <OpsCommandCenter
        mode="global"
        metrics={[
          { label: "Tenants", value: String(scopedTenants.length), detail: "Marcas conectadas a la red", tone: scopedTenants.length ? "good" : "warn" },
          { label: "Tags activos", value: activeTags.toLocaleString("es-AR"), detail: `${totalTags.toLocaleString("es-AR")} tags en inventario`, tone: activeTags > 0 ? "good" : "warn" },
          { label: "Batches premium", value: String(secureBatches), detail: "NTAG424 DNA / TT declarados", tone: secureBatches > 0 ? "good" : "warn" },
          { label: "Perfiles visuales", value: String(productAssets.length), detail: assetScores.length ? `${readyAssets} listos - score ${averageAssetScore}/100 sobre ${assetScores.length}` : `${readyAssets} listos - sin scores informados`, tone: readyAssets > 0 ? "good" : productAssets.length ? "warn" : "risk" },
          { label: "Moderacion", value: String(pendingExperiences), detail: "Experiencias pendientes de aprobar", tone: pendingExperiences > 0 ? "warn" : "good" },
        ]}
        steps={steps}
        tenants={tenantRows}
        funnel={[
          { stage: "Tenants", value: scopedTenants.length },
          { stage: "Batches", value: batches.length },
          { stage: "Tags", value: activeTags },
          { stage: "Minted", value: mintedTags },
          { stage: "Reviews", value: approvedExperiences },
        ]}
        readiness={[
          { label: "Manifest", ready: importedTags, pending: Math.max(plannedTags - importedTags, 0) },
          { label: "Tags", ready: activeTags, pending: Math.max(totalTags - activeTags, 0) },
          { label: "Token", ready: mintedTags, pending: pendingTokenization },
          { label: "Assets", ready: readyAssets, pending: Math.max(productAssets.length - readyAssets, 0) },
          { label: "Club", ready: approvedExperiences, pending: pendingExperiences },
        ]}
      /> : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        {allSourcesReady ? <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Prioridades del dia</h2>
            <p className="mt-1 text-sm text-slate-400">Lo que un superadmin o auditor deberia mirar antes de aprobar nuevos rollouts.</p>
          </div>
          <div className="divide-y divide-white/10">
            {[
              {
                title: "Auditar carrier y promesa comercial",
                body: "Ningun QR comun debe venderse como evidencia criptografica del mensaje. NTAG424 DNA/TT debe tener llaves y pretest SUN.",
                tone: secureBatches > 0 ? "good" : "warn",
                href: "/batches",
              },
              {
                title: "Completar banco visual de producto",
                body: assetScores.length
                  ? `Antes de presentar a cliente premium: ${realPhotoAssets} fotos aportadas, ${labelAssets} etiquetas y score visual ${averageAssetScore}/100 sobre ${assetScores.length} perfiles.`
                  : `Antes de presentar a cliente premium: ${realPhotoAssets} fotos aportadas, ${labelAssets} etiquetas y ningun score visual informado.`,
                tone: readyAssets > 0 ? "good" : "warn",
                href: "/batches",
              },
              {
                title: "Revisar experiencias con evidencia",
                body: "Aprobar solo comentarios con tap fisico, contacto validado y producto guardado/reclamado.",
                tone: pendingExperiences > 0 ? "warn" : "good",
                href: "/loyalty/experiences",
              },
              {
                title: "Controlar tokenizacion y wallet",
                body: "Las unidades premium tienen que mostrar certificado, wallet custodial o MetaMask y link de blockchain cuando aplique.",
                tone: pendingTokenization > 0 ? "warn" : "good",
                href: "/tokenization",
              },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="block p-5 transition hover:bg-white/[0.03]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white">{item.title}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{item.body}</p>
                  </div>
                  <StatusChip label={item.tone === "good" ? "controlado" : "revisar"} tone={item.tone as "good" | "warn"} />
                </div>
              </Link>
            ))}
          </div>
        </Card> : null}

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Handoff para no tecnicos</h2>
              <p className="mt-1 text-sm text-slate-400">Checklist que entiende un reseller, una bodega o un auditor externo.</p>
            </div>
            <StatusChip label="operativo" tone="good" />
          </div>
          <div className="mt-4 space-y-3">
            {[
              "1. Recibi la caja de tags y el remito del proveedor.",
              "2. Subi manifest CSV/TXT con UID, lote, SKU, producto y fotos.",
              "3. nexID valido duplicados, carrier, batch y llaves.",
              "4. Pegue una muestra y toque el producto real.",
              "5. El passport mobile mostro producto, origen, estado y CTA correcto.",
              "6. Active portal, marketplace, club, garantia y NFT opcional.",
            ].map((line) => (
              <div key={line} className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-slate-200">{line}</div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Accesos rapidos</h2>
          <span className="text-xs text-slate-500">Super Admin / tenants confirmados / equipos operativos</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { label: "Registrar supplier batch", href: "/batches/supplier" },
            { label: "Inventario de tags", href: "/tags" },
            { label: "Experiencias con evidencia", href: "/loyalty/experiences" },
            { label: "Marketplace premium", href: "/consumer-network/marketplace" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20">
              {item.label}
            </Link>
          ))}
        </div>
      </Card>
    </main>
  );
}
