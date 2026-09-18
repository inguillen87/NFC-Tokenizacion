import { RollProductIdentity } from "../../../../components/roll-product-identity";
import { BatchDossierShell } from "../../../../components/batch-dossier-shell";
import { BatchUnitEvidence } from "../../../../components/batch-unit-evidence";
import { BatchDossierReadings } from "../../../../components/batch-dossier-readings";
import { RollManifestIntake } from "../../../../components/roll-manifest-intake";
import { buildBatchDossier } from "../../../../lib/batch-dossier-model";
import styles from "../../../../components/batch-dossier.module.css";
import { dashboardSessionCanOpenDestination } from "../../../../lib/dashboard-destination-guard";
import Link from "next/link";
import { SectionHeading } from "@product/ui";
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
import { dashboardHighImpactPermissionMatches, dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { BatchConfigFormClient } from "./batch-config-form-client";
import { BatchLifecycleControl } from "./batch-lifecycle-control";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function selectBatch(payload: unknown): BatchSummary | null {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.batch)) return null;
  return payload.batch as BatchSummary;
}

async function getBatch(context: AdminPageContext, bid: string): Promise<AdminResourceReadResult<BatchSummary>> {
  try {
    const response = await fetchAdminPage(context, `batches/${encodeURIComponent(bid)}/summary`, {signal:AbortSignal.timeout(12000)});
    const result = await readAdminResourceResponse(response, selectBatch);
    if (result.availability !== "ready") return result;

    if (String(result.data.bid || "") !== bid) return adminResourceFailure("scope_mismatch", result.status);
    const normalizedTenantScope = context.tenantSlug;
    const batchTenantSlug = String(result.data.tenant_slug || "").trim().toLowerCase();
    if (normalizedTenantScope && batchTenantSlug !== normalizedTenantScope) {
      return adminResourceFailure("scope_mismatch", result.status);
    }
    if (!buildBatchDossier(result.data, bid, normalizedTenantScope, new Date().toISOString())) return adminResourceFailure("invalid_payload", result.status);
    return result;
  } catch {
    return adminResourceFailure("unreachable");
  }
}

function Fact({label,value}:{label:string;value:unknown}) {
  return <div><dt>{label}</dt><dd>{text(value,"No informado")}</dd></div>;
}

