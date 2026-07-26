import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { BatchSunValidator } from "../../../../components/batch-sun-validator";
import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";
import {
  adminResourceFailure,
  readAdminResourceResponse,
  type AdminResourceReadResult,
} from "../../../../lib/admin-resource-read";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { BatchConfigFormClient } from "./batch-config-form-client";

type UnitSample = {
  uid_hex?: string | null;
  status?: string | null;
  carrier_profile_code?: string | null;
  product_override?: boolean | null;
  product_name?: string | null;
  sku?: string | null;
  lot?: string | null;
  serial?: string | null;
  unit_metadata?: Record<string, unknown> | null;
  iot?: Record<string, unknown> | null;
  updated_at?: string | null;
};

type BatchSummary = Record<string, unknown> & {
  bid?: string;
  status?: string;
  tenant_slug?: string;
  product_identity?: Record<string, unknown>;
  unit_metadata?: {
    tag_profile_rows?: number;
    unit_metadata_rows?: number;
    iot_metadata_rows?: number;
    unit_product_overrides?: number;
    samples?: UnitSample[];
  };
  manifests?: Array<Record<string, unknown>>;
};

function text(value: unknown, fallback = "-") {
  const output = String(value || "").trim();
  return output || fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown) {
  return numberValue(value).toLocaleString("es-AR");
}

function formatCarrierAdminCopy(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);
  const copy = value as Record<string, unknown>;
  return [
    copy.positioning ? `Posicionamiento: ${String(copy.positioning)}` : "",
    copy.bestFor ? `Ideal para: ${String(copy.bestFor)}` : "",
    copy.avoid ? `No prometer: ${String(copy.avoid)}` : "",
  ].filter(Boolean).join(" ");
}

