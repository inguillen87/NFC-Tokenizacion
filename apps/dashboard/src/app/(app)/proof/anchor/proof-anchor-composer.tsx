"use client";

import { productUrls, withPath } from "@product/config";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CircleAlert,
  Database,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Hash,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Network,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type ProviderCode = "none" | "iota";

type ProviderReadiness = {
  id: string;
  name: string;
  network: string;
  capability?: string;
  purpose?: string;
  policy_enabled?: boolean;
  runtime_status?: string;
  write_enabled?: boolean;
};

type TenantOption = {
  slug?: string | null;
  name?: string | null;
};

type AnchorReceipt = {
  id?: string | null;
  provider?: string | null;
  network?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  merkle_root?: string | null;
  status?: string | null;
  tx_hash?: string | null;
  explorer_url?: string | null;
  anchored_at?: string | null;
};

type ComposerResult = {
  eventId: string;
  payloadHash: string;
  anchor: AnchorReceipt;
};

type Props = {
  canWrite: boolean;
  defaultOccurredAt: string;
  initialTenantSlug?: string | null;
  isDemo: boolean;
  role: string;
};

const PUBLIC_VERIFY_URL = withPath(productUrls.web, "/proof/verify");

const EVENT_OPTIONS = [
  { value: "origin_attested", label: "Origen atestado", detail: "Declara el origen operativo de un lote o producto." },
  { value: "qa_release", label: "Liberacion de calidad", detail: "Registra que QA aprobo una version o lote." },
  { value: "custody_checkpoint", label: "Hito de custodia", detail: "Prueba un cambio de control sin publicar datos sensibles." },
  { value: "field_scan", label: "Escaneo de campo", detail: "Registra una validacion en planta, deposito o campo." },
  { value: "delivery_confirmed", label: "Entrega confirmada", detail: "Cierra un hito logistico verificable." },
  { value: "claim_policy_opened", label: "Reclamo habilitado", detail: "Deja evidencia de la regla que habilito un reclamo." },
] as const;

const RESOURCE_OPTIONS = [
  { value: "batch", label: "Lote" },
  { value: "product", label: "Producto" },
  { value: "shipment", label: "Envio" },
  { value: "qa_record", label: "Registro QA" },
  { value: "custody_case", label: "Caso de custodia" },
  { value: "agronomic_lot", label: "Lote agronomico" },
] as const;

function readText(value: unknown) {
  return String(value || "").trim();
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    return { ok: false, reason: "invalid_json_response" };
  }
}

function errorMessage(payload: Record<string, unknown>, fallback: string) {
  const reason = readText(payload.reason);
  const message = readText(payload.message);
  if (message) return message;
  const known: Record<string, string> = {
    ledger_provider_disabled: "La red esta deshabilitada por la politica del tenant.",
    ledger_provider_runtime_disabled: "La red no tiene un runtime de escritura activo.",
    proof_payload_sensitive_key_rejected: "El payload contiene un campo sensible. Usa solo referencias no confidenciales.",
    tenant_not_found: "No se encontro el tenant indicado.",
    tenant_required: "Selecciona un tenant antes de registrar evidencia.",
    readonly_demo_mutation_blocked: "El sandbox es de solo lectura. Ingresa con una cuenta operativa para emitir un recibo.",
  };
  return known[reason] || reason || fallback;
}

function providerStatus(provider: ProviderReadiness | undefined) {
  if (!provider) return { label: "Consultando", tone: "neutral" };
  if (provider.write_enabled) return { label: "Listo para emitir", tone: "success" };
  if (provider.runtime_status === "policy_disabled") return { label: "Deshabilitado por politica", tone: "warning" };
  if (provider.runtime_status === "read_only") return { label: "Solo lectura", tone: "neutral" };
  if (provider.runtime_status === "misconfigured") return { label: "Configuracion incompleta", tone: "danger" };
  return { label: "No disponible", tone: "neutral" };
}

function shortHash(value: string, start = 18, end = 12) {
  if (!value || value.length <= start + end + 3) return value || "-";
  return `${value.slice(0, start)}...${value.slice(-end)}`;
}

function toLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ProofAnchorComposer({ canWrite, defaultOccurredAt, initialTenantSlug, isDemo, role }: Props) {
  const tenantLocked = role === "tenant-admin" && Boolean(initialTenantSlug);
  const [tenantSlug, setTenantSlug] = useState(initialTenantSlug || "");
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [providers, setProviders] = useState<ProviderReadiness[]>([]);
  const [providersPending, setProvidersPending] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<ProviderCode>("none");
  const [resourceType, setResourceType] = useState("batch");
  const [resourceId, setResourceId] = useState("");
  const [eventType, setEventType] = useState("origin_attested");
  const [evidenceStatus, setEvidenceStatus] = useState("verified");
  const [locationCode, setLocationCode] = useState("");
  const [documentRef, setDocumentRef] = useState("");
  const [notes, setNotes] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ComposerResult | null>(null);

  useEffect(() => {
    setOccurredAt(toLocalDateTimeInput(defaultOccurredAt));
  }, [defaultOccurredAt]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadReadiness() {
      setProvidersPending(true);
      try {
        const response = await fetch("/api/admin/proof/providers", { cache: "no-store", signal: controller.signal });
        const payload = await readJson(response);
        if (!response.ok || payload.ok !== true) throw new Error(errorMessage(payload, "No se pudo consultar la politica de redes."));
        setProviders(Array.isArray(payload.providers) ? payload.providers as ProviderReadiness[] : []);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "No se pudo consultar la politica de redes.");
      } finally {
        if (!controller.signal.aborted) setProvidersPending(false);
      }
    }
    void loadReadiness();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (role !== "super-admin") return;
    const controller = new AbortController();
    fetch("/api/admin/tenants", { cache: "no-store", signal: controller.signal })
      .then(readJson)
      .then((payload) => {
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload.rows) ? payload.rows : [];
        setTenants(rows as TenantOption[]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [role]);

  const providerById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );
  const localProvider = providerById.get("none");
  const iotaProvider = providerById.get("iota");
  const selectedProviderRow = providerById.get(selectedProvider);
  const selectedEvent = EVENT_OPTIONS.find((option) => option.value === eventType) || EVENT_OPTIONS[0];
  const payloadPreview = useMemo(() => ({
    status: evidenceStatus,
    occurred_at: occurredAt ? new Date(occurredAt).toISOString() : null,
    ...(locationCode.trim() ? { location_code: locationCode.trim() } : {}),
    ...(documentRef.trim() ? { document_ref: documentRef.trim() } : {}),
    ...(notes.trim() ? { note: notes.trim() } : {}),
  }), [documentRef, evidenceStatus, locationCode, notes, occurredAt]);
  const formInteractive = canWrite || isDemo;
  const writable = canWrite && !isDemo;
  const canSubmit = writable
    && Boolean(tenantSlug.trim() && resourceId.trim() && occurredAt)
    && Boolean(selectedProviderRow?.write_enabled)
    && !pending;

  async function submitEvidence() {
    if (!canSubmit) return;
    setPending(true);
    setError("");
    setResult(null);
    let eventId = "";
    try {
      setPhase("1 de 2: calculando SHA-256 y registrando el evento...");
      const eventResponse = await fetch("/api/admin/proof/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant: tenantSlug.trim(),
          resource_type: resourceType,
          resource_id: resourceId.trim(),
          event_type: eventType,
          payload: payloadPreview,
        }),
      });
      const eventPayload = await readJson(eventResponse);
      if (!eventResponse.ok || eventPayload.ok !== true) {
        throw new Error(errorMessage(eventPayload, "No se pudo registrar el evento."));
      }
      eventId = readText(eventPayload.proof_event_id);
      const payloadHash = readText(eventPayload.payload_hash);
      if (!eventId || !payloadHash) throw new Error("La API no devolvio la identidad criptografica del evento.");

      setPhase(selectedProvider === "iota"
        ? "2 de 2: enviando el Merkle root a IOTA testnet..."
        : "2 de 2: emitiendo el recibo auditable del tenant...");
      const anchorPath = selectedProvider === "none" ? "/api/admin/proof/anchor" : "/api/admin/proof/anchors";
      const anchorResponse = await fetch(anchorPath, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant: tenantSlug.trim(),
          provider: selectedProvider,
          network: selectedProviderRow?.network || (selectedProvider === "none" ? "local" : "testnet"),
          resource_type: resourceType,
          resource_id: resourceId.trim(),
          event_ids: [eventId],
        }),
      });
      const anchorPayload = await readJson(anchorResponse);
      if (!anchorResponse.ok || anchorPayload.ok !== true) {
        throw new Error(`${errorMessage(anchorPayload, "No se pudo emitir el recibo.")} El evento ya quedo registrado y puede reintentarse sin duplicarlo.`);
      }
      setResult({
        eventId,
        payloadHash,
        anchor: (anchorPayload.anchor || {}) as AnchorReceipt,
      });
      setPhase("Recibo emitido y listo para verificacion.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo completar la operacion.");
      setPhase(eventId ? "Evento registrado; recibo pendiente." : "Operacion detenida.");
    } finally {
      setPending(false);
    }
  }

  const verifyHref = result?.payloadHash
    ? `${PUBLIC_VERIFY_URL}?${new URLSearchParams({
        event_hash: result.payloadHash,
        ...(result.anchor.id ? { anchor_id: result.anchor.id } : {}),
      }).toString()}`
    : "";
  const localStatus = providerStatus(localProvider);
  const iotaStatus = providerStatus(iotaProvider);

  return (
    <main className={styles.page} data-testid="proof-evidence-composer">
      <header className={styles.pageHeader}>
        <div>
          <Link className={styles.backLink} href="/proof"><ArrowLeft aria-hidden="true" /> Trust Operations</Link>
          <span className={styles.eyebrow}><FileCheck2 aria-hidden="true" /> Evidence Composer</span>
          <h1>De un hecho operativo a una prueba verificable</h1>
          <p>Registra evidencia privada, calcula su SHA-256 canonico y emite un recibo sin publicar el contenido sensible.</p>
        </div>
        <div className={styles.headerFacts} aria-label="Garantias del flujo">
          <span><ShieldCheck aria-hidden="true" /> Hash-only</span>
          <span><LockKeyhole aria-hidden="true" /> Tenant scoped</span>
          <span><Database aria-hidden="true" /> Auditado</span>
        </div>
      </header>

      <ol className={styles.steps} aria-label="Etapas del flujo">
        <li data-active="true"><span>1</span><div><strong>Describe</strong><small>Que paso y sobre que recurso</small></div></li>
        <li><span>2</span><div><strong>Protege</strong><small>SHA-256 y Merkle root</small></div></li>
        <li><span>3</span><div><strong>Comprueba</strong><small>Recibo y verificador publico</small></div></li>
      </ol>

      {isDemo ? (
        <div className={styles.readonlyNotice} role="status">
          <CircleAlert aria-hidden="true" />
          <div><strong>Sandbox de solo lectura</strong><p>Puedes recorrer el flujo y revisar la politica de redes. Para emitir evidencia real, ingresa con una cuenta operativa autorizada.</p></div>
        </div>
      ) : !canWrite ? (
        <div className={styles.readonlyNotice} role="status">
          <LockKeyhole aria-hidden="true" />
          <div><strong>Permiso de lectura</strong><p>Tu rol puede inspeccionar evidencia, pero necesita el permiso <code>proof:write</code> para emitir recibos.</p></div>
        </div>
      ) : null}

      <div className={styles.workspace}>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void submitEvidence(); }}>
          <section className={styles.formSection} aria-labelledby="identity-title">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}><Boxes aria-hidden="true" /></div>
              <div><span>Paso 1</span><h2 id="identity-title">Identidad de la evidencia</h2><p>El tenant, el recurso y el tipo de evento determinan el contexto del hash.</p></div>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Tenant</span>
                <input
                  autoComplete="off"
                  disabled={tenantLocked || !formInteractive}
                  list="proof-tenants"
                  onChange={(event) => setTenantSlug(event.target.value)}
                  placeholder="bodega-demo"
                  required
                  value={tenantSlug}
                />
                <small>{tenantLocked ? "Fijado por tu sesion." : "Selecciona el workspace que sera propietario de la evidencia."}</small>
              </label>
              <datalist id="proof-tenants">
                {tenants.map((tenant) => <option key={readText(tenant.slug)} value={readText(tenant.slug)}>{readText(tenant.name)}</option>)}
              </datalist>
              <label className={styles.field}>
                <span>Tipo de recurso</span>
                <select disabled={!formInteractive} onChange={(event) => setResourceType(event.target.value)} value={resourceType}>
                  {RESOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <small>El objeto de negocio que se esta probando.</small>
              </label>
              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Identificador del recurso</span>
                <input disabled={!formInteractive} onChange={(event) => setResourceId(event.target.value)} placeholder="Ej. LOTE-MZA-2026-0031" required value={resourceId} />
                <small>Usa un ID interno no sensible; no incluyas nombres de pacientes, clientes ni secretos.</small>
              </label>
              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Hecho operativo</span>
                <select disabled={!formInteractive} onChange={(event) => setEventType(event.target.value)} value={eventType}>
                  {EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <small>{selectedEvent.detail}</small>
              </label>
            </div>
          </section>

          <section className={styles.formSection} aria-labelledby="metadata-title">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}><KeyRound aria-hidden="true" /></div>
              <div><span>Paso 2</span><h2 id="metadata-title">Datos que se convierten en evidencia</h2><p>Estos campos permanecen privados. Solo su resultado criptografico puede verificarse publicamente.</p></div>
            </div>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Estado</span>
                <select disabled={!formInteractive} onChange={(event) => setEvidenceStatus(event.target.value)} value={evidenceStatus}>
                  <option value="verified">Verificado</option>
                  <option value="approved">Aprobado</option>
                  <option value="received">Recibido</option>
                  <option value="observed">Observado</option>
                </select>
              </label>
              <label className={styles.field}>
                <span>Fecha y hora del hecho</span>
                <input disabled={!formInteractive} onChange={(event) => setOccurredAt(event.target.value)} required type="datetime-local" value={occurredAt} />
              </label>
              <label className={styles.field}>
                <span>Codigo de sitio</span>
                <input disabled={!formInteractive} onChange={(event) => setLocationCode(event.target.value)} placeholder="PLANTA-AR-04" value={locationCode} />
              </label>
              <label className={styles.field}>
                <span>Referencia documental</span>
                <input disabled={!formInteractive} onChange={(event) => setDocumentRef(event.target.value)} placeholder="QA-RELEASE-8821" value={documentRef} />
              </label>
              <label className={`${styles.field} ${styles.fullField}`}>
                <span>Nota operativa opcional</span>
                <textarea disabled={!formInteractive} maxLength={240} onChange={(event) => setNotes(event.target.value)} placeholder="Descripcion breve, sin datos personales ni secretos." rows={3} value={notes} />
                <small>{notes.length}/240 caracteres</small>
              </label>
            </div>
          </section>

          <section className={styles.formSection} aria-labelledby="provider-title">
            <div className={styles.sectionHeading}>
              <div className={styles.sectionIcon}><Network aria-hidden="true" /></div>
              <div><span>Paso 3</span><h2 id="provider-title">Destino de la prueba</h2><p>Solo se habilitan proveedores aprobados por politica y listos para escritura.</p></div>
            </div>
            <div className={styles.providerGrid} aria-busy={providersPending}>
              <button
                aria-pressed={selectedProvider === "none"}
                className={styles.provider}
                data-selected={selectedProvider === "none"}
                disabled={!formInteractive || !localProvider?.write_enabled}
                onClick={() => setSelectedProvider("none")}
                type="button"
              >
                <Database aria-hidden="true" />
                <span><strong>Registro auditable nexID</strong><small>Recibo inmediato dentro del tenant, verificable por hash.</small></span>
                <em data-tone={localStatus.tone}>{localStatus.label}</em>
              </button>
              <button
                aria-pressed={selectedProvider === "iota"}
                className={styles.provider}
                data-selected={selectedProvider === "iota"}
                disabled={!formInteractive || !iotaProvider?.write_enabled}
                onClick={() => setSelectedProvider("iota")}
                type="button"
              >
                <RadioTower aria-hidden="true" />
                <span><strong>IOTA testnet</strong><small>Publica el Merkle root cuando politica, contrato y signer estan listos.</small></span>
                <em data-tone={iotaStatus.tone}>{iotaStatus.label}</em>
              </button>
              <Link className={styles.providerLink} href="/tokenization">
                <Fingerprint aria-hidden="true" />
                <span><strong>Polygon ownership</strong><small>Se gestiona por separado para NFT, garantia o reclamo de propiedad.</small></span>
                <em>Ir a Tokenization <ArrowRight aria-hidden="true" /></em>
              </Link>
            </div>
          </section>

          <div className={styles.submitRow}>
            <button className={styles.submitButton} disabled={!canSubmit} type="submit">
              {pending ? <LoaderCircle aria-hidden="true" className={styles.spinner} /> : <ShieldCheck aria-hidden="true" />}
              {pending ? "Emitiendo prueba..." : "Registrar evento y emitir recibo"}
            </button>
            <p>La API rechaza campos sensibles y registra la accion en el audit log.</p>
          </div>
        </form>

        <aside className={styles.preview} aria-label="Vista previa de evidencia">
          <div className={styles.previewHeader}>
            <span><Hash aria-hidden="true" /> Vista previa exacta</span>
            <em>SHA-256 canonico</em>
          </div>
          <dl className={styles.previewFacts}>
            <div><dt>Tenant</dt><dd>{tenantSlug || "Pendiente"}</dd></div>
            <div><dt>Recurso</dt><dd>{resourceType} / {resourceId || "Pendiente"}</dd></div>
            <div><dt>Evento</dt><dd>{eventType}</dd></div>
            <div><dt>Destino</dt><dd>{selectedProviderRow?.name || "Consultando politica"}</dd></div>
          </dl>
          <div className={styles.codeBlock}>
            <span>Payload privado</span>
            <pre>{JSON.stringify(payloadPreview, null, 2)}</pre>
          </div>
          <div className={styles.visibilityGrid}>
            <div><LockKeyhole aria-hidden="true" /><span><strong>Permanece privado</strong><small>Payload, documentos, clientes y datos operativos.</small></span></div>
            <div><Link2 aria-hidden="true" /><span><strong>Puede ser publico</strong><small>Hash, Merkle root, estado de inclusion y tx si existe.</small></span></div>
          </div>

          <div className={styles.liveStatus} aria-live="polite">
            {error ? <div data-tone="danger"><CircleAlert aria-hidden="true" /><span><strong>No se completo</strong><small>{error}</small></span></div> : null}
            {!error && phase ? <div data-tone={result ? "success" : "neutral"}>{result ? <Check aria-hidden="true" /> : <LoaderCircle aria-hidden="true" className={pending ? styles.spinner : undefined} />}<span><strong>{result ? "Prueba lista" : "Estado"}</strong><small>{phase}</small></span></div> : null}
          </div>

          {result ? (
            <section className={styles.receipt} aria-labelledby="receipt-title">
              <div className={styles.receiptHeading}><BadgeCheck aria-hidden="true" /><div><span>Recibo emitido</span><h2 id="receipt-title">Evidencia incluida</h2></div></div>
              <dl>
                <div><dt>Event hash</dt><dd><code title={result.payloadHash}>{shortHash(result.payloadHash)}</code></dd></div>
                <div><dt>Merkle root</dt><dd><code title={readText(result.anchor.merkle_root)}>{shortHash(readText(result.anchor.merkle_root))}</code></dd></div>
                <div><dt>Anchor ID</dt><dd><code>{readText(result.anchor.id)}</code></dd></div>
                <div><dt>Estado</dt><dd>{readText(result.anchor.status) || "local"}</dd></div>
              </dl>
              <div className={styles.receiptActions}>
                <a href={verifyHref} rel="noreferrer" target="_blank"><FileCheck2 aria-hidden="true" /> Verificar prueba <ExternalLink aria-hidden="true" /></a>
                {result.anchor.explorer_url ? <a href={result.anchor.explorer_url} rel="noreferrer" target="_blank"><Network aria-hidden="true" /> Abrir explorer <ExternalLink aria-hidden="true" /></a> : null}
                <Link href="/proof"><ArrowLeft aria-hidden="true" /> Volver a Trust Operations</Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