export default async function BatchDetailPage({ params }: { params: Promise<{ bid: string }> }) {
  const session = await requireDashboardSession("batches:read");
  const { bid } = await params;
  const canManageLifecycle = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "batch.lifecycle",
    session.deniedPermissions,
  );
  const canRevoke = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "batch.revoke",
    session.deniedPermissions,
  );
  const canConfigureProduct = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "batch.product.configure",
    session.deniedPermissions,
  );
  const adminContext = await createAdminPageContext(session);
  const batch = await getBatch(adminContext, bid);
  const batchData = batch.data;
  const product = batchData?.product_identity || {};
  const unit = batchData?.unit_metadata || {};
  const samples = Array.isArray(unit.samples) ? unit.samples : [];
  const tenantSlug = text(batchData?.tenant_slug, "tenant");
  const firstUid = samples[0]?.uid_hex || "";
  const publicMobile = firstUid
    ? `${productUrls.web}/demo-lab/mobile/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(String(firstUid))}?pack=${encodeURIComponent(text(product.sku || batchData?.sku, "batch"))}&bid=${encodeURIComponent(bid)}&demoMode=consumer_tap`
    : "";
  const carrierAdminCopy = formatCarrierAdminCopy(batchData?.carrier_admin_copy);
  const sdmConfig = (batchData?.sdm_config && typeof batchData.sdm_config === "object") ? (batchData.sdm_config as Record<string, any>) : {};
  const sunProduct = sdmConfig.sun?.product || {};
  const sunOrigin = sdmConfig.sun?.origin || {};
  const sunTelemetry = sdmConfig.sun?.telemetry || {};
  const publicLotLabel = String(
    sdmConfig.public_lot_label
      ?? sdmConfig.lot
      ?? sdmConfig.batch_lot
      ?? sdmConfig.lot_number
      ?? "",
  ).trim();

  const initialFormData = {
    public_lot_label: publicLotLabel,
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

  if (batch.availability !== "ready" || !batchData) {
    return <main className="space-y-6"><SectionHeading eyebrow="Expediente del lote" title={bid} description="La fuente debe confirmar este lote antes de mostrar datos o habilitar acciones." />
      {batch.availability === "not_found" ? <EnterpriseOpsState variant="empty" title="Batch no encontrado en este scope" description="La API confirmó HTTP 404 para este BID y el alcance actual. Revisá el identificador antes de registrar otro lote." action={<Link prefetch={false} href="/batches">Volver a lotes</Link>} testId="batch-detail-not-found" />
      : <EnterpriseOpsState variant="error" title="No se pudo cargar el lote" description="La fuente administrativa no entregó un resultado confiable. Este estado no significa que el BID no exista ni representa métricas en cero." checklist={[`Estado: ${batch.availability}`]} action={<Link prefetch={false} href={`/batches/${encodeURIComponent(bid)}`}>Reintentar lectura</Link>} testId="batch-detail-source-unavailable" />}
    </main>;
  }
  const dossier = buildBatchDossier(batchData,bid,adminContext.tenantSlug,new Date().toISOString());
  if (!dossier) return <EnterpriseOpsState variant="error" title="Expediente sin confirmar" description="La respuesta no confirmó un lote y una empresa coherentes." testId="batch-detail-source-unavailable" />;
  const access = {
    configure:canConfigureProduct, import:dashboardPermissionMatches(session.permissions,"manifest.import",session.deniedPermissions),
    lifecycle:canManageLifecycle, revoke:canRevoke, demo:Boolean(session.isDemo),
    events:dashboardSessionCanOpenDestination(session,"events"), map:dashboardSessionCanOpenDestination(session,"map"),
    supplier:dashboardSessionCanOpenDestination(session,"supplierBatches"), tags:dashboardSessionCanOpenDestination(session,"tags"),
  };
  const productPanel = <div className={styles.stack}>
    <section id="roll-product-summary" className={styles.card}><h2>Ficha compartida por todas las unidades</h2><p>Identidad comercial declarada para el lote. No modifica la autenticidad del chip ni la evidencia de apertura.</p>
      <dl className={styles.facts}><Fact label="Producto" value={dossier.name}/><Fact label="Lote comercial visible" value={publicLotLabel || "No configurado"}/><Fact label="SKU" value={dossier.sku}/><Fact label="Marca / fabricante" value={dossier.brand}/><Fact label="Región declarada" value={dossier.region}/><Fact label="Mercado" value={product.target_market}/></dl>
    </section>
    {canConfigureProduct ? <>
      <p className={styles.note}>Los cambios sin guardar se conservan al alternar secciones. Recargar o salir no los guarda: confirmá antes de hacerlo.</p>
      <RollProductIdentity bid={bid} initial={{product_name: initialFormData.product_name || "", public_lot_label: initialFormData.public_lot_label || "", sku: initialFormData.sku || "", winery: initialFormData.winery || "", region: initialFormData.region || "", image_url: initialFormData.image_url || ""}} />
      <details className={styles.card}><summary>Ficha específica de vinos y telemetría ilustrativa</summary><p className={styles.note}>Se conservan los campos propios de este rubro. Un valor ilustrativo no es una medición de un sensor.</p><BatchConfigFormClient key={JSON.stringify(initialFormData)} bid={bid} initialData={initialFormData}/></details>
    </> : <p className={styles.notice}>Tu rol puede consultar la ficha, pero no editarla. El administrador gestiona el permiso batch.product.configure.</p>}
  </div>;
  const unitsPanel = <div className={styles.stack}>
    {dossier.imported===null?<p className={styles.notice}>La recepción está pausada en esta vista hasta confirmar el conteo de unidades del lote.</p>:<RollManifestIntake key={bid} bid={bid} canImport={access.import&&!access.demo} alreadyRegistered={dossier.imported>0}/>}
    <BatchUnitEvidence model={dossier}/>
  </div>;
  const operationsPanel = <div className={styles.stack}>
    <section className={styles.card}><h2>Operación con permisos separados</h2><p>Consultar, editar producto, importar, cambiar estado y revocar son acciones diferentes. El backend conserva la autorización y los controles correspondientes.</p><dl className={styles.facts}><Fact label="Perfil NFC" value={dossier.carrier}/><Fact label="Estado informado" value={batchData.status}/><Fact label="Referencia Meta" value={dossier.hasMetaKey===null?"No informada":dossier.hasMetaKey?"Registrada":"No registrada"}/><Fact label="Referencia File" value={dossier.hasFileKey===null?"No informada":dossier.hasFileKey?"Registrada":"No registrada"}/></dl>{carrierAdminCopy&&<p className={styles.notice}>{carrierAdminCopy}</p>}</section>
    {canManageLifecycle || canRevoke ? (dossier.status ? <BatchLifecycleControl bid={bid} currentState={dossier.status} canManageLifecycle={canManageLifecycle} canRevoke={canRevoke}/> : <p className={styles.notice}>La fuente no informó el estado actual. No se supone un borrador ni se habilita una transición a ciegas.</p>) : <p className={styles.notice}>Tu cuenta no tiene permisos para cambiar el estado o revocar este lote.</p>}
    <section className={styles.card}><h2>Calidad, diagnóstico y continuidad</h2><p>La aceptación física requiere su protocolo y actores autorizados. Un TAP autenticado no aprueba automáticamente un rollo ni demuestra una transferencia de propiedad.</p><div className={styles.actions}>
      {access.supplier&&<Link prefetch={false} className={styles.button} href="/batches/supplier#supplier-order-console">Abrir protocolo de calidad</Link>}
      {access.tags&&<Link prefetch={false} className={styles.button} href="/tags">Inventario de etiquetas</Link>}
      {access.events&&<Link prefetch={false} className={styles.button} href="/events">Auditoría de eventos</Link>}
      {publicMobile&&<a className={styles.button} href={publicMobile} target="_blank" rel="noreferrer">Vista ilustrativa del producto · no es un TAP</a>}
    </div></section>
    <details id="roll-physical-check" className={styles.card}><summary>Verificador técnico SUN · uso autorizado</summary><p className={styles.note}>Usá una lectura nueva para el diagnóstico. Esta herramienta no sustituye el protocolo de calidad ni modifica claves.</p>{access.events ? <BatchSunValidator bid={bid} canRepair={false}/> : <p className={styles.notice}>La cuenta no tiene acceso al diagnóstico de eventos sensibles.</p>}</details>
  </div>;
  return <BatchDossierShell key={`${dossier.tenant}:${bid}`} model={dossier} access={access} product={productPanel} units={unitsPanel} readings={<BatchDossierReadings key={`${dossier.tenant}:${bid}`} bid={bid} tenant={dossier.tenant} allowed={access.events} canMap={access.map} demo={access.demo}/>} operations={operationsPanel}/>;
}
