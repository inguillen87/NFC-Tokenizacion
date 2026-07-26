import { productUrls, withPath } from "@product/config";
import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  CircleAlert,
  Database,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Hash,
  Link2,
  Network,
  PlusCircle,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { dashboardPermissionMatches } from "../../../lib/permission-policy";
import { requireDashboardSession } from "../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../lib/admin-page-access";
import styles from "./page.module.css";

const PUBLIC_VERIFY_URL = withPath(productUrls.web, "/proof/verify");
const PUBLIC_OWNERSHIP_URL = withPath(productUrls.web, "/proof/ownership");
const PUBLIC_DEMO_LAB_URL = withPath(productUrls.web, "/demo-lab");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DataMode = "production" | "demo" | "unavailable";

type FetchResult<T> = {
  ok: boolean;
  value: T;
  mode: DataMode;
};

type ProofAnchor = {
  id?: string | null;
  provider?: string | null;
  network?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  merkle_root?: string | null;
  event_count?: number | string | null;
  event_hashes_json?: unknown;
  event_hashes?: unknown;
  event_hash?: string | null;
  first_event_hash?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  status?: string | null;
  proof_id?: string | null;
  memo_hash?: string | null;
  confirmations?: number | string | null;
  anchored_at?: string | null;
  created_at?: string | null;
};

type ProofEvent = {
  id?: string | null;
  anchor_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  event_type?: string | null;
  payload_hash?: string | null;
  event_hash?: string | null;
  hash?: string | null;
  created_at?: string | null;
};

type TokenizationRequest = {
  status?: string | null;
  network?: string | null;
  tx_hash?: string | null;
  meta?: {
    evidence_verified?: boolean;
  } | null;
};

type PublicProofReceipt = {
  tx_hash?: string | null;
  explorer_url?: string | null;
  certificate_url?: string | null;
  status?: string | null;
};

type PublicProofCase = {
  id?: string | null;
  title?: string | null;
  vertical?: string | null;
  provider?: string | null;
  network?: string | null;
  status?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  primary_event_hash?: string | null;
  anchor_id?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  certificate_url?: string | null;
  network_verification?: {
    anchor?: { verified?: boolean; checked?: boolean; confirmations?: number | null; reason?: string | null } | null;
    receipt?: { verified?: boolean; checked?: boolean; confirmations?: number | null; memo_matches?: boolean; reason?: string | null } | null;
  } | null;
  public_receipt?: PublicProofReceipt | null;
};

type IotaTestnetReference = {
  network?: string | null;
  contract_address?: string | null;
  contract_explorer_url?: string | null;
  demo_tx_hash?: string | null;
  demo_tx_explorer_url?: string | null;
  rpc_verified?: boolean;
  verified_anchor_count?: number | null;
  verified_receipt_count?: number | null;
};

type PolygonTestnetReference = {
  network?: string | null;
  contract_address?: string | null;
  contract_explorer_url?: string | null;
  demo_tx_hash?: string | null;
  demo_tx_explorer_url?: string | null;
  demo_token_id?: string | null;
  ownership_certificate_url?: string | null;
  certificate_url?: string | null;
  rpc_verified?: boolean;
  verification_state?: string | null;
  evidence_level?: string | null;
  owner_custody?: string | null;
  wallet_control_verified?: boolean;
  claim_state?: string | null;
  metadata_verified?: boolean;
  mint_events_match?: boolean;
  source_verified?: boolean;
};

type PublicProofPayload = {
  ok?: boolean;
  cases?: PublicProofCase[];
  testnet?: {
    iota?: IotaTestnetReference | null;
    polygon?: PolygonTestnetReference | null;
  } | null;
};

type PrivateDataState = "production" | "demo" | "partial" | "unavailable";
type StatusTone = "success" | "pending" | "danger" | "neutral";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function unavailable<T>(value: T): FetchResult<T> {
  return { ok: false, value, mode: "unavailable" };
}

async function fetchDashboardPayload<T extends { ok?: boolean }>(
  context: AdminPageContext,
  path: string,
  fallback: T,
): Promise<FetchResult<T>> {
  try {
    const response = await fetchAdminPage(context, path);
    if (!response.ok) return unavailable(fallback);
    const value = await response.json() as T;
    if (!value || value.ok !== true) return unavailable(fallback);
    return {
      ok: true,
      value,
      mode: response.headers.get("x-nexid-data-mode") === "demo" ? "demo" : "production",
    };
  } catch {
    return unavailable(fallback);
  }
}

