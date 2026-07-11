import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  CircleAlert,
  CircleCheck,
  ClipboardCheck,
  DatabaseZap,
  ExternalLink,
  Fingerprint,
  ImagePlus,
  RadioTower,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import styles from "./pilot-launchpad.module.css";

export type PilotSnapshot = {
  tenantScope: string;
  setupComplete: boolean;
  dataState: "live" | "demo" | "partial" | "unavailable";
  availableSources: number;
  batchesAvailable: boolean;
  assetsAvailable: boolean;
  ordersAvailable: boolean;
  anchorsAvailable: boolean;
  tokenizationAvailable: boolean;
  batchCount: number;
  secureBatches: number;
  supplierManagedBatches: number;
  supplierOrderCount: number;
  supplierPlannedUnits: number;
  importedManifests: number;
  qaPassed: number;
  plannedTags: number;
  importedTags: number;
  activeTags: number;
  assetProfiles: number;
  readyAssets: number;
  averageAssetScore: number;
  proofAnchorCount: number;
  confirmedAnchors: number;
  tokenizationRequestCount: number;
  tokenizedAssets: number;
};

type PilotStageStatus = "complete" | "current" | "blocked" | "explore";

type PilotStage = {
  key: string;
  number: string;
  title: string;
  summary: string;
  status: PilotStageStatus;
  href: string;
  action: string;
  evidence: Array<{ label: string; value: string }>;
};

const stageIcons = {
  workspace: Settings2,
  supply: Boxes,
  identity: ImagePlus,
  validation: Fingerprint,
  proof: ShieldCheck,
} as const;

function formatNumber(value: number) {
  return value.toLocaleString("es-AR");
}

function stageLabel(status: PilotStageStatus) {
  if (status === "complete") return "Listo";
  if (status === "current") return "Siguiente";
  if (status === "explore") return "Explorar";
  return "Bloqueado";
}

function metricValue(value: number, available: boolean) {
  return available ? formatNumber(value) : "—";
}

function resolveStatuses(checks: boolean[]): PilotStageStatus[] {
  const firstIncomplete = checks.findIndex((complete) => !complete);
  return checks.map((complete, index) => {
    if (complete) return "complete";
    return index === firstIncomplete ? "current" : "blocked";
  });
}

