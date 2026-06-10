import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { OpsCommandCenter, type OpsCommandStep, type OpsCommandTenantRow } from "../../../components/ops-command-center";
import { BlockchainHsmHealth } from "../../../components/blockchain-hsm-health";
import { requireDashboardSession } from "../../../lib/session";
import { getServerOrigin } from "../../../lib/server-origin";

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

async function fetchJson<T>(origin: string, path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${origin}${path}`, { cache: "no-store" });
    if (!response.ok) return fallback;
    return await response.json() as T;
  } catch {
    return fallback;
  }
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

function riskScore(scans: number, duplicates: number, tamper: number) {
  if (!scans) return 0;
  const score = ((duplicates * 40 + tamper * 60) / scans) * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default async function SuperadminConsumerNetworkPage() {
  const session = await requireDashboardSession();
  const origin = await getServerOrigin();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
  const assetQuery = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}&limit=80` : "?limit=80";
  const [tenants, batches, tagsPayload, experiencesPayload, productAssetsPayload] = await Promise.all([
    fetchJson<TenantRow[]>(origin, "/api/admin/tenants?withStats=1", []),
    fetchJson<BatchRow[]>(origin, `/api/admin/batches${query}`, []),
    fetchJson<TagsPayload>(origin, `/api/admin/tags${query ? `${query}&` : "?"}limit=100`, { rows: [], totals: {} }),
    fetchJson<ExperiencesPayload>(origin, `/api/admin/consumer-experiences${query}`, { items: [], moderation: {} }),
    fetchJson<ProductAssetsPayload>(origin, `/api/admin/product-assets${assetQuery}`, { items: [] }),
  ]);

  const scopedTenants = tenantScope ? tenants.filter((row) => String(row.slug || row.tenant_slug || "").toLowerCase() === tenantScope) : tenants;
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
    const slug = String(row.tenant_slug || row.tenant_id || tenantScope || "tenant").toLowerCase();
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
      riskScore: riskScore(scans, duplicates, tamper),
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
      owner: "Superadmin",
    },
    {
      label: "Batches con carrier declarado",
      body: "El dashboard separa QR, NFC UID, NTAG424 DNA y TT para vender la seguridad correcta.",
      status: secureBatches > 0 ? "ready" : batches.length ? "working" : "blocked",
      owner: "Auditor",
    },
    {
      label: "Tags activos y testeables",
      body: "El reseller o tenant puede ver cuantos tags ya estan listos para pegar y cuantos faltan.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Reseller",
    },
    {
      label: "Banco visual listo",
      body: "Cada lote premium debe tener foto real, etiqueta frontal, tag aplicado y ficha comercial antes de publicar /sun y marketplace.",
      status: readyAssets > 0 ? "ready" : productAssets.length ? "working" : "blocked",
      owner: "Tenant",
    },
    {
      label: "Riesgo bajo control",
      body: "Duplicados, replay y tamper se tratan como bloqueo comercial, no como dato tecnico escondido.",
      status: totalDuplicates + totalTamper > Math.max(totalScans * 0.12, 4) ? "blocked" : totalScans > 0 ? "ready" : "working",
      owner: "Auditor",
    },
    {
      label: "Club y experiencias verificadas",
      body: "La red B2C queda moderada: no hay reviews anonimas que puedan danar marcas premium.",
      status: approvedExperiences > 0 ? "ready" : pendingExperiences > 0 ? "working" : "working",
      owner: "Tenant",
    },
  ];

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Superadmin network"
        title="Consola global para operar tenants, resellers, auditores y clubes"
        description="Una vista ejecutiva y operativa para pasar de piloto a rollout: lotes, tags, riesgo, marketplace, experiencias verificadas y tokenizacion."
      />

      <BlockchainHsmHealth />

      <OpsCommandCenter
        mode={session.role === "tenant-admin" ? "tenant" : "global"}
        metrics={[
          { label: "Tenants", value: String(scopedTenants.length), detail: tenantScope ? `Scope ${tenantScope}` : "Marcas conectadas a la red", tone: scopedTenants.length ? "good" : "warn" },
          { label: "Tags activos", value: activeTags.toLocaleString("es-AR"), detail: `${totalTags.toLocaleString("es-AR")} tags en inventario`, tone: activeTags > 0 ? "good" : "warn" },
          { label: "Batches premium", value: String(secureBatches), detail: "NTAG424 DNA / TT declarados", tone: secureBatches > 0 ? "good" : "warn" },
          { label: "Assets reales", value: String(productAssets.length), detail: `${readyAssets} listos - score ${averageAssetScore}/100`, tone: readyAssets > 0 ? "good" : productAssets.length ? "warn" : "risk" },
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
      />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-cyan-200">Prioridades del dia</h2>
            <p className="mt-1 text-sm text-slate-400">Lo que un superadmin o auditor deberia mirar antes de aprobar nuevos rollouts.</p>
          </div>
          <div className="divide-y divide-white/10">
            {[
              {
                title: "Auditar carrier y promesa comercial",
                body: "Ningun QR comun debe venderse como autenticidad criptografica. NTAG424 DNA/TT debe tener llaves y pretest SUN.",
                tone: secureBatches > 0 ? "good" : "warn",
                href: "/batches",
              },
              {
                title: "Completar banco visual de producto",
                body: `Antes de presentar a cliente premium: ${realPhotoAssets} fotos reales, ${labelAssets} etiquetas y score visual ${averageAssetScore}/100.`,
                tone: readyAssets > 0 ? "good" : "warn",
                href: "/batches",
              },
              {
                title: "Revisar experiencias verificadas",
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
        </Card>

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
          <span className="text-xs text-slate-500">Superadmin / demobodega / auditor</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[
            { label: "Registrar supplier batch", href: "/batches/supplier" },
            { label: "Inventario de tags", href: "/tags" },
            { label: "Experiencias verificadas", href: "/loyalty/experiences" },
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