function maskUid(uid: unknown) {
  const raw = String(uid || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (!raw) return "-";
  if (raw.length <= 8) return `${raw.slice(0, 4)}****`;
  return `${raw.slice(0, 4)}****${raw.slice(-4)}`;
}

function objectEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [] as Array<[string, unknown]>;
  return Object.entries(value as Record<string, unknown>).filter(([, entry]) => String(entry ?? "").trim() !== "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function selectBatch(payload: unknown): BatchSummary | null {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.batch)) return null;
  return payload.batch as BatchSummary;
}

async function getBatch(context: AdminPageContext, bid: string): Promise<AdminResourceReadResult<BatchSummary>> {
  try {
    const response = await fetchAdminPage(context, `batches/${encodeURIComponent(bid)}/summary`);
    const result = await readAdminResourceResponse(response, selectBatch);
    if (result.availability !== "ready") return result;

    const normalizedTenantScope = context.tenantSlug;
    const batchTenantSlug = String(result.data.tenant_slug || "").trim().toLowerCase();
    if (normalizedTenantScope && batchTenantSlug !== normalizedTenantScope) {
      return adminResourceFailure("scope_mismatch", result.status);
    }
    return result;
  } catch {
    return adminResourceFailure("unreachable");
  }
}

function Fact({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-white">{text(value)}</dd>
    </div>
  );
}

function Metric({ label, value, detail, tone = "neutral" }: { label: string; value: unknown; detail: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "good"
    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
    : tone === "warn"
      ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : tone === "bad"
        ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
        : "border-white/10 bg-slate-950/55 text-slate-200";
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-75">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{typeof value === "number" ? formatNumber(value) : text(value)}</p>
      <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

export default async function BatchDetailPage({ params }: { params: Promise<{ bid: string }> }) {
  const session = await requireDashboardSession("batches:read");
  const { bid } = await params;
  const adminContext = await createAdminPageContext(session);
  const batch = await getBatch(adminContext, bid);
  const batchData = batch.data;
  const product = batchData?.product_identity || {};
  const unit = batchData?.unit_metadata || {};
  const samples = Array.isArray(unit.samples) ? unit.samples : [];
  const manifests = Array.isArray(batchData?.manifests) ? batchData?.manifests || [] : [];
  const tenantSlug = text(batchData?.tenant_slug, "tenant");
  const firstUid = samples[0]?.uid_hex || "";
  const publicMobile = firstUid
    ? `${productUrls.web}/demo-lab/mobile/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(String(firstUid))}?pack=${encodeURIComponent(text(product.sku || batchData?.sku, "batch"))}&bid=${encodeURIComponent(bid)}&demoMode=consumer_tap`
    : "";
  const carrierAdminCopy = formatCarrierAdminCopy(batchData?.carrier_admin_copy);
  const imported = numberValue(batchData?.imported_tags);
  const active = numberValue(batchData?.active_tags);
  const overrides = numberValue(unit.unit_product_overrides);
  const sdmConfig = (batchData?.sdm_config && typeof batchData.sdm_config === "object") ? (batchData.sdm_config as Record<string, any>) : {};
  const sunProduct = sdmConfig.sun?.product || {};
  const sunOrigin = sdmConfig.sun?.origin || {};
  const sunTelemetry = sdmConfig.sun?.telemetry || {};

  const initialFormData = {
    product_name: product.product_name || sdmConfig.product_name || sunProduct.name || "",
    sku: product.sku || sdmConfig.sku || sunProduct.sku || "",
    winery: product.winery || sdmConfig.winery || sunProduct.producer || "",
    region: product.region || sdmConfig.region || sunOrigin.region || "",
    grape_varietal: product.grape_varietal || sdmConfig.grape_varietal || sunProduct.varietal || "",
    vintage: product.vintage || sdmConfig.vintage || sunProduct.vintage || "",
    harvest_year: product.harvest_year || sdmConfig.harvest_year || sunProduct.harvestYear || "",
    barrel_months: product.barrel_months || sdmConfig.barrel_months || sunProduct.barrelMonths || "",
    temperature_storage: product.temperature_storage || sdmConfig.temperature_storage || sunProduct.storage || "",
    image_url: product.image_url || sdmConfig.image_url || sunProduct.imageUrl || "",
    target_market: product.target_market || sdmConfig.target_market || "",
    altitude: sunOrigin.altitude || "",
    oak_type: sunProduct.oakType || "",
    alcohol: sunProduct.alcohol || "",
    bottle: sunProduct.bottle || "",
    serving: sunProduct.serving || "",
    notes: sunProduct.notes || sunProduct.tasting_notes || "",
    maridaje: sunProduct.maridaje || "",
    simulated_temp_c: sunTelemetry.simulatedTempC || sunProduct.simulatedTempC || "",
    simulated_humidity_pct: sunTelemetry.simulatedHumidityPct || sunProduct.simulatedHumidityPct || "",
    simulated_light: sunTelemetry.simulatedLight || sunProduct.simulatedLight || "",
    simulated_shock: sunTelemetry.simulatedShock || sunProduct.simulatedShock || "",
  };

  return (
    <main className="space-y-8">
      <SectionHeading
        eyebrow="Batch CRM"
        title={bid}
        description="Separacion operativa: la ficha del lote define el producto; el manifest define UID, seriales, sensores y excepciones por unidad."
      />
      {batch.availability === "not_found" ? (
        <EnterpriseOpsState
          variant="empty"
          title="Batch no encontrado en este scope"
          description="La API confirmó HTTP 404 para este BID y el alcance actual. Revisá el identificador o el tenant antes de registrar un lote nuevo."
          action={<Link href="/batches" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Volver a batches</Link>}
          testId="batch-detail-not-found"
        />
      ) : batch.availability !== "ready" ? (
        <EnterpriseOpsState
          variant="error"
          title="No se pudo cargar el batch"
          description="La fuente administrativa no entregó un resultado confiable. Este estado no significa que el BID no exista ni representa métricas en cero."
          checklist={[
            `Estado de lectura: ${batch.availability}`,
            batch.status ? `Respuesta upstream: HTTP ${batch.status}` : "La fuente no respondió",
          ]}
          action={<Link href={`/batches/${encodeURIComponent(bid)}`} className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100">Reintentar lectura</Link>}
          testId="batch-detail-source-unavailable"
        />
      ) : !batchData ? null : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Metric label="Tenant" value={tenantSlug} detail="Scope comercial del lote." tone="neutral" />
            <Metric label="Tags importados" value={imported} detail={`${formatNumber(active)} activos ahora.`} tone={imported ? "good" : "warn"} />
            <Metric label="Metadata unidad" value={unit.unit_metadata_rows || 0} detail="Seriales, botellas, cajas, pallets." tone={numberValue(unit.unit_metadata_rows) ? "good" : "neutral"} />
            <Metric label="IoT / sensores" value={unit.iot_metadata_rows || 0} detail="Humedad, temperatura, logger, shock." tone={numberValue(unit.iot_metadata_rows) ? "good" : "neutral"} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Ficha de lote / producto</p>
                  <h2 className="mt-2 text-2xl font-black text-white">{text(product.product_name || batchData.product_name, "Producto pendiente")}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                    Esta ficha aplica a todos los UIDs del batch. Un UID solo cambia producto si existe un override explicito y auditado.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-100">source: batch</span>
              </div>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Fact label="SKU" value={product.sku || batchData.sku} />
                <Fact label="Bodega / marca" value={product.winery} />
                <Fact label="Region" value={product.region} />
                <Fact label="Varietal" value={product.grape_varietal} />
                <Fact label="Vintage" value={product.vintage} />
                <Fact label="Mercado" value={product.target_market} />
                <Fact label="Cosecha" value={product.harvest_year} />
                <Fact label="Barrica" value={product.barrel_months ? `${text(product.barrel_months)} meses` : ""} />
                <Fact label="Guarda" value={product.temperature_storage} />
              </dl>
              {overrides ? (
                <p className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100">
                  Hay {formatNumber(overrides)} overrides de producto por UID. Usalos solo para excepciones comerciales, no para representar botellas normales del mismo lote.
                </p>
              ) : (
                <p className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
                  Sin overrides de producto por UID: arquitectura correcta para lotes de miles de botellas con una ficha comun.
                </p>
              )}
            </Card>

            <Card className="p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Seguridad del lote</p>
              <h2 className="mt-2 text-xl font-black text-white">{text(batchData.carrier_label || batchData.carrier_profile_code, "Carrier pendiente")}</h2>
              <dl className="mt-5 space-y-4">
                <Fact label="Status" value={batchData.status} />
                <Fact label="Security level" value={batchData.carrier_security_level ? `L${text(batchData.carrier_security_level)}` : ""} />
                <Fact label="Profile" value={batchData.batch_profile || "custom"} />
                <Fact label="Chip model" value={batchData.chip_model || batchData.type} />
                <Fact label="Cantidad planificada" value={formatNumber(batchData.requested_quantity)} />
                <Fact label="Keys cargadas" value={batchData.has_meta_key || batchData.has_file_key ? "si" : "pendiente"} />
              </dl>
              {carrierAdminCopy ? (
                <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-xs leading-5 text-cyan-100">
                  {carrierAdminCopy}
                </div>
              ) : null}
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Metadata de unidades / IoT / manifest</p>
                <h2 className="mt-2 text-2xl font-black text-white">UIDs fisicos sin mezclar identidad comercial</h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                  Aca vive lo variable por botella: UID, numero de etiqueta, caja, pallet, sensor logger, humedad, temperatura y archivo importado.
                </p>
              </div>
              <Link href="/batches/supplier" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100">Importar manifest</Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <Metric label="Tag profiles" value={unit.tag_profile_rows || 0} detail="Filas con metadata adicional." tone={numberValue(unit.tag_profile_rows) ? "good" : "neutral"} />
              <Metric label="Overrides producto" value={overrides} detail="Excepciones por UID." tone={overrides ? "warn" : "good"} />
              <Metric label="Manifests" value={manifests.length} detail="Ultimas cargas auditadas." tone={manifests.length ? "good" : "neutral"} />
              <Metric label="Pendientes" value={Math.max(imported - active, 0)} detail="Importadas no activas." tone={imported - active > 0 ? "warn" : "good"} />
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr] gap-3 border-b border-white/10 bg-slate-950/70 px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                <span>UID / estado</span>
                <span>Unidad</span>
                <span>IoT</span>
                <span>Notas</span>
              </div>
              {samples.length ? samples.map((sample) => {
                const unitEntries = objectEntries(sample.unit_metadata).slice(0, 3);
                const iotEntries = objectEntries(sample.iot).slice(0, 3);
                return (
                  <div key={`${sample.uid_hex}-${sample.serial}`} className="grid grid-cols-[1.1fr_0.8fr_1fr_1fr] gap-3 border-b border-white/10 px-4 py-3 text-xs text-slate-300 last:border-b-0">
                    <div>
                      <b className="block font-mono text-white">{maskUid(sample.uid_hex)}</b>
                      <span className="mt-1 block text-slate-500">{text(sample.status)} / {text(sample.carrier_profile_code, "carrier batch")}</span>
                    </div>
                    <div>
                      <b className="block text-white">{text(sample.serial || sample.lot, "sin serial")}</b>
                      {unitEntries.map(([key, value]) => <span key={key} className="block text-slate-500">{key}: {text(value)}</span>)}
                    </div>
                    <div>
                      {iotEntries.length ? iotEntries.map(([key, value]) => <span key={key} className="block text-cyan-100">{key}: {text(value)}</span>) : <span className="text-slate-500">sin sensor</span>}
                    </div>
                    <div>
                      {sample.product_override ? (
                        <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-100">override: {text(sample.product_name || sample.sku)}</span>
                      ) : (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-100">usa ficha del lote</span>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <p className="px-4 py-6 text-sm text-slate-400">Sin muestras de UID todavia. Importa un manifest para ver seriales, IoT y excepciones.</p>
              )}
            </div>
          </Card>
          
          <BatchConfigFormClient bid={bid} initialData={initialFormData} />

          <Card className="p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Ops next</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                "Completar ficha comercial del lote antes de importar miles de UIDs.",
                "Importar manifest UID-only o con metadata unidad/IoT sin copiar producto por fila.",
                "Activar tags y probar un tap fisico real del batch.",
                "Revisar que claim/ownership solo se habilite con compra, POS, PIN o aprobacion.",
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm leading-6 text-slate-300">{item}</div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/batches" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Volver a batches</Link>
              <Link href="/batches/supplier" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">Abrir supplier flow</Link>
              <Link href="/tags" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open tags</Link>
              <Link href="/events" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Open events</Link>
              {publicMobile ? <a href={publicMobile} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">Preview mobile del primer UID</a> : null}
            </div>
            <div className="mt-6">
              <BatchSunValidator bid={bid} />
            </div>
          </Card>
        </>
      )}
    </main>
  );
}