function buildStages(snapshot: PilotSnapshot): PilotStage[] {
  const demoSandbox = snapshot.dataState === "demo";
  const productionEvidence = snapshot.dataState !== "demo" && snapshot.dataState !== "unavailable";
  const workspaceReady = snapshot.setupComplete;
  const supplyReady = productionEvidence
    && ((snapshot.ordersAvailable && snapshot.supplierOrderCount > 0) || (snapshot.batchesAvailable && snapshot.supplierManagedBatches > 0));
  const identityReady = productionEvidence
    && snapshot.batchesAvailable && snapshot.assetsAvailable && snapshot.importedTags > 0 && snapshot.readyAssets > 0;
  const validationReady = productionEvidence
    && snapshot.batchesAvailable && snapshot.ordersAvailable && snapshot.activeTags > 0 && snapshot.qaPassed > 0;
  const proofReady = productionEvidence
    && ((snapshot.anchorsAvailable && snapshot.confirmedAnchors > 0)
      || (snapshot.tokenizationAvailable && snapshot.tokenizedAssets > 0));
  const statuses: PilotStageStatus[] = demoSandbox
    ? [workspaceReady ? "complete" : "current", "explore", "explore", "explore", "explore"]
    : resolveStatuses([workspaceReady, supplyReady, identityReady, validationReady, proofReady]);

  return [
    {
      key: "workspace",
      number: "01",
      title: "Configurar identidad y politica",
      summary: "Vertical, origen, claim policy y permisos quedan definidos antes de emitir unidades.",
      status: statuses[0],
      href: "/settings",
      action: workspaceReady ? "Revisar workspace" : "Completar configuracion",
      evidence: [
        { label: "Scope", value: snapshot.tenantScope || "multi-tenant" },
        { label: "Setup", value: workspaceReady ? "completo" : "pendiente" },
      ],
    },
    {
      key: "supply",
      number: "02",
      title: "Preparar pedido y lote seguro",
      summary: "El Supplier Order crea sub-batches y llaves cifradas en servidor, sin exponer material secreto.",
      status: statuses[1],
      href: demoSandbox || supplyReady ? "/supplier-orders" : "/batches/supplier#supplier-order-console",
      action: demoSandbox ? "Explorar pedidos seguros" : supplyReady ? "Abrir pedidos" : "Crear pedido seguro",
      evidence: [
        { label: "Pedidos", value: metricValue(snapshot.supplierOrderCount, snapshot.ordersAvailable) },
        { label: "Lotes con Vault", value: metricValue(snapshot.supplierManagedBatches, snapshot.batchesAvailable) },
        { label: "Carrier 424", value: metricValue(snapshot.secureBatches, snapshot.batchesAvailable) },
      ],
    },
    {
      key: "identity",
      number: "03",
      title: "Cargar manifest e identidad visual",
      summary: "UIDs, producto, seriales y fotos reales se validan antes de publicar el passport.",
      status: statuses[2],
      href: demoSandbox || snapshot.importedTags > 0 ? "/tokenization" : "/batches/supplier#supplier-order-console",
      action: demoSandbox ? "Explorar identidad y assets" : snapshot.importedTags > 0 ? "Completar assets" : "Importar manifest",
      evidence: [
        { label: "UID importados", value: metricValue(snapshot.importedTags, snapshot.batchesAvailable) },
        { label: "Assets listos (ventana)", value: snapshot.assetsAvailable ? `${formatNumber(snapshot.readyAssets)}/${formatNumber(snapshot.assetProfiles)}` : "—" },
        { label: "Score visual", value: snapshot.assetsAvailable ? `${snapshot.averageAssetScore}/100` : "—" },
      ],
    },
    {
      key: "validation",
      number: "04",
      title: "Validar muestra fisica",
      summary: "QA, tap real, SUN y anti-replay demuestran que el lote funciona antes del despliegue masivo.",
      status: statuses[3],
      href: "/batches",
      action: demoSandbox ? "Explorar validacion fisica" : validationReady ? "Revisar validaciones" : "Probar lote y tap",
      evidence: [
        { label: "QA aprobado", value: metricValue(snapshot.qaPassed, snapshot.ordersAvailable) },
        { label: "Tags activos", value: metricValue(snapshot.activeTags, snapshot.batchesAvailable) },
        { label: "Planificados", value: metricValue(snapshot.plannedTags || snapshot.supplierPlannedUnits, snapshot.batchesAvailable || snapshot.ordersAvailable) },
      ],
    },
    {
      key: "proof",
      number: "05",
      title: "Abrir prueba y salida comercial",
      summary: "IOTA prueba evidencia; Polygon prueba ownership cuando aplica. El cliente ve una experiencia simple, no hashes sueltos.",
      status: statuses[4],
      href: demoSandbox || proofReady ? "/proof" : "/tokenization",
      action: demoSandbox ? "Explorar centro de Proof" : proofReady ? "Abrir centro de Proof" : "Preparar evidencia",
      evidence: [
        { label: "Anchors confirmados", value: snapshot.anchorsAvailable ? `${formatNumber(snapshot.confirmedAnchors)}/${formatNumber(snapshot.proofAnchorCount)}` : "—" },
        { label: "Ownership (ventana)", value: snapshot.tokenizationAvailable ? `${formatNumber(snapshot.tokenizedAssets)}/${formatNumber(snapshot.tokenizationRequestCount)}` : "—" },
      ],
    },
  ];
}

