import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { BatchSunValidator } from "../../../components/batch-sun-validator";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { OpsCommandCenter, type OpsCommandStep, type OpsCommandTenantRow } from "../../../components/ops-command-center";
import { QuickOnboardingPanel } from "../../../components/quick-onboarding-panel";
import { EnterpriseOpsState } from "../../../components/enterprise-ops-state";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";

const rolloutSteps = [
  {
    step: "01",
    title: "Recibir tags",
    body: "El proveedor entrega QR, NFC simple o NTAG424 DNA TT con lote, remito y manifest.",
  },
  {
    step: "02",
    title: "Subir manifest",
    body: "CSV/TXT con UID, BID, carrier, seriales, caja/pallet, IoT y overrides de producto solo si son excepcion.",
  },
  {
    step: "03",
    title: "Preflight",
    body: "nexID valida duplicados, carrier, batch mismatch, llaves, cantidad y politica de claim.",
  },
  {
    step: "04",
    title: "Pegar y probar",
    body: "El operador pega tags, hace un tap y confirma que /sun muestra la ficha declarada, el evento reportado y las acciones configuradas.",
  },
  {
    step: "05",
    title: "Publicar",
    body: "Portal, marketplace, club, garantia, titularidad digital, NFT y experiencias con evidencia quedan listos.",
  },
];

const carrierLadder = [
  {
    label: "QR comun",
    promise: "Contenido, leads, promociones y analytics basico.",
    warning: "No vender como anti-clon ni autenticidad criptografica.",
  },
  {
    label: "NFC UID",
    promise: "Tap-to-web, serializacion y reglas de plataforma.",
    warning: "Bueno para UX, no para prueba premium por si solo.",
  },
  {
    label: "NTAG424 DNA",
    promise: "SUN dinamico, anti-replay y validacion criptografica.",
    warning: "El ownership sigue dependiendo de compra o politica del tenant.",
  },
  {
    label: "NTAG424 DNA TT",
    promise: "SUN + estado TT reportado abierto/cerrado.",
    warning: "La señal TT no certifica por sí sola contenido, sello ni apertura física.",
  },
];

type SourceAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";

type SourceResult<T> = {
  availability: SourceAvailability;
  data: T;
};

async function getBatchRows(context: AdminPageContext): Promise<SourceResult<Array<Record<string, unknown>>>> {
  try {
    const response = await fetchAdminPage(context, "batches");
    if (!response.ok) return { availability: "upstream_error", data: [] };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { availability: "invalid_payload", data: [] };
    return { availability: "ready", data: payload as Array<Record<string, unknown>> };
  } catch {
    return { availability: "unreachable", data: [] };
  }
}

type ProductAssetItem = {
  uidMasked?: string | null;
  tagStatus?: string | null;
  tenantSlug?: string | null;
  bid?: string | null;
  assetReadiness?: string | null;
  profileConflict?: boolean | null;
  unitMetadata?: { lot?: string | null; serial?: string | null; unitMetadata?: Record<string, unknown> | null } | null;
  iot?: Record<string, unknown> | null;
  profile?: {
    productName?: string | null;
    brandName?: string | null;
    verticalLabel?: string | null;
    assetScore?: number | null;
    primaryImageUrl?: string | null;
    labelImageUrl?: string | null;
    modelUrl?: string | null;
    uploadChecklist?: string[] | null;
    slots?: Array<{ id: string; label: string; status: "ready" | "demo" | "missing"; detail?: string | null }>;
  } | null;
};

async function getAssetRows(context: AdminPageContext): Promise<SourceResult<ProductAssetItem[]>> {
  try {
    const response = await fetchAdminPage(context, "product-assets?limit=60");
    if (!response.ok) return { availability: "upstream_error", data: [] };
    const payload = await response.json() as { items?: ProductAssetItem[] };
    if (!Array.isArray(payload.items)) return { availability: "invalid_payload", data: [] };
    return { availability: "ready", data: payload.items };
  } catch {
    return { availability: "unreachable", data: [] };
  }
}