async function getAnchors(context: AdminPageContext) {
  return fetchDashboardPayload(
    context,
    "proof/anchors",
    { ok: false, anchors: [] as ProofAnchor[] },
  );
}

async function getEvents(context: AdminPageContext) {
  return fetchDashboardPayload(
    context,
    "proof/events?limit=60",
    { ok: false, events: [] as ProofEvent[] },
  );
}

async function getTokenizationRequests(context: AdminPageContext) {
  return fetchDashboardPayload(
    context,
    "tokenization/requests?limit=80",
    { ok: false, rows: [] as TokenizationRequest[] },
  );
}

async function getPublicProofCases(): Promise<FetchResult<PublicProofPayload>> {
  const apiOrigin = String(productUrls.api || "").replace(/\/$/, "");
  const fallback: PublicProofPayload = { ok: false, cases: [], testnet: {} };
  if (!apiOrigin) return unavailable(fallback);

  try {
    const response = await fetch(`${apiOrigin}/public/proof/demo-cases`, { cache: "no-store" });
    if (!response.ok) return unavailable(fallback);
    const value = await response.json() as PublicProofPayload;
    if (!value || value.ok !== true) return unavailable(fallback);
    return { ok: true, value, mode: "production" };
  } catch {
    return unavailable(fallback);
  }
}

function readText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function normalize(value: unknown) {
  return readText(value).toLowerCase();
}

function readCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

function formatCount(value: number | null) {
  return value === null ? "-" : value.toLocaleString("es-AR");
}

