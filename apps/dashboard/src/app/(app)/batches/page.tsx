import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { DataTable } from "../../../components/data-table";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { OpsCommandCenter, type OpsCommandStep, type OpsCommandTenantRow } from "../../../components/ops-command-center";
import { QuickOnboardingPanel } from "../../../components/quick-onboarding-panel";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";
import { requireDashboardSession } from "../../../lib/session";

const API_BASE = productUrls.api;

const rolloutSteps = [
  {
    step: "01",
    title: "Recibir tags",
    body: "El proveedor entrega QR, NFC simple o NTAG424 DNA TT con lote, remito y manifest.",
  },
  {
    step: "02",
    title: "Subir manifest",
    body: "CSV/TXT con UID, BID, SKU, carrier, producto, fotos, etiqueta, GLB y galeria si existen.",
  },
  {
    step: "03",
    title: "Preflight",
    body: "nexID valida duplicados, carrier, batch mismatch, llaves, cantidad y politica de claim.",
  },
  {
    step: "04",
    title: "Pegar y probar",
    body: "El operador pega tags, hace un tap real y confirma que /sun muestra producto, mapa y acciones.",
  },
  {
    step: "05",
    title: "Publicar",
    body: "Portal, marketplace, club, garantia, ownership, NFT y experiencias verificadas quedan listos.",
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
    promise: "SUN + estado fisico de sello abierto/cerrado.",
    warning: "Ideal para vino, cosmetica, lujo, pharma ligera y cajas premium.",
  },
];

async function getBatchRows(tenantScope = ""): Promise<Array<Record<string, unknown>>> {
  try {
    const query = tenantScope ? `?tenant=${encodeURIComponent(tenantScope)}` : "";
    const response = await fetch(`${API_BASE}/admin/batches${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [] as Array<Record<string, unknown>>;
    return response.json();
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

export default async function BatchesPage() {
  const { locale } = await getDashboardI18n();
  const session = await requireDashboardSession("batches:read");
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : "";
  const isTenantAdmin = session.role === "tenant-admin";
  const copy = dashboardContent[locale];
  const batchRows = await getBatchRows(tenantScope);
  const plannedTags = batchRows.reduce((sum, row) => sum + Number(row.requested_quantity || row.qty || row.quantity || 0), 0);
  const importedTags = batchRows.reduce((sum, row) => sum + Number(row.imported_tags || row.quantity || row.qty || 0), 0);
  const activeTags = batchRows.reduce((sum, row) => sum + Number(row.active_tags || 0), 0);
  const inactiveTags = batchRows.reduce((sum, row) => sum + Number(row.inactive_tags || Math.max(Number(row.quantity || row.qty || 0) - Number(row.active_tags || 0), 0)), 0);
  const secureBatches = batchRows.filter((row) => String(row.carrier_profile_code || row.carrier_label || "").toLowerCase().includes("424")).length;
  const supplierBatches = batchRows.filter((row) => String(row.batch_profile || row.type || row.carrier_label || "").toLowerCase().includes("supplier") || Boolean(row.has_meta_key || row.has_file_key)).length;
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
      owner: isTenantAdmin ? "Tenant" : "Superadmin",
    },
    {
      label: "Carrier y seguridad elegidos",
      body: "QR, NFC UID, NTAG424 DNA o TT deben quedar declarados para no vender seguridad que el soporte no tiene.",
      status: secureBatches > 0 ? "ready" : batchRows.length ? "working" : "blocked",
      owner: "Auditor",
    },
    {
      label: "Manifest con producto real",
      body: "UID, BID, SKU, lote, foto, etiqueta y modelo 3D deben viajar juntos para que /sun y marketplace no sean genericos.",
      status: importedTags > 0 ? "ready" : "blocked",
      owner: "Reseller",
    },
    {
      label: "Activacion y prueba fisica",
      body: "El operador pega una muestra, hace tap real y confirma que el producto se ve bien antes de entregar miles de unidades.",
      status: activeTags > 0 ? "ready" : importedTags > 0 ? "working" : "blocked",
      owner: "Tenant",
    },
    {
      label: "Salida comercial",
      body: "Portal, club, NFT opcional, experiencias verificadas y marketplace quedan habilitados por politica del tenant.",
      status: activeTags > 0 && secureBatches > 0 ? "ready" : "working",
      owner: "Superadmin",
    },
  ];

  const rows = batchRows.map((row: Record<string, unknown>) => {
    const quantity = Number(row.quantity || 0);
    const active = Number(row.active_tags || 0);
    const inactive = Number(row.inactive_tags || 0);
    const requested = Number(row.requested_quantity || 0);
    const sku = row.sku ? String(row.sku) : "SKU pendiente";
    const profile = row.batch_profile ? String(row.batch_profile) : "Perfil pendiente";
    const carrier = row.carrier_label ? String(row.carrier_label) : row.carrier_profile_code ? String(row.carrier_profile_code) : "Carrier pendiente";
    const security = row.carrier_security_level ? ` L${String(row.carrier_security_level)}` : "";
    return {
      batch: `${String(row.bid || "BID pendiente")} - ${sku}`,
      type: `${carrier}${security} - ${profile} - ${String(row.tenant_slug || "tenant pendiente")}`,
      status: String(row.status || "pending"),
      quantity: `${quantity.toLocaleString()} imported / ${requested.toLocaleString()} planned - ${active.toLocaleString()} active - ${inactive.toLocaleString()} pending`,
    };
  });

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.batches} title={copy.pages.batches.title} description={copy.pages.batches.description} />
      <Card className="p-4 text-sm text-slate-300">
        Scope actual: <b className="text-white">{tenantScope ? `tenant ${tenantScope}` : "global / multi-tenant"}</b>.
      </Card>
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
      <OpsCommandCenter
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
      />
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
              <p className="mt-2 text-xs text-slate-300">Para tags programadas por proveedor. Carrier profile + K_META_BATCH y K_FILE_BATCH obligatorias.</p>
              <Link href="/batches/supplier" className="mt-3 inline-block rounded-lg border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">Open supplier wizard</Link>
            </div>
          </div>
        </Card>
      ) : null}
      <Card className="overflow-hidden p-0">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 sm:p-6">
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
            "3) Cargar llaves K_META/K_FILE",
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
        emptyLabel={copy.shell.empty}
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
        refreshLabel={copy.shell.refresh}
        statusMap={copy.statuses}
      />
    </main>
  );
}