export function PilotLaunchpad({ snapshot, role }: { snapshot: PilotSnapshot; role: string }) {
  const stages = buildStages(snapshot);
  const completed = stages.filter((stage) => stage.status === "complete").length;
  const currentStage = stages.find((stage) => stage.status === "current")
    || stages.find((stage) => stage.status === "explore")
    || stages[stages.length - 1];
  const progress = Math.round((completed / stages.length) * 100);
  const dataLabel = snapshot.dataState === "live"
    ? "Datos operativos en vivo"
    : snapshot.dataState === "demo"
      ? "Sandbox aislado"
    : snapshot.dataState === "partial"
      ? "Lectura parcial"
      : "Telemetria no disponible";

  return (
    <section className={styles.launchpad} data-testid="pilot-launchpad" aria-labelledby="pilot-launchpad-title">
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>
              <RadioTower aria-hidden="true" />
              Control de rollout
            </span>
            <span className={styles.dataState} data-state={snapshot.dataState}>
              <span aria-hidden="true" />
              {dataLabel} - {snapshot.availableSources}/5 fuentes
            </span>
          </div>
          <h2 id="pilot-launchpad-title">Del setup a una prueba vendible, con un proximo paso claro.</h2>
          <p>
            Este panel no marca tareas por relato. Lee el estado disponible del {snapshot.tenantScope ? `tenant ${snapshot.tenantScope}` : "workspace global"}{" "}
            y distingue produccion de sandbox antes de prometer un piloto listo.
          </p>
          <div className={styles.progressBlock}>
            <div className={styles.progressLabel}>
              <span>{completed} de {stages.length} etapas listas</span>
              <strong>{progress}%</strong>
            </div>
            <div className={styles.progressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Avance del piloto">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <aside className={styles.nextAction} aria-label="Siguiente accion recomendada">
          <span className={styles.nextActionLabel}>Siguiente accion recomendada</span>
          <div className={styles.nextActionTitle}>
            <span>{currentStage.number}</span>
            <strong>{currentStage.title}</strong>
          </div>
          <p>{currentStage.summary}</p>
          <Link href={currentStage.href} className={styles.primaryAction} data-testid="pilot-primary-action">
            {currentStage.action}
            <ArrowRight aria-hidden="true" />
          </Link>
          <small>
            {snapshot.dataState === "demo"
              ? "Sandbox de solo lectura: explora el flujo sin escribir sobre datos productivos."
              : role === "tenant-admin"
                ? "Accion limitada al tenant de la sesion."
                : "Vista global: valida el tenant antes de mutar datos."}
          </small>
        </aside>
      </div>

      <div className={styles.metrics} aria-label="Resumen operativo del piloto">
        <div>
          <span>Inventario</span>
          <strong>{metricValue(snapshot.activeTags, snapshot.batchesAvailable)}</strong>
          <small>{snapshot.batchesAvailable ? `tags activos de ${formatNumber(snapshot.plannedTags || snapshot.supplierPlannedUnits)} planificados` : "fuente de lotes no disponible"}</small>
        </div>
        <div>
          <span>Identidad visual</span>
          <strong>{snapshot.assetsAvailable ? `${snapshot.averageAssetScore}/100` : "—"}</strong>
          <small>{snapshot.assetsAvailable ? `${formatNumber(snapshot.readyAssets)} perfiles listos en ventana (max. 80)` : "fuente de assets no disponible"}</small>
        </div>
        <div>
          <span>Prueba IOTA</span>
          <strong>{metricValue(snapshot.confirmedAnchors, snapshot.anchorsAvailable)}</strong>
          <small>{snapshot.anchorsAvailable ? "anchors confirmados y auditables" : "fuente de anchors no disponible"}</small>
        </div>
        <div>
          <span>Ownership Polygon</span>
          <strong>{metricValue(snapshot.tokenizedAssets, snapshot.tokenizationAvailable)}</strong>
          <small>{snapshot.tokenizationAvailable ? "activos con transaccion en ventana (max. 80)" : "fuente de tokenizacion no disponible"}</small>
        </div>
      </div>

      <div className={styles.workflow}>
        <div className={styles.stageList} aria-label="Etapas del piloto">
          {stages.map((stage) => {
            const Icon = stageIcons[stage.key as keyof typeof stageIcons];
            const StatusIcon = stage.status === "complete" ? CircleCheck : stage.status === "current" || stage.status === "explore" ? DatabaseZap : CircleAlert;
            return (
              <article
                key={stage.key}
                className={styles.stage}
                data-status={stage.status}
                aria-current={stage.status === "current" ? "step" : undefined}
              >
                <div className={styles.stageIcon} aria-hidden="true">
                  <Icon />
                </div>
                <div className={styles.stageBody}>
                  <div className={styles.stageTitleRow}>
                    <span>{stage.number}</span>
                    <h3>{stage.title}</h3>
                    <b data-status={stage.status}>
                      <StatusIcon aria-hidden="true" />
                      {stageLabel(stage.status)}
                    </b>
                  </div>
                  <p>{stage.summary}</p>
                  <dl className={styles.evidence}>
                    {stage.evidence.map((item) => (
                      <div key={item.label}>
                        <dt>{item.label}</dt>
                        <dd>{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {stage.status === "blocked" ? (
                  <span className={`${styles.stageAction} ${styles.disabledAction}`} aria-disabled="true">
                    <span>{stage.action}</span>
                  </span>
                ) : (
                  <Link href={stage.href} className={styles.stageAction} aria-label={`${stage.action}: ${stage.title}`}>
                    <span>{stage.action}</span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </article>
            );
          })}
        </div>

        <aside className={styles.trustGuide} aria-label="Responsabilidad de cada capa">
          <div className={styles.trustGuideHeader}>
            <BadgeCheck aria-hidden="true" />
            <div>
              <span>Lectura ejecutiva</span>
              <h3>Que prueba cada capa</h3>
            </div>
          </div>
          <div className={styles.trustRow}>
            <Fingerprint aria-hidden="true" />
            <div><strong>nexID Core</strong><p>Identidad, reglas, tap, QA y experiencia del producto.</p></div>
          </div>
          <div className={styles.trustRow}>
            <DatabaseZap aria-hidden="true" />
            <div><strong>IOTA</strong><p>Incluye hashes y Merkle roots como evidencia publica hash-only.</p></div>
          </div>
          <div className={styles.trustRow}>
            <ShieldCheck aria-hidden="true" />
            <div><strong>Polygon</strong><p>Emite ownership, garantia o NFT cuando el caso comercial lo requiere.</p></div>
          </div>
          <Link href="/demo-lab" className={styles.secondaryAction}>
            Ver experiencia para cliente
            <ExternalLink aria-hidden="true" />
          </Link>
          <div className={styles.privacyNote}>
            <ClipboardCheck aria-hidden="true" />
            <p>La evidencia publica no expone UIDs, llaves, contratos privados ni datos personales.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