export default async function BatchesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = searchParams ? await searchParams : {};
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession("batches:read");
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const isTenantAdmin = session.role === "tenant-admin";
  const copy = dashboardContent[locale];
  const [batchResult, assetResult] = await Promise.all([
    getBatchRows(adminContext),
    getAssetRows(adminContext),
  ]);
  const batchRows = batchResult.data;
  const assetRows = assetResult.data;
  const batchesReady = batchResult.availability === "ready";
  const assetsReady = assetResult.availability === "ready";
  const failedSources = [
    !batchesReady ? `batches (${batchResult.availability})` : null,
    !assetsReady ? `product-assets (${assetResult.availability})` : null,
  ].filter((source): source is string => Boolean(source));
  const plannedTags = batchRows.reduce((sum, row) => sum + Number(row.requested_quantity || row.qty || row.quantity || 0), 0);
  const importedTags = batchRows.reduce((sum, row) => sum + Number(row.imported_tags || row.quantity || row.qty || 0), 0);
  const activeTags = batchRows.reduce((sum, row) => sum + Number(row.active_tags || 0), 0);
  const inactiveTags = batchRows.reduce((sum, row) => sum + Number(row.inactive_tags || Math.max(Number(row.quantity || row.qty || 0) - Number(row.active_tags || 0), 0)), 0);
  const secureBatches = batchRows.filter((row) => String(row.carrier_profile_code || row.carrier_label || "").toLowerCase().includes("424")).length;
  const supplierBatches = batchRows.filter((row) => String(row.batch_profile || row.type || row.carrier_label || "").toLowerCase().includes("supplier") || Boolean(row.has_meta_key || row.has_file_key)).length;
  const assetScores = assetRows.map((item) => Number(item.profile?.assetScore || 0)).filter((score) => score > 0);
  const averageAssetScore = assetScores.length ? Math.round(assetScores.reduce((sum, score) => sum + score, 0) / assetScores.length) : 0;
  const realPhotoRows = assetRows.filter((item) => Boolean(item.profile?.primaryImageUrl)).length;
  const batchProductReady = batchRows.filter((row) => Boolean(row.product_name || row.sku)).length;
  const unitMetadataRows = batchRows.reduce((sum, row) => sum + Number(row.unit_metadata_rows || 0), 0);
  const iotMetadataRows = batchRows.reduce((sum, row) => sum + Number(row.iot_metadata_rows || 0), 0);
  const unitProductOverrides = batchRows.reduce((sum, row) => sum + Number(row.unit_product_overrides || 0), 0);
  const defaultOpsBid = String(batchRows.find((row) => row.bid)?.bid || (tenantScope ? "" : "BALMEC-2026-02"));
  const statusCounts = batchRows.reduce((acc, row) => {
    const status = String(row.status || "pending").toLowerCase();
    acc[status] = Number(acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const batchTenantMap = new Map<string, OpsCommandTenantRow>();
  for (const row of batchRows) {
    const slug = String(row.tenant_slug || row.tenant_id || "tenant pendiente").toLowerCase();
    const current = batchTenantMap.get(slug) || { name: slug, slug, scans: 0, riskScore: 0, batches: 0, tags: 0, status: "pending" as const };
    current.batches += 1;
    current.tags += Number(row.active_tags || row.quantity || row.qty || row.requested_quantity || 0);
    current.status = statusCounts.revoked || statusCounts.blocked ? "risk" : current.tags > 0 ? "active" : "pending";
    batchTenantMap.set(slug, current);
  }
  const opsSteps: OpsCommandStep[] = [
    {
      label: "Tenant passport completo",
      body: "Antes de importar tags, el tenant necesita rubro, origen, politica de claim, portal, marketplace y copy simple.",
      status: tenantScope || batchRows.length ? "ready" : "working",
      owner: isTenantAdmin ? "Owner" : "Super Admin",
    },
    {
      label: "Carrier y seguridad elegidos",
      body: "QR, NFC UID, NTAG424 DNA o TT deben quedar declarados para no vender seguridad que el soporte no tiene.",
      status: secureBatches > 0 ? "ready" : batchRows.length ? "working" : "blocked",
      owner: "Seguridad",
    },
    {
      label: "Manifest de unidades",
      body: "El producto vive en la ficha del lote. El manifest agrega UID, seriales, cajas, pallets, sensores y excepciones auditadas.",
      status: importedTags > 0 ? "ready" : "blocked",
      owner: "Operaciones",
    },
    {
      label: "Activacion y prueba fisica",
      body: "El operador pega una muestra, hace tap real y confirma que el producto se ve bien antes de entregar miles de unidades.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Operaciones",
    },
    {
      label: "Salida comercial",
      body: "Portal, club, NFT opcional, experiencias verificadas y marketplace quedan habilitados por politica del tenant.",
      status: activeTags > 0 && secureBatches > 0 ? "ready" : "working",
      owner: "Growth",
    },
  ];

  const rows = batchRows.map((row: Record<string, unknown>) => {
    const quantity = Number(row.quantity || 0);
    const active = Number(row.active_tags || 0);
    const inactive = Number(row.inactive_tags || 0);
    const requested = Number(row.requested_quantity || 0);
    const sku = row.sku ? String(row.sku) : "SKU pendiente";
    const productName = row.product_name ? String(row.product_name) : "Producto pendiente";
    const profile = row.batch_profile ? String(row.batch_profile) : "Perfil pendiente";
    const carrier = row.carrier_label ? String(row.carrier_label) : row.carrier_profile_code ? String(row.carrier_profile_code) : "Carrier pendiente";
    const security = row.carrier_security_level ? ` L${String(row.carrier_security_level)}` : "";
    return {
      batch: `${String(row.bid || "BID pendiente")} - ${productName}`,
      type: `${carrier}${security} - ${profile} - ${String(row.tenant_slug || "tenant pendiente")}`,
      status: String(row.status || "pending"),
      quantity: `${quantity.toLocaleString()} imported / ${requested.toLocaleString()} planned - ${active.toLocaleString()} active - ${inactive.toLocaleString()} pending - SKU ${sku}`,
    };
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <Card className="p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
      </Card>
      {failedSources.length ? (
        <EnterpriseOpsState
          variant="error"
          title="Fuentes operativas de batches no disponibles"
          description="La pantalla conserva el alcance solicitado, pero no convierte una falla del backend en inventario cero ni en un rollout bloqueado. Reintentá cuando las fuentes vuelvan a responder."
          checklist={failedSources}
          action={<Link href="/batches" className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-100">Reintentar fuentes</Link>}
          testId="batches-source-unavailable"
        />
      ) : null}
      <ModuleAudienceHero
        ceo={{
          eyebrow: "CEO / Investor read",
          summary: "Batches muestran capacidad de emision y control del inventario autenticable a escala.",
          decision: "Decidis que lineas, regiones o partners tienen capacidad lista para crecer o requieren intervencion.",
          cta: "Contalo como la capa donde el negocio se transforma en unidades emitibles y monetizables.",
        }}
        operator={{
          eyebrow: "Operator / Engineer read",
          summary: "Batches es el punto donde se crean, activan, revocan e importan lotes para operacion real.",
          decision: "Decidis que lote activar, bloquear, importar o auditar segun incidentes o rollout.",
          cta: "Leelo como el corazon operativo de emision y lifecycle.",
        }}
        buyer={{
          eyebrow: "Buyer / Client read",
          summary: "Batches demuestra que la solucion puede desplegarse por campanas, productos y mercados completos.",
          decision: "Decidis si el sistema escala desde piloto a rollout masivo sin perder control.",
          cta: "Mostralo cuando quieras hablar de implementacion real y no solo de demo.",
        }}
      />
      {batchesReady ? <OpsCommandCenter
        mode={isTenantAdmin ? "tenant" : "global"}
        title="Rollout center de batches"
        subtitle="Pensado para resellers, administradores y auditores: recibe la caja de tags, carga el manifest, valida el lote y deja el producto listo para venta sin depender de un tecnico."
        metrics={[
          { label: "Batches", value: String(batchRows.length), detail: `${supplierBatches} con llaves/perfil supplier`, tone: batchRows.length ? "good" : "warn" },
          { label: "Tags planificados", value: plannedTags.toLocaleString("es-AR"), detail: "Cantidad declarada por lote", tone: plannedTags > 0 ? "good" : "warn" },
          { label: "Tags activos", value: activeTags.toLocaleString("es-AR"), detail: `${inactiveTags.toLocaleString("es-AR")} pendientes`, tone: activeTags > 0 ? "good" : "warn" },
          { label: "Carrier premium", value: String(secureBatches), detail: "NTAG424 DNA / TT detectados", tone: secureBatches > 0 ? "good" : "warn" },
        ]}
        steps={opsSteps}
        tenants={Array.from(batchTenantMap.values())}
        funnel={[
          { stage: "Batches", value: batchRows.length },
          { stage: "Plan", value: plannedTags },
          { stage: "Import", value: importedTags },
          { stage: "Active", value: activeTags },
          { stage: "Secure", value: secureBatches },
        ]}
        readiness={[
          { label: "Manifest", ready: importedTags, pending: Math.max(plannedTags - importedTags, 0) },
          { label: "Activacion", ready: activeTags, pending: inactiveTags },
          { label: "Carrier", ready: secureBatches, pending: Math.max(batchRows.length - secureBatches, 0) },
          { label: "Supplier", ready: supplierBatches, pending: Math.max(batchRows.length - supplierBatches, 0) },
        ]}
      /> : null}
      <Card className="overflow-hidden p-0">
        <div className="dashboard-hero-panel dashboard-hero-panel--green border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Ficha de lote + metadata de unidades</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Producto y UIDs separados antes de publicar</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                La ficha comercial del lote define producto, bodega, SKU, varietal y mercado. El manifest agrega seriales,
                numeros de botella, cajas, pallets, sensores IoT y overrides solo cuando una unidad realmente es excepcion.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/onboarding" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">Cargar assets en manifest</Link>
              <Link href="/consumer-network/marketplace" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">Ver salida comercial</Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {[
              { label: "Lotes con ficha", value: batchesReady ? batchProductReady.toLocaleString("es-AR") : "—", detail: "product identity batch-level" },
              { label: "UID con metadata", value: batchesReady ? unitMetadataRows.toLocaleString("es-AR") : "—", detail: "serial, botella, caja, pallet" },
              { label: "UID con IoT", value: batchesReady ? iotMetadataRows.toLocaleString("es-AR") : "—", detail: "temperatura, humedad, logger" },
              { label: "Overrides", value: batchesReady ? unitProductOverrides.toLocaleString("es-AR") : "—", detail: "producto por UID excepcional" },
              { label: "Fotos reales", value: assetsReady ? realPhotoRows.toLocaleString("es-AR") : "—", detail: "asset visual opcional" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {assetsReady && assetScores.length
              ? `Readiness visual promedio: ${averageAssetScore}/100 sobre ${assetScores.length} perfiles con score. Objetivo enterprise: ficha de lote completa, manifest UID limpio y al menos una muestra visual aprobada por producto/lote.`
              : assetsReady
                ? "Readiness visual sin base: la fuente respondió, pero no informó scores de assets."
              : "Readiness visual no disponible: la fuente product-assets no respondió; no se infiere un puntaje cero."}
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-3">
          {(assetsReady && assetRows.length ? assetRows.slice(0, 6) : assetsReady ? [
            {
              uidMasked: "pendiente",
              tagStatus: "setup",
              tenantSlug: tenantScope || "tenant",
              bid: "sin manifest",
              assetReadiness: "0 reales / 0 demo / 5 pendientes",
              profile: {
                productName: "Primer producto del lote",
                brandName: "Marca / tenant",
                verticalLabel: "Vertical comercial",
                assetScore: null,
                uploadChecklist: ["Foto producto", "Etiqueta frontal", "Foto tag aplicado", "Ficha comercial", "Reglas claim/NFT", "Modelo GLB opcional"],
                slots: [],
              },
            },
          ] : []).map((item, index) => {
            const rawScore = item.profile?.assetScore;
            const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
            const checklist = Array.isArray(item.profile?.uploadChecklist) ? item.profile?.uploadChecklist || [] : [];
            const slots = Array.isArray(item.profile?.slots) ? item.profile?.slots || [] : [];
            return (
              <article key={`${item.bid || "asset"}-${item.uidMasked || index}`} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">{item.tenantSlug || "tenant"} / {item.bid || "batch"}</p>
                    <h3 className="mt-1 text-lg font-black text-white">{item.profile?.productName || "Producto sin nombre"}</h3>
                    <p className="mt-1 text-xs text-slate-400">{item.profile?.brandName || "Marca pendiente"} - {item.profile?.verticalLabel || "Vertical pendiente"}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${score !== null && score >= 80 ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : score !== null && score >= 55 ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : score === null ? "border-white/15 bg-white/5 text-slate-300" : "border-rose-300/30 bg-rose-500/10 text-rose-100"}`}>{score === null ? "Sin score" : `${score}/100`}</span>
                </div>
                <p className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{item.assetReadiness || "readiness pendiente"}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {slots.slice(0, 4).map((slot) => (
                    <div key={slot.id} className={`rounded-xl border px-3 py-2 text-xs ${slot.status === "ready" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : slot.status === "demo" ? "border-amber-300/25 bg-amber-500/10 text-amber-100" : "border-white/10 bg-slate-900/55 text-slate-300"}`}>
                      <b className="block text-white">{slot.label}</b>
                      <span>{slot.status}</span>
                    </div>
                  ))}
                </div>
                {!slots.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {checklist.map((label) => (
                      <span key={label} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-slate-300">{label}</span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </Card>
      {!isTenantAdmin ? (
        <Card className="p-5 text-sm text-slate-300">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Elegi modo de operacion</h2>
          <p className="mt-2 text-xs text-slate-400">Separado en dos flujos para evitar confusion: lote interno vs lote supplier programado por proveedor.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-200">Modo 1</p>
              <p className="mt-1 text-base font-semibold text-white">Create internal batch</p>
              <p className="mt-2 text-xs text-slate-300">Para lotes que nacen dentro de nexID. Puede autogenerar keys.</p>
              <Link href="/batches/internal" className="mt-3 inline-block rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Open internal flow</Link>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-amber-200">Modo 2</p>
              <p className="mt-1 text-base font-semibold text-white">Register supplier batch</p>
              <p className="mt-2 text-xs text-slate-300">Para tags programadas por proveedor. Carrier profile, pack cifrado, manifiesto y QA obligatorios.</p>
              <Link href="/batches/supplier" className="mt-3 inline-block rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Open supplier wizard</Link>
            </div>
          </div>
        </Card>
      ) : null}
      <Card className="overflow-hidden p-0">
        <div className="dashboard-hero-panel dashboard-hero-panel--cyan border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Operacion no tecnica</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-white">De caja de tags a producto vendiendo</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                Este flujo tiene que servirle a un reseller, bodega, operador de marketing o auditor: recibe tags, sube el lote,
                valida, pega, prueba un tap fisico y publica la experiencia completa sin tocar codigo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/batches/supplier" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-100">Abrir wizard proveedor</Link>
              <Link href="/loyalty/experiences" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100">Activar club/reviews</Link>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {rolloutSteps.map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/10 text-xs font-black text-cyan-100">{item.step}</span>
                <h3 className="mt-3 text-sm font-black text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 md:grid-cols-4">
          {carrierLadder.map((item) => (
            <article key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <h3 className="text-base font-black text-white">{item.label}</h3>
              <p className="mt-2 text-xs leading-5 text-emerald-100">{item.promise}</p>
              <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">{item.warning}</p>
            </article>
          ))}
        </div>
      </Card>
      <Card className="p-5 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Wizard lineal recomendado (1 - 7)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            "1) Crear tenant passport completo",
            "2) Elegir carrier profile y registrar batch proveedor",
            "3) Generar pack cifrado en servidor",
            "4) Importar TXT/CSV con preflight",
            "5) Activar tags importadas",
            "6) Validar URL /sun real",
            "7) Entregar portal y permisos al operador",
          ].map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-200">{item}</div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/batches/supplier" className="rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Abrir supplier wizard</Link>
          <Link href="/onboarding" className="rounded-lg border border-cyan-300/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Abrir onboarding guiado</Link>
        </div>
      </Card>
      {batchesReady ? <BatchSunValidator defaultBid={defaultOpsBid} canRepair={session.role === "super-admin"} /> : null}
      <QuickOnboardingPanel context="dashboard" />
      <DataTable
        title={copy.tables.batches.title}
        columns={[
          { key: "batch", label: copy.tables.batches.batch },
          { key: "type", label: copy.tables.batches.type },
          { key: "status", label: copy.tables.batches.status },
          { key: "quantity", label: copy.tables.batches.quantity },
        ]}
        rows={rows}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel={batchesReady ? copy.shell.empty : "Batches source unavailable; this is not a confirmed zero."}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