function formatTimestamp(value: unknown) {
  const raw = readText(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "-";
  return `${dateFormatter.format(date)} UTC`;
}

function shortHash(value: unknown, start = 14, end = 10) {
  const hash = readText(value);
  if (!hash) return "-";
  if (hash.length <= start + end + 3) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

function safeHttpUrl(value: unknown): string | null {
  const raw = readText(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function hashList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(readText).filter(Boolean);
  const raw = readText(value);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(readText).filter(Boolean) : [];
  } catch {
    return raw.toLowerCase().startsWith("sha256:") ? [raw] : [];
  }
}

function eventHash(event: ProofEvent) {
  return readText(event.payload_hash || event.event_hash || event.hash);
}

function firstEventHash(anchor: ProofAnchor, events: ProofEvent[]) {
  const direct = [
    ...hashList(anchor.event_hashes_json),
    ...hashList(anchor.event_hashes),
    readText(anchor.first_event_hash),
    readText(anchor.event_hash),
  ].find(Boolean);
  if (direct) return direct;

  const anchorId = readText(anchor.id);
  if (!anchorId) return "";
  const matchingEvent = events.find((event) => readText(event.anchor_id) === anchorId);
  return matchingEvent ? eventHash(matchingEvent) : "";
}

function publicVerifyHref(hash: string, anchorId: string) {
  if (!hash) return null;
  const params = new URLSearchParams({ event_hash: hash });
  if (UUID_PATTERN.test(anchorId)) params.set("anchor_id", anchorId);
  return `${PUBLIC_VERIFY_URL}?${params.toString()}`;
}

function statusPresentation(value: unknown): { label: string; tone: StatusTone } {
  const status = normalize(value);
  if (status === "confirmed" || status === "completed" || status === "succeeded") {
    return { label: "Confirmado", tone: "success" };
  }
  if (status === "failed" || status === "error" || status === "rejected") {
    return { label: "Fallido", tone: "danger" };
  }
  if (status === "submitted" || status === "pending" || status === "processing") {
    return { label: status === "submitted" ? "Enviado" : "Pendiente", tone: "pending" };
  }
  return { label: readText(value) || "No informado", tone: "neutral" };
}

function sourceLabel(result: FetchResult<unknown>) {
  if (!result.ok) return "no disponible";
  return result.mode === "demo" ? "sandbox" : "tenant";
}

function privateDataState(results: Array<FetchResult<unknown>>): PrivateDataState {
  if (results.some((result) => result.mode === "demo")) return "demo";
  const available = results.filter((result) => result.ok).length;
  if (available === results.length) return "production";
  return available > 0 ? "partial" : "unavailable";
}

function privateStateLabel(state: PrivateDataState) {
  if (state === "demo") return "Sandbox BFF";
  if (state === "partial") return "Lectura parcial";
  if (state === "unavailable") return "Datos no disponibles";
  return "Datos del tenant";
}

function isOwnershipTransaction(row: TokenizationRequest) {
  const network = normalize(row.network);
  return normalize(row.status) === "anchored"
    && row.meta?.evidence_verified === true
    && Boolean(readText(row.tx_hash))
    && (network.includes("polygon") || network.includes("amoy"));
}

function isRealIotaReference(demoCase: PublicProofCase) {
  if (normalize(demoCase.provider) !== "iota") return false;
  const anchorTx = demoCase.network_verification?.anchor?.verified === true
    && Boolean(readText(demoCase.tx_hash) && safeHttpUrl(demoCase.explorer_url));
  const receiptTx = demoCase.network_verification?.receipt?.verified === true
    && Boolean(readText(demoCase.public_receipt?.tx_hash) && safeHttpUrl(demoCase.public_receipt?.explorer_url));
  return anchorTx || receiptTx;
}

function resourceLabel(resourceType: unknown, resourceId: unknown) {
  const type = readText(resourceType);
  const id = readText(resourceId);
  return {
    type: type || "Recurso no informado",
    id: id || "Sin identificador",
  };
}

type Metric = {
  label: string;
  value: number | null;
  detail: string;
  icon: LucideIcon;
};

function EmptyState({ children }: { children: string }) {
  return (
    <div className={styles.emptyState} role="status">
      <CircleAlert aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export default async function ProofPage() {
  const session = await requireDashboardSession("proof:read");
  const adminContext = await createAdminPageContext(session);

  const eventsPromise = getEvents(adminContext);
  const tokenizationPromise = getTokenizationRequests(adminContext);
  const publicProofPromise = getPublicProofCases();
  const anchorsResult = await getAnchors(adminContext);
  const [eventsResult, tokenizationResult, publicProofResult] = await Promise.all([
    eventsPromise,
    tokenizationPromise,
    publicProofPromise,
  ]);

  const anchors = anchorsResult.ok && Array.isArray(anchorsResult.value.anchors)
    ? anchorsResult.value.anchors
    : [];
  const events = eventsResult.ok && Array.isArray(eventsResult.value.events)
    ? eventsResult.value.events
    : [];
  const tokenizationRows = tokenizationResult.ok && Array.isArray(tokenizationResult.value.rows)
    ? tokenizationResult.value.rows
    : [];
  const publicCases = publicProofResult.ok && Array.isArray(publicProofResult.value.cases)
    ? publicProofResult.value.cases
    : [];

  const confirmedAnchors = anchors.filter((anchor) => normalize(anchor.status) === "confirmed").length;
  const includedEventCount = anchors.reduce((total, anchor) => total + (readCount(anchor.event_count) || 0), 0);
  const ownershipTxCount = tokenizationRows.filter(isOwnershipTransaction).length;
  const privateResults: Array<FetchResult<unknown>> = [anchorsResult, eventsResult, tokenizationResult];
  const tenantState = privateDataState(privateResults);

  const metrics: Metric[] = [
    {
      label: "Anchors registrados",
      value: anchorsResult.ok ? anchors.length : null,
      detail: anchorsResult.ok ? "Total devuelto por el BFF" : "No disponible",
      icon: Database,
    },
    {
      label: "Anchors confirmados",
      value: anchorsResult.ok ? confirmedAnchors : null,
      detail: anchorsResult.ok ? "Estado confirmado" : "No disponible",
      icon: BadgeCheck,
    },
    {
      label: "Eventos recientes",
      value: eventsResult.ok ? events.length : null,
      detail: eventsResult.ok ? "Ventana BFF de hasta 60" : "No disponible",
      icon: Activity,
    },
    {
      label: "Eventos incluidos",
      value: anchorsResult.ok ? includedEventCount : null,
      detail: anchorsResult.ok ? "Suma de event_count" : "No disponible",
      icon: Hash,
    },
    {
      label: "Ownership tx",
      value: tokenizationResult.ok ? ownershipTxCount : null,
      detail: tokenizationResult.ok ? "Filtradas por meta.evidence_verified, tx_hash y red Polygon/Amoy" : "No disponible",
      icon: Fingerprint,
    },
  ];

  const anchorsToDisplay = anchors.slice(0, 20);
  const eventsToDisplay = events.slice(0, 12);
  const realIotaCases = publicCases.filter(isRealIotaReference);
  const iotaReference = publicProofResult.value.testnet?.iota || null;
  const polygonReference = publicProofResult.value.testnet?.polygon || null;
  const iotaContractHref = safeHttpUrl(iotaReference?.contract_explorer_url);
  const iotaDemoTxHref = safeHttpUrl(iotaReference?.demo_tx_explorer_url);
  const polygonContractHref = safeHttpUrl(polygonReference?.contract_explorer_url);
  const polygonTxHref = safeHttpUrl(polygonReference?.demo_tx_explorer_url);
  const polygonCertificateHref = safeHttpUrl(
    polygonReference?.certificate_url || polygonReference?.ownership_certificate_url,
  );
  const polygonRpcVerified = polygonReference?.rpc_verified === true;
  const canWriteProof = !session.isDemo && (
    session.role === "super-admin" || dashboardPermissionMatches(session.permissions, "proof:write")
  );
  const composerHref = session.tenantSlug
    ? `/proof/anchor?tenant=${encodeURIComponent(session.tenantSlug)}`
    : "/proof/anchor";

  return (
    <main className={styles.page} data-testid="proof-trust-operations">
      <header className={styles.pageHeader}>
        <div className={styles.headerCopy}>
          <span className={styles.eyebrow}><ShieldCheck aria-hidden="true" /> Trust Operations</span>
          <h1>Consola de evidencia y ownership</h1>
          <p>
            Evidencia operativa del tenant, referencias publicas de testnet y responsabilidad de cada red,
            sin combinar fuentes ni asumir disponibilidad.
          </p>
        </div>
        <nav className={styles.actions} aria-label="Acciones de Trust Operations">
          {canWriteProof ? (
            <Link className={`${styles.action} ${styles.primaryAction}`} href={composerHref}>
              <PlusCircle aria-hidden="true" /> Registrar evidencia
            </Link>
          ) : null}
          <a className={canWriteProof ? styles.action : `${styles.action} ${styles.primaryAction}`} href={PUBLIC_VERIFY_URL} target="_blank" rel="noreferrer">
            <FileCheck2 aria-hidden="true" /> Verificador publico <ArrowUpRight aria-hidden="true" />
          </a>
          <a className={styles.action} href={PUBLIC_OWNERSHIP_URL} target="_blank" rel="noreferrer">
            <Fingerprint aria-hidden="true" /> Ownership <ArrowUpRight aria-hidden="true" />
          </a>
          <Link className={styles.action} href="/tokenization">
            <Boxes aria-hidden="true" /> Tokenization
          </Link>
          <a className={styles.action} href={PUBLIC_DEMO_LAB_URL} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" /> Demo Lab
          </a>
        </nav>
      </header>

      <section className={styles.section} data-testid="proof-private-tenant" aria-labelledby="private-proof-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionNumber}>01</span>
            <h2 id="private-proof-title">Evidencia privada del tenant</h2>
            <p>Lecturas autenticadas por BFF. Los casos publicos de referencia no participan de estas metricas.</p>
          </div>
          <span className={styles.modeBadge} data-mode={tenantState}>{privateStateLabel(tenantState)}</span>
        </div>

        <div className={styles.sourceList} aria-label="Estado de las fuentes tenant">
          <span>Anchors: {sourceLabel(anchorsResult)}</span>
          <span>Eventos: {sourceLabel(eventsResult)}</span>
          <span>Ownership: {sourceLabel(tokenizationResult)}</span>
        </div>

        <div className={styles.metrics} aria-label="Metricas calculadas del tenant">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article className={styles.metric} key={metric.label}>
                <div className={styles.metricLabel}><Icon aria-hidden="true" /><span>{metric.label}</span></div>
                <strong>{formatCount(metric.value)}</strong>
                <small>{metric.detail}</small>
              </article>
            );
          })}
        </div>

        <div className={styles.privateGrid}>
          <div className={styles.collection}>
            <div className={styles.collectionHeader}>
              <div>
                <h3>Anchors recientes</h3>
                <p>Status, recurso, inclusion y salida verificable.</p>
              </div>
              {anchorsResult.ok && anchors.length > anchorsToDisplay.length ? (
                <span>Mostrando {anchorsToDisplay.length} de {anchors.length}</span>
              ) : null}
            </div>

            {!anchorsResult.ok ? (
              <EmptyState>Anchors no disponibles.</EmptyState>
            ) : anchorsToDisplay.length === 0 ? (
              <EmptyState>No hay anchors para este tenant.</EmptyState>
            ) : (
              <div className={styles.anchorList}>
                {anchorsToDisplay.map((anchor, index) => {
                  const anchorId = readText(anchor.id);
                  const root = readText(anchor.merkle_root);
                  const firstHash = firstEventHash(anchor, events);
                  const verifyHref = anchorsResult.mode === "demo"
                    ? null
                    : publicVerifyHref(firstHash, anchorId);
                  const explorerHref = safeHttpUrl(anchor.explorer_url);
                  const resource = resourceLabel(anchor.resource_type, anchor.resource_id);
                  const status = statusPresentation(anchor.status);
                  const eventCount = readCount(anchor.event_count);
                  const timestamp = readText(anchor.anchored_at || anchor.created_at);

                  return (
                    <article className={styles.anchor} key={anchorId || `${resource.id}-${index}`}>
                      <div className={styles.anchorTop}>
                        <div className={styles.resource}>
                          <span>{resource.type}</span>
                          <h4>{resource.id}</h4>
                        </div>
                        <span className={styles.statusBadge} data-tone={status.tone}>{status.label}</span>
                      </div>
                      <dl className={styles.anchorFacts}>
                        <div>
                          <dt>Eventos incluidos</dt>
                          <dd>{formatCount(eventCount)}</dd>
                        </div>
                        <div>
                          <dt>Fecha</dt>
                          <dd><time dateTime={timestamp || undefined}>{formatTimestamp(timestamp)}</time></dd>
                        </div>
                        <div>
                          <dt>Red</dt>
                          <dd>{readText(anchor.network) || readText(anchor.provider) || "-"}</dd>
                        </div>
                        <div className={styles.rootFact}>
                          <dt>Merkle root</dt>
                          <dd><code title={root || undefined}>{shortHash(root)}</code></dd>
                        </div>
                        {readText(anchor.proof_id) ? (
                          <div className={styles.rootFact}>
                            <dt>Proof ID V2</dt>
                            <dd><code title={readText(anchor.proof_id)}>{shortHash(readText(anchor.proof_id))}</code></dd>
                          </div>
                        ) : null}
                        {readText(anchor.memo_hash) ? (
                          <div className={styles.rootFact}>
                            <dt>Memo hash</dt>
                            <dd><code title={readText(anchor.memo_hash)}>{shortHash(readText(anchor.memo_hash))}</code></dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className={styles.rowActions}>
                        {explorerHref ? (
                          <a href={explorerHref} target="_blank" rel="noreferrer">
                            Explorer <ArrowUpRight aria-hidden="true" />
                          </a>
                        ) : null}
                        {verifyHref ? (
                          <a href={verifyHref} target="_blank" rel="noreferrer">
                            Verificar hash <FileCheck2 aria-hidden="true" />
                          </a>
                        ) : null}
                        {!explorerHref && !verifyHref ? (
                          <span>{anchorsResult.mode === "demo" ? "Sandbox local, no publicado" : "Sin enlace externo disponible"}</span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.collection}>
            <div className={styles.collectionHeader}>
              <div>
                <h3>Eventos recientes</h3>
                <p>Identidad del evento y hash canonico.</p>
              </div>
              {eventsResult.ok && events.length > eventsToDisplay.length ? (
                <span>Ultimos {eventsToDisplay.length} de {events.length}</span>
              ) : null}
            </div>

            {!eventsResult.ok ? (
              <EmptyState>Eventos no disponibles.</EmptyState>
            ) : eventsToDisplay.length === 0 ? (
              <EmptyState>No hay eventos recientes.</EmptyState>
            ) : (
              <div className={styles.eventList}>
                {eventsToDisplay.map((event, index) => {
                  const hash = eventHash(event);
                  const resource = resourceLabel(event.resource_type, event.resource_id);
                  const timestamp = readText(event.created_at);
                  return (
                    <article className={styles.event} key={readText(event.id) || `${hash}-${index}`}>
                      <div className={styles.eventHeading}>
                        <div>
                          <span>{readText(event.event_type) || "Evento"}</span>
                          <h4>{resource.id}</h4>
                        </div>
                        <time dateTime={timestamp || undefined}>{formatTimestamp(timestamp)}</time>
                      </div>
                      <p>{resource.type}</p>
                      <code title={hash || undefined}><Hash aria-hidden="true" /> {shortHash(hash, 16, 12)}</code>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.section} data-testid="proof-public-testnet" aria-labelledby="public-proof-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionNumber}>02</span>
            <h2 id="public-proof-title">Testnet publico de referencia</h2>
            <p>Datos obtenidos desde la API publica. Son referencias verificables y nunca se suman al tenant.</p>
          </div>
          <span className={styles.modeBadge} data-mode={publicProofResult.ok ? "production" : "unavailable"}>
            {publicProofResult.ok ? "API publica" : "No disponible"}
          </span>
        </div>

        {!publicProofResult.ok ? (
          <EmptyState>La referencia publica de testnet no esta disponible.</EmptyState>
        ) : (
          <div className={styles.publicContent}>
            <div className={styles.testnetSummary}>
              <article data-network="iota">
                <div><Network aria-hidden="true" /><span>IOTA testnet</span></div>
                <strong>{readText(iotaReference?.network) || "Red no informada"}</strong>
                <p>{iotaReference?.rpc_verified ? "Anchors y memos confirmados por RPC" : iotaDemoTxHref ? "Transaccion configurada, verificacion pendiente" : "Transaccion de referencia no disponible"}</p>
                <div className={styles.rowActions}>
                  {iotaContractHref ? <a href={iotaContractHref} target="_blank" rel="noreferrer">Contrato <ArrowUpRight aria-hidden="true" /></a> : null}
                  {iotaDemoTxHref ? <a href={iotaDemoTxHref} target="_blank" rel="noreferrer">Transaccion <ArrowUpRight aria-hidden="true" /></a> : null}
                </div>
              </article>
              <article data-network="polygon" data-testid="public-polygon-reference">
                <div><Fingerprint aria-hidden="true" /><span>Polygon testnet</span></div>
                <strong>{readText(polygonReference?.network) || "Red no informada"}</strong>
                <p>
                  {polygonRpcVerified
                    ? `${readText(polygonReference?.demo_token_id) ? `Token ${readText(polygonReference?.demo_token_id)} · ` : ""}RPC verificado · ${polygonReference?.owner_custody === "platform_managed" ? "custodia nexID" : "holder externo"}`
                    : polygonTxHref
                      ? "Transaccion configurada; verificacion RPC pendiente"
                      : "Emision Polygon no disponible"}
                </p>
                <div className={styles.rowActions}>
                  {polygonContractHref ? <a href={polygonContractHref} target="_blank" rel="noreferrer">Contrato <ArrowUpRight aria-hidden="true" /></a> : null}
                  {polygonTxHref ? <a href={polygonTxHref} target="_blank" rel="noreferrer">Transaccion <ArrowUpRight aria-hidden="true" /></a> : null}
                  {polygonCertificateHref ? <a href={polygonCertificateHref} target="_blank" rel="noreferrer">Certificado <FileCheck2 aria-hidden="true" /></a> : null}
                </div>
              </article>
            </div>

            <div className={styles.collectionHeader}>
              <div>
                <h3>Casos IOTA con evidencia externa</h3>
                <p>Solo se muestran casos cuyo receipt y contenido fueron confirmados contra IOTA RPC.</p>
              </div>
              <span>{realIotaCases.length} referencias</span>
            </div>

            {realIotaCases.length === 0 ? (
              <EmptyState>La API no devolvio casos IOTA con una salida externa verificable.</EmptyState>
            ) : (
              <div className={styles.publicCases}>
                {realIotaCases.map((demoCase, index) => {
                  const anchorId = readText(demoCase.anchor_id);
                  const hash = readText(demoCase.primary_event_hash);
                  const verifyHref = publicVerifyHref(hash, anchorId);
                  const txHref = safeHttpUrl(demoCase.explorer_url);
                  const receiptHref = safeHttpUrl(demoCase.public_receipt?.explorer_url);
                  const certificateHref = safeHttpUrl(demoCase.certificate_url || demoCase.public_receipt?.certificate_url);
                  const resource = resourceLabel(demoCase.resource_type, demoCase.resource_id);

                  return (
                    <article className={styles.publicCase} key={readText(demoCase.id) || `${anchorId}-${index}`}>
                      <div className={styles.publicCaseHeading}>
                        <div>
                          <span>{readText(demoCase.vertical) || "Caso de referencia"}</span>
                          <h3>{readText(demoCase.title) || resource.id}</h3>
                        </div>
                        <span>{demoCase.network_verification?.anchor?.verified ? "RPC confirmado" : readText(demoCase.network) || "IOTA testnet"}</span>
                      </div>
                      <dl>
                        <div><dt>Recurso</dt><dd>{resource.type} / {resource.id}</dd></div>
                        <div><dt>Event hash</dt><dd><code title={hash || undefined}>{shortHash(hash, 16, 12)}</code></dd></div>
                        <div><dt>Anchor ID</dt><dd><code title={anchorId || undefined}>{shortHash(anchorId, 12, 8)}</code></dd></div>
                      </dl>
                      <div className={styles.rowActions}>
                        {txHref ? <a href={txHref} target="_blank" rel="noreferrer">Tx IOTA <ArrowUpRight aria-hidden="true" /></a> : null}
                        {receiptHref ? <a href={receiptHref} target="_blank" rel="noreferrer">Receipt <ArrowUpRight aria-hidden="true" /></a> : null}
                        {certificateHref ? <a href={certificateHref} target="_blank" rel="noreferrer">Certificado <FileCheck2 aria-hidden="true" /></a> : null}
                        {verifyHref ? <a href={verifyHref} target="_blank" rel="noreferrer">Verificar <FileCheck2 aria-hidden="true" /></a> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      <section className={styles.section} data-testid="proof-trust-layers" aria-labelledby="trust-layers-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionNumber}>03</span>
            <h2 id="trust-layers-title">IOTA integridad hash-only vs Polygon ownership</h2>
            <p>Las dos redes resuelven responsabilidades distintas; una no reemplaza a la otra.</p>
          </div>
        </div>

        <div className={styles.layerGrid}>
          <article className={styles.layer} data-layer="iota">
            <div className={styles.layerIcon}><Link2 aria-hidden="true" /></div>
            <div>
              <span>IOTA</span>
              <h3>Integridad hash-only</h3>
              <p>Publica hashes, Merkle roots y referencias de transaccion. No publica el payload privado ni representa ownership.</p>
              <dl>
                <div><dt>Prueba</dt><dd>Existencia e integridad de evidencia</dd></div>
                <div><dt>Dato publico</dt><dd>Hash, root y referencia de red</dd></div>
                <div><dt>Red</dt><dd>{publicProofResult.ok ? readText(iotaReference?.network) || "No informada" : "No disponible"}</dd></div>
              </dl>
            </div>
          </article>

          <article className={styles.layer} data-layer="polygon">
            <div className={styles.layerIcon}><Fingerprint aria-hidden="true" /></div>
            <div>
              <span>Polygon</span>
              <h3>Titularidad digital y certificado</h3>
              <p>Registra mint o transferencia y habilita un certificado verificable segun policy. No sustituye el historial operativo del tenant. No prueba propiedad fisica.</p>
              <dl>
                <div><dt>Evidencia</dt><dd>Titularidad digital, garantia digital o activo tokenizado</dd></div>
                <div><dt>Dato publico</dt><dd>Tx, contrato y token cuando aplica</dd></div>
                <div><dt>Red</dt><dd>{publicProofResult.ok ? readText(polygonReference?.network) || "No informada" : "No disponible"}</dd></div>
              </dl>
            </div>
          </article>
        </div>

        <div className={styles.privacyNote}>
          <ShieldCheck aria-hidden="true" />
          <p>La evidencia publica se limita a referencias criptograficas y de red. La evidencia privada permanece en el alcance autenticado del tenant; ninguna de las dos acredita por si sola propiedad, ubicacion o custodia fisica.</p>
        </div>
      </section>
    </main>
  );
}
