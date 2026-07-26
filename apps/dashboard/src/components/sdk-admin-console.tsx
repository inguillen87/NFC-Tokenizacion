"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card } from "@product/ui";
import {
  buildWebhookVerificationQuickstart,
  buildVerifyQuickstart,
  combineDeveloperDataModes,
  developerErrorMessage,
  developerMutationsAllowed,
  developerReadiness,
  isCurrentDeveloperLoad,
  NEXID_WEBHOOK_SIGNATURE_CONTRACT,
  resolveDeveloperResponseDataMode,
  SDK_INTEGRATION_PROFILES,
  SDK_SCOPE_OPTIONS,
  stringList,
  WEBHOOK_EVENT_OPTIONS,
  type DeveloperDataMode,
  type SdkApiKeyScope,
  type SdkIntegrationProfileId,
  type WebhookEventName,
} from "../lib/sdk-developer-experience";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | string;
  status: string;
  last_used_at?: string | null;
  expires_at?: string | null;
};

type WebhookRow = {
  id: string;
  name?: string;
  url: string;
  enabled: boolean;
  events: string[] | string;
  has_signing_secret?: boolean;
  signature_version?: "v1" | "v2";
};

type DeliveryRow = {
  id: string;
  event_id?: string | null;
  event_name: string;
  url: string;
  ok: boolean;
  status?: string | null;
  status_code?: number | null;
  attempt_count?: number | null;
  next_attempt_at?: string | null;
  last_attempt_at?: string | null;
  delivered_at?: string | null;
  last_error?: string | null;
};

type Notice = { tone: "success" | "error" | "info"; text: string };
type PendingAction = "create-key" | "save-policy" | "create-webhook" | `revoke:${string}` | null;
type SnippetId = "curl" | "node";
type CopyTarget = "secret" | SnippetId | "webhook";
type AdminJsonResult = {
  data: Record<string, unknown> | unknown[];
  dataMode: Exclude<DeveloperDataMode, "unknown">;
};

async function readJson(res: Response): Promise<AdminJsonResult> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
    const reason = record.reason || record.error;
    const retryAfter = res.headers.get("retry-after");
    const base = developerErrorMessage(reason, `La solicitud falló con HTTP ${res.status}.`);
    throw new Error(retryAfter ? `${base} Reintentá en ${retryAfter} s.` : base);
  }
  return {
    data: Array.isArray(data) ? data : data && typeof data === "object" ? data as Record<string, unknown> : {},
    dataMode: resolveDeveloperResponseDataMode({
      payload: data,
      headerDataMode: res.headers.get("x-nexid-data-mode"),
      headerDemoData: res.headers.get("x-nexid-demo-data"),
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function displayDate(value?: string | null) {
  if (!value) return "Sin uso registrado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : date.toLocaleString("es-AR");
}

export function SdkAdminConsole({ tenantSlug }: { tenantSlug?: string | null }) {
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const [tenantInput, setTenantInput] = useState(scopedTenant);
  const [tenant, setTenant] = useState(scopedTenant);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [secret, setSecret] = useState("");
  const [copyStatus, setCopyStatus] = useState<CopyTarget | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const loadAbortRef = useRef<AbortController | null>(null);
  const loadSequenceRef = useRef(0);
  const snippetTabRefs = useRef<Record<SnippetId, HTMLButtonElement | null>>({ curl: null, node: null });
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [usage, setUsage] = useState({ monthRequests: 0, avgLatencyMs: 0 });
  const [dataMode, setDataMode] = useState<DeveloperDataMode>("unknown");
  const [profileId, setProfileId] = useState<SdkIntegrationProfileId>("pilot");
  const [keyName, setKeyName] = useState<string>(SDK_INTEGRATION_PROFILES[0].keyName);
  const [keyExpiryDays, setKeyExpiryDays] = useState("90");
  const [selectedScopes, setSelectedScopes] = useState<SdkApiKeyScope[]>([...SDK_INTEGRATION_PROFILES[0].scopes]);
  const [bid, setBid] = useState("DEMO-2026-02");
  const [claimPin, setClaimPin] = useState("");
  const [activeSnippet, setActiveSnippet] = useState<SnippetId>("curl");
  const [webhookName, setWebhookName] = useState("production · nexID events");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [selectedWebhookEvents, setSelectedWebhookEvents] = useState<WebhookEventName[]>([
    ...SDK_INTEGRATION_PROFILES[0].webhookEvents,
  ]);

  const clearOperationalData = useCallback(() => {
    setKeys([]);
    setWebhooks([]);
    setDeliveries([]);
    setUsage({ monthRequests: 0, avgLatencyMs: 0 });
    setDataMode("unknown");
  }, []);

  const invalidateActiveLoad = useCallback(() => {
    loadSequenceRef.current += 1;
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
  }, []);

  useEffect(() => {
    invalidateActiveLoad();
    clearOperationalData();
    setTenantInput(scopedTenant);
    setTenant(scopedTenant);
  }, [clearOperationalData, invalidateActiveLoad, scopedTenant]);

  useEffect(() => () => {
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    invalidateActiveLoad();
  }, [invalidateActiveLoad]);

  const load = useCallback(async () => {
    const requestId = loadSequenceRef.current + 1;
    loadSequenceRef.current = requestId;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    setLoading(true);
    setLoadFailed(false);
    clearOperationalData();
    if (!tenant) {
      setLoading(false);
      if (loadAbortRef.current === controller) loadAbortRef.current = null;
      return;
    }
    try {
      const withTenant = (path: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams(extra || {});
        if (tenant) params.set("tenant", tenant);
        const query = params.toString();
        return `${path}${query ? `?${query}` : ""}`;
      };
      const [keysResponse, webhooksResponse, deliveriesResponse] = await Promise.all([
        fetch(withTenant("/api/admin/sdk/api-keys"), { cache: "no-store", signal: controller.signal }).then(readJson),
        fetch(withTenant("/api/admin/webhooks"), { cache: "no-store", signal: controller.signal }).then(readJson),
        fetch(withTenant("/api/admin/webhook-deliveries", { limit: "20" }), { cache: "no-store", signal: controller.signal }).then(readJson),
      ]);
      if (!isCurrentDeveloperLoad({ requestId, activeRequestId: loadSequenceRef.current, aborted: controller.signal.aborted })) return;

      const keysPayload = keysResponse.data;
      const webhooksPayload = webhooksResponse.data;
      const deliveriesPayload = deliveriesResponse.data;
      const keysRecord = asRecord(keysPayload);
      const webhooksRecord = asRecord(webhooksPayload);
      const deliveriesRecord = asRecord(deliveriesPayload);
      setDataMode(combineDeveloperDataModes([
        keysResponse.dataMode,
        webhooksResponse.dataMode,
        deliveriesResponse.dataMode,
      ]));
      setKeys(Array.isArray(keysRecord.rows) ? keysRecord.rows as ApiKeyRow[] : Array.isArray(keysPayload) ? keysPayload as ApiKeyRow[] : []);
      setUsage({
        monthRequests: Number((keysRecord.usage as Record<string, unknown> | undefined)?.monthRequests || 0),
        avgLatencyMs: Number((keysRecord.usage as Record<string, unknown> | undefined)?.avgLatencyMs || 0),
      });
      setWebhooks(Array.isArray(webhooksPayload) ? webhooksPayload as WebhookRow[] : Array.isArray(webhooksRecord.rows) ? webhooksRecord.rows as WebhookRow[] : []);
      setDeliveries(Array.isArray(deliveriesPayload) ? deliveriesPayload as DeliveryRow[] : Array.isArray(deliveriesRecord.rows) ? deliveriesRecord.rows as DeliveryRow[] : []);
      setLoadFailed(false);
      setNotice((current) => current?.tone === "error" ? null : current);
    } catch (error) {
      if (!isCurrentDeveloperLoad({ requestId, activeRequestId: loadSequenceRef.current, aborted: controller.signal.aborted })) return;
      setLoadFailed(true);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo cargar el portal developer." });
    } finally {
      if (isCurrentDeveloperLoad({ requestId, activeRequestId: loadSequenceRef.current, aborted: controller.signal.aborted })) {
        setLoading(false);
        if (loadAbortRef.current === controller) loadAbortRef.current = null;
      }
    }
  }, [clearOperationalData, tenant]);

  useEffect(() => {
    void load();
    return () => loadAbortRef.current?.abort();
  }, [load]);

  const activeKeys = useMemo(() => keys.filter((row) => row.status === "active").length, [keys]);
  const enabledWebhooks = useMemo(() => webhooks.filter((row) => row.enabled).length, [webhooks]);
  const successfulDeliveries = useMemo(() => deliveries.filter((row) => row.ok).length, [deliveries]);
  const readiness = useMemo(() => developerReadiness({
    tenantSelected: Boolean(tenant),
    activeKeys,
    monthRequests: usage.monthRequests,
    enabledWebhooks,
    successfulDeliveries,
    dataMode,
  }), [activeKeys, dataMode, enabledWebhooks, successfulDeliveries, tenant, usage.monthRequests]);
  const quickstart = useMemo(() => buildVerifyQuickstart({ tenantSlug: tenant, bid }), [bid, tenant]);
  const webhookVerifier = useMemo(() => buildWebhookVerificationQuickstart(), []);
  const mutationsAllowed = developerMutationsAllowed({ dataMode, loading });
  const isDemoData = dataMode === "demo";
  const mutationDisabledHelp = isDemoData
    ? "Sesión DEMO DATA en sólo lectura: las muestras no crean, cambian ni revocan recursos."
    : loading
      ? "Esperá a que termine la carga del tenant antes de modificar recursos."
      : "No hay una fuente de producción verificada; recargá los datos antes de modificar recursos.";

  function applyTenant() {
    const nextTenant = tenantInput.trim().toLowerCase();
    invalidateActiveLoad();
    clearOperationalData();
    setLoading(true);
    setLoadFailed(false);
    setNotice(null);
    setSecret("");
    setTenant(nextTenant);
    if (nextTenant === tenant) void load();
  }

  function ensureMutationAllowed() {
    if (mutationsAllowed) return true;
    setNotice({ tone: "info", text: mutationDisabledHelp });
    return false;
  }

  function chooseProfile(id: SdkIntegrationProfileId) {
    const profile = SDK_INTEGRATION_PROFILES.find((candidate) => candidate.id === id);
    if (!profile) return;
    setProfileId(profile.id);
    setKeyName(profile.keyName);
    setSelectedScopes([...profile.scopes]);
    setSelectedWebhookEvents([...profile.webhookEvents]);
  }

  function toggleScope(scope: SdkApiKeyScope, checked: boolean) {
    setSelectedScopes((current) => {
      if (!checked) return current.filter((item) => item !== scope);
      return current.includes(scope) ? current : [...current, scope];
    });
  }

  function toggleWebhookEvent(eventName: WebhookEventName, checked: boolean) {
    setSelectedWebhookEvents((current) => {
      if (!checked) return current.filter((item) => item !== eventName);
      return current.includes(eventName) ? current : [...current, eventName];
    });
  }

  function moveSnippetTab(current: SnippetId, key: string) {
    const order: SnippetId[] = ["curl", "node"];
    const currentIndex = order.indexOf(current);
    const next = key === "ArrowRight" ? order[(currentIndex + 1) % order.length]
      : key === "ArrowLeft" ? order[(currentIndex - 1 + order.length) % order.length]
        : key === "Home" ? order[0]
          : key === "End" ? order[order.length - 1]
            : null;
    if (!next) return;
    setActiveSnippet(next);
    snippetTabRefs.current[next]?.focus();
  }

  async function copyValue(value: string, target: CopyTarget) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(value);
      setCopyStatus(target);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopyStatus((current) => current === target ? null : current), 1800);
    } catch {
      setLoadFailed(false);
      setNotice({ tone: "error", text: "No se pudo copiar automáticamente. Seleccioná el texto y copialo manualmente." });
    }
  }

  async function createKey() {
    setLoadFailed(false);
    setNotice(null);
    setSecret("");
    if (!ensureMutationAllowed()) return;
    if (!tenant) {
      setNotice({ tone: "error", text: "Seleccioná un tenant antes de crear una API key." });
      return;
    }
    if (!selectedScopes.length) {
      setNotice({ tone: "error", text: "Seleccioná al menos un scope para crear la API key." });
      return;
    }
    setPendingAction("create-key");
    try {
      const response = await fetch("/api/admin/sdk/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          name: keyName.trim(),
          scopes: selectedScopes,
          expiresAt: keyExpiryDays === "never"
            ? undefined
            : new Date(Date.now() + Number(keyExpiryDays) * 86_400_000).toISOString(),
        }),
      }).then(readJson);
      const payload = asRecord(response.data);
      setSecret(String(payload.secret || ""));
      setNotice({ tone: "success", text: "Key creada. Guardá el secreto ahora: nexID no puede volver a mostrarlo." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear la key." });
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeKey(row: ApiKeyRow) {
    if (!ensureMutationAllowed()) return;
    const confirmed = window.confirm(`Revocar ${row.name}? La integración dejará de autenticar inmediatamente.`);
    if (!confirmed) return;
    setLoadFailed(false);
    setNotice(null);
    setPendingAction(`revoke:${row.id}`);
    try {
      await fetch(`/api/admin/sdk/api-keys/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      }).then(readJson);
      setNotice({ tone: "success", text: `${row.name} fue revocada.` });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo revocar la key." });
    } finally {
      setPendingAction(null);
    }
  }

  async function saveClaimPolicy() {
    setLoadFailed(false);
    setNotice(null);
    if (!ensureMutationAllowed()) return;
    if (!tenant) {
      setNotice({ tone: "error", text: "Seleccioná un tenant antes de cambiar la política de claim." });
      return;
    }
    setPendingAction("save-policy");
    try {
      await fetch("/api/admin/sdk/claim-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          bid,
          activeForClaim: true,
          claimRequiresPos: true,
          autoClaimEnabled: true,
          claimPinRequired: Boolean(claimPin),
          pin: claimPin || undefined,
        }),
      }).then(readJson);
      setNotice({ tone: "success", text: "Política guardada: el ownership requiere un POS token válido." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar la política." });
    } finally {
      setPendingAction(null);
    }
  }

  async function createWebhook() {
    setLoadFailed(false);
    setNotice(null);
    if (!ensureMutationAllowed()) return;
    if (!tenant) {
      setNotice({ tone: "error", text: "Seleccioná un tenant antes de crear un webhook." });
      return;
    }
    if (webhookSecret.length < 32) {
      setNotice({ tone: "error", text: "El signing secret debe tener al menos 32 caracteres y guardarse en el secret manager del receptor." });
      return;
    }
    if (!selectedWebhookEvents.length) {
      setNotice({ tone: "error", text: "Seleccioná al menos un evento para el webhook." });
      return;
    }
    setPendingAction("create-webhook");
    try {
      await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          name: webhookName.trim() || "production · nexID events",
          url: webhookUrl.trim(),
          signingSecret: webhookSecret,
          signatureVersion: "v2",
          enabled: true,
          events: selectedWebhookEvents,
        }),
      }).then(readJson);
      setWebhookUrl("");
      setWebhookSecret("");
      setNotice({ tone: "success", text: "Webhook activo. La primera entrega 2xx completará el checklist." });
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "No se pudo crear el webhook." });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Card className="p-4">
          <label className="text-xs uppercase tracking-[0.16em] text-slate-500" htmlFor="developer-tenant">Tenant operativo</label>
          <div className="mt-2 flex gap-2">
            <input
              id="developer-tenant"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              value={tenantInput}
              onChange={(event) => setTenantInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") applyTenant(); }}
              placeholder="tenant-slug"
              readOnly={Boolean(scopedTenant)}
              aria-describedby="developer-tenant-help"
            />
            {!scopedTenant ? <Button type="button" variant="secondary" onClick={applyTenant}>Aplicar</Button> : null}
          </div>
          <p id="developer-tenant-help" className="mt-2 text-xs text-slate-500">{scopedTenant ? "Fijado por tu sesión." : "Filtra credenciales y entregas."}</p>
        </Card>
        <Card className="p-4"><Metric label="Keys activas" value={String(activeKeys)} tone="text-cyan-200" /></Card>
        <Card className="p-4"><Metric label="Requests del mes" value={usage.monthRequests.toLocaleString("es-AR")} tone="text-emerald-200" /></Card>
        <Card className="p-4"><Metric label="Latencia media" value={usage.avgLatencyMs ? `${usage.avgLatencyMs} ms` : "—"} tone="text-amber-100" /></Card>
        <Card className="p-4"><Metric label="Webhooks activos" value={String(enabledWebhooks)} tone="text-violet-200" /></Card>
      </div>

      {isDemoData ? (
        <section id="developer-mutation-gate" role="status" className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-50">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <strong className="w-fit rounded-full border border-amber-200/35 bg-slate-950/45 px-3 py-1 text-xs uppercase tracking-[0.14em] text-amber-100">DEMO DATA · sólo lectura</strong>
            <span className="text-xs text-amber-100/80">Fuente: fallback aislado del dashboard</span>
          </div>
          <p className="mt-3 leading-6 text-amber-50/85">
            Keys, uso, webhooks y entregas son muestras ilustrativas. No cuentan como readiness de producción y los controles de creación, cambio o revocación permanecen deshabilitados.
          </p>
        </section>
      ) : null}

      {notice ? <NoticeBanner notice={notice} onRetry={notice.tone === "error" && loadFailed ? load : undefined} /> : null}
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {copyStatus ? `${copyStatus === "secret" ? "Secreto" : "Snippet"} copiado al portapapeles.` : ""}
      </span>

      <div className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <Card className="p-5" role="region" aria-labelledby="integration-readiness-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Onboarding operativo</p>
              <h2 id="integration-readiness-title" className="mt-2 text-xl font-semibold text-white">De cero a primera llamada</h2>
              <p className="mt-1 text-sm text-slate-400">Tres pasos obligatorios; webhooks sólo si tu sistema necesita eventos asíncronos.</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {isDemoData ? <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">No acredita producción</span> : null}
              <span className="rounded-full border border-white/10 bg-slate-950 px-3 py-1 font-mono text-sm text-cyan-100">{readiness.requiredComplete}/{readiness.requiredTotal}</span>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-label="Progreso de integración" aria-valuemin={0} aria-valuemax={100} aria-valuenow={readiness.percentage}>
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-[width]" style={{ width: `${readiness.percentage}%` }} />
          </div>
          <ol className="mt-5 space-y-3">
            {readiness.steps.map((step) => (
              <li key={step.id} className="flex gap-3 rounded-lg border border-white/10 bg-slate-950/65 p-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step.complete ? "bg-emerald-400 text-slate-950" : "border border-slate-600 text-slate-400"}`} aria-hidden="true">{step.complete ? "✓" : "·"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{step.label} {step.optional ? <span className="font-normal text-slate-500">· opcional</span> : null}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card className="min-w-0 overflow-hidden p-5" role="region" aria-labelledby="quickstart-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Quickstart server-side</p>
              <h2 id="quickstart-title" className="mt-2 text-xl font-semibold text-white">Primera verificación en minutos</h2>
              <p className="mt-1 text-sm text-slate-400">Usá valores reales del lector NFC. La API key nunca debe llegar al navegador o a la app móvil.</p>
            </div>
            <a href="https://nexid.lat/docs" target="_blank" rel="noreferrer" className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline">Documentación ↗</a>
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex gap-2" role="tablist" aria-label="Lenguaje del quickstart">
              {(["curl", "node"] as const).map((snippet) => (
                <button
                  key={snippet}
                  id={`quickstart-tab-${snippet}`}
                  ref={(node) => { snippetTabRefs.current[snippet] = node; }}
                  type="button"
                  role="tab"
                  aria-selected={activeSnippet === snippet}
                  aria-controls="quickstart-code-panel"
                  tabIndex={activeSnippet === snippet ? 0 : -1}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${activeSnippet === snippet ? "bg-cyan-400 text-slate-950" : "border border-white/10 text-slate-300 hover:border-cyan-300/40"}`}
                  onClick={() => setActiveSnippet(snippet)}
                  onKeyDown={(event) => {
                    if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) event.preventDefault();
                    moveSnippetTab(snippet, event.key);
                  }}
                >
                  {snippet === "curl" ? "cURL" : "Node.js"}
                </button>
              ))}
            </div>
            <Button className="ml-auto" type="button" variant="ghost" onClick={() => void copyValue(quickstart[activeSnippet], activeSnippet)}>{copyStatus === activeSnippet ? "Copiado" : "Copiar"}</Button>
          </div>
          <pre id="quickstart-code-panel" role="tabpanel" aria-labelledby={`quickstart-tab-${activeSnippet}`} tabIndex={0} className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-200"><code>{quickstart[activeSnippet]}</code></pre>
          <p className="mt-3 text-xs leading-5 text-slate-500">Una respuesta no-2xx incluye un motivo seguro. Conservá <code className="font-mono text-slate-300">traceId</code> para soporte y respetá <code className="font-mono text-slate-300">Retry-After</code> ante HTTP 429.</p>
        </Card>
      </div>

      <Card id="create-sdk-key" className="p-5" role="region" aria-labelledby="api-key-title">
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(280px,0.65fr)] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">API keys</p>
            <h2 id="api-key-title" className="mt-2 text-xl font-semibold text-white">Una credencial por servicio</h2>
            <p className="mt-1 text-sm text-slate-400">Elegí una ruta recomendada y ajustá sólo si tu arquitectura lo exige. No existe un preset de acceso total.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
            <label className="block text-sm text-slate-300" htmlFor="sdk-key-name">
              Nombre operativo
              <input id="sdk-key-name" className="mt-2 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={keyName} onChange={(event) => setKeyName(event.target.value)} autoComplete="off" />
            </label>
            <label className="block text-sm text-slate-300" htmlFor="sdk-key-expiry">
              Vencimiento
              <select id="sdk-key-expiry" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={keyExpiryDays} onChange={(event) => setKeyExpiryDays(event.target.value)}>
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="180">180 días</option>
                <option value="365">1 año</option>
                <option value="never">Sin vencimiento</option>
              </select>
            </label>
          </div>
        </div>

        <fieldset className="mt-5 border-t border-white/10 pt-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Ruta de integración</legend>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {SDK_INTEGRATION_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                aria-pressed={profileId === profile.id}
                onClick={() => chooseProfile(profile.id)}
                className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${profileId === profile.id ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-slate-950/65 hover:border-cyan-300/30"}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-200">{profile.label}</span>
                <span className="mt-2 block text-sm font-semibold text-white">{profile.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-400">{profile.description}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5 border-t border-white/10 pt-4">
          <legend className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Scopes efectivos</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {SDK_SCOPE_OPTIONS.map((scope) => (
              <label key={scope.value} className="flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-slate-950/70 p-3 transition hover:border-cyan-300/40">
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-cyan-400" checked={selectedScopes.includes(scope.value)} onChange={(event) => toggleScope(scope.value, event.target.checked)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-medium text-white">{scope.label}<span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${scope.access === "read" ? "bg-sky-400/10 text-sky-200" : "bg-amber-400/10 text-amber-100"}`}>{scope.access}</span></span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{scope.description}</span>
                  <span className="mt-1 block break-all font-mono text-[11px] text-cyan-200">{scope.value}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">{selectedScopes.length} de {SDK_SCOPE_OPTIONS.length} scopes · aplicá mínimo privilegio</p>
            <Button type="button" onClick={createKey} disabled={!mutationsAllowed || !tenant || !keyName.trim() || !selectedScopes.length || pendingAction !== null} aria-busy={pendingAction === "create-key"} aria-describedby={isDemoData ? "developer-mutation-gate" : undefined} title={!mutationsAllowed ? mutationDisabledHelp : undefined}>{pendingAction === "create-key" ? "Creando…" : "Crear key"}</Button>
          </div>
        </fieldset>

        {secret ? (
          <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-5" aria-labelledby="one-time-secret-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 id="one-time-secret-title" className="text-sm font-semibold text-emerald-100">Secreto visible una sola vez</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-100/75">Guardalo como <code className="font-mono">NEXID_API_KEY</code> en Vercel, Google Secret Manager o Vault. No lo pegues en código, tickets, email ni chat.</p>
              </div>
              <span className="w-fit rounded-full border border-emerald-300/25 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">live · server-side</span>
            </div>
            <div className="mt-4 break-all rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-xs text-emerald-100" tabIndex={0}>{secret}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" type="button" onClick={() => void copyValue(secret, "secret")}>{copyStatus === "secret" ? "Copiado" : "Copiar secreto"}</Button>
              <Button variant="ghost" type="button" onClick={() => { setSecret(""); setCopyStatus(null); }}>Ya lo guardé, ocultar</Button>
            </div>
          </section>
        ) : null}

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Credenciales SDK del tenant seleccionado</caption>
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr><th className="py-2">Nombre</th><th>Prefix</th><th>Scopes</th><th>Estado</th><th>Último uso</th><th>Vence</th><th><span className="sr-only">Acciones</span></th></tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-slate-300">
              {loading ? <tr><td className="py-6 text-slate-400" colSpan={7}>Cargando credenciales…</td></tr> : null}
              {!loading && !keys.length ? (
                <tr><td className="py-8" colSpan={7}><EmptyState title="Todavía no hay API keys" body="Elegí una ruta de integración, revisá los scopes y creá una credencial dedicada para tu backend." actionHref="#create-sdk-key" actionLabel="Configurar primera key" /></td></tr>
              ) : null}
              {!loading ? keys.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 font-medium text-white">{row.name}</td>
                  <td className="font-mono text-xs">{row.key_prefix}</td>
                  <td className="max-w-[300px]"><div className="flex flex-wrap gap-1.5">{stringList(row.scopes).map((scope) => <span key={scope} className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-300">{scope}</span>)}</div></td>
                  <td><StatusBadge tone={row.status === "active" ? "success" : "neutral"} label={row.status === "active" ? "Activa" : "Revocada"} /></td>
                  <td>{displayDate(row.last_used_at)}</td>
                  <td>{row.expires_at ? displayDate(row.expires_at) : "Sin vencimiento"}</td>
                  <td className="text-right">{row.status === "active" ? <Button type="button" variant="ghost" disabled={!mutationsAllowed || pendingAction !== null} aria-busy={pendingAction === `revoke:${row.id}`} aria-describedby={isDemoData ? "developer-mutation-gate" : undefined} title={!mutationsAllowed ? mutationDisabledHelp : undefined} onClick={() => void revokeKey(row)}>{pendingAction === `revoke:${row.id}` ? "Revocando…" : "Revocar"}</Button> : null}</td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="p-5" role="region" aria-labelledby="claim-policy-title">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Ownership · opcional</p>
          <h2 id="claim-policy-title" className="mt-2 text-xl font-semibold text-white">Compra antes que claim</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Para retail, exigí un POS token válido y sumá PIN sólo cuando caja u operación lo necesiten. Un tap de góndola no transfiere propiedad.</p>
          <div className="mt-5 space-y-3">
            <label className="block text-sm text-slate-300" htmlFor="claim-bid">Lote / BID</label>
            <input id="claim-bid" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={bid} onChange={(event) => setBid(event.target.value)} autoComplete="off" />
            <label className="block text-sm text-slate-300" htmlFor="claim-pin">PIN opcional</label>
            <input id="claim-pin" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={claimPin} onChange={(event) => setClaimPin(event.target.value)} placeholder="Ej: 4921" autoComplete="off" inputMode="numeric" />
            <Button type="button" onClick={saveClaimPolicy} disabled={!mutationsAllowed || !tenant || !bid.trim() || pendingAction !== null} aria-busy={pendingAction === "save-policy"} aria-describedby={isDemoData ? "developer-mutation-gate" : undefined} title={!mutationsAllowed ? mutationDisabledHelp : undefined}>{pendingAction === "save-policy" ? "Guardando…" : "Guardar política"}</Button>
          </div>
        </Card>

        <Card className="p-5" role="region" aria-labelledby="webhook-create-title">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Outbound webhooks</p>
          <h2 id="webhook-create-title" className="mt-2 text-xl font-semibold text-white">Eventos firmados hacia tu stack</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">El receptor debe verificar la firma sobre el body crudo antes de parsear JSON y responder 2xx rápido. Sólo se aceptan destinos HTTPS públicos.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-300" htmlFor="webhook-name">Nombre
              <input id="webhook-name" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={webhookName} onChange={(event) => setWebhookName(event.target.value)} autoComplete="off" />
            </label>
            <label className="text-sm text-slate-300" htmlFor="webhook-url">Endpoint HTTPS
              <input id="webhook-url" type="url" className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://example.com/webhooks/nexid" autoComplete="url" />
            </label>
          </div>
          <label className="mt-3 block text-sm text-slate-300" htmlFor="webhook-secret">Signing secret · mínimo 32 caracteres
            <input id="webhook-secret" type="password" minLength={32} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 font-mono text-sm text-white outline-none focus:border-cyan-300" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Generado por tu secret manager" autoComplete="new-password" />
          </label>
          <p className="mt-2 text-xs text-slate-500">nexID lo cifra al guardarlo. Conservá la misma versión en el secret manager del receptor.</p>
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Eventos suscritos</legend>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {WEBHOOK_EVENT_OPTIONS.map((eventOption) => (
                <label key={eventOption.value} className="flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-slate-950/65 p-3">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-cyan-400" checked={selectedWebhookEvents.includes(eventOption.value)} onChange={(event) => toggleWebhookEvent(eventOption.value, event.target.checked)} />
                  <span><span className="block text-sm font-medium text-white">{eventOption.label}</span><span className="mt-1 block text-xs leading-5 text-slate-400">{eventOption.description}</span><span className="mt-1 block font-mono text-[10px] text-cyan-200">{eventOption.value}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={createWebhook} disabled={!mutationsAllowed || !tenant || !webhookUrl.trim() || webhookSecret.length < 32 || !selectedWebhookEvents.length || pendingAction !== null} aria-busy={pendingAction === "create-webhook"} aria-describedby={isDemoData ? "developer-mutation-gate" : undefined} title={!mutationsAllowed ? mutationDisabledHelp : undefined}>{pendingAction === "create-webhook" ? "Validando…" : "Crear webhook activo"}</Button>
            <span className="text-xs text-slate-500">La URL se valida antes de activarse; redirects y redes privadas se rechazan.</span>
          </div>
          <details className="mt-5 rounded-xl border border-cyan-300/20 bg-slate-950/55 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-cyan-100">Implementar verificación de firma v2</summary>
            <div className="mt-4 space-y-4">
              <p className="text-xs leading-5 text-slate-400">
                Verificá los bytes exactos antes de parsear JSON, aceptá timestamps con hasta {NEXID_WEBHOOK_SIGNATURE_CONTRACT.toleranceSeconds} segundos de diferencia y compará el HMAC en tiempo constante. v2 autentica también el key ID; v1 queda sólo para endpoints legacy y su key ID no debe usarse para seleccionar secretos. El secreto se lee de <code className="font-mono text-slate-200">NEXID_WEBHOOK_SECRET</code>; nunca se copia dentro del snippet.
              </p>
              <div className="flex flex-wrap gap-1.5" aria-label="Headers obligatorios de firma webhook">
                {Object.values(NEXID_WEBHOOK_SIGNATURE_CONTRACT.headers).map((header) => (
                  <code key={header} className="rounded bg-slate-800 px-2 py-1 text-[10px] text-cyan-100">{header}</code>
                ))}
              </div>
              <p className="break-words font-mono text-[10px] leading-5 text-slate-500">
                envelope v2: version.timestamp.keyBytes.keyId.deliveryBytes.deliveryId.eventBytes.eventId.bodyBytes.rawBody · {NEXID_WEBHOOK_SIGNATURE_CONTRACT.algorithm}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-300">Node.js / Next.js route handler</span>
                <Button type="button" variant="ghost" onClick={() => void copyValue(webhookVerifier, "webhook")}>{copyStatus === "webhook" ? "Copiado" : "Copiar verificador"}</Button>
              </div>
              <pre tabIndex={0} aria-label="Verificador webhook v2 compatible con v1 para Node.js" className="max-h-[360px] overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs leading-6 text-slate-200"><code>{webhookVerifier}</code></pre>
            </div>
          </details>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5" role="region" aria-labelledby="webhook-list-title">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Destinos</p><h2 id="webhook-list-title" className="mt-2 text-xl font-semibold text-white">Webhooks configurados</h2></div>
            <Button type="button" variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? "Actualizando…" : "Actualizar"}</Button>
          </div>
          <div className="mt-5 space-y-3">
            {!loading ? webhooks.map((row) => (
              <article key={row.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-white">{row.name || "Webhook"}</p>
                  <StatusBadge tone={row.enabled ? "success" : "neutral"} label={row.enabled ? "Activo" : "Pausado"} />
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-400">{row.url}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">{stringList(row.events).map((eventName) => <span key={eventName} className="rounded bg-slate-800 px-2 py-1 font-mono text-[10px] text-slate-300">{eventName}</span>)}</div>
                <p className={`mt-3 text-xs ${row.has_signing_secret ? "text-emerald-200" : "text-rose-200"}`}>{row.has_signing_secret ? `Firma ${row.signature_version || "legacy"} configurada` : "Sin signing secret"}</p>
              </article>
            )) : null}
            {!loading && !webhooks.length ? <EmptyState title="Todavía no hay destinos" body="Creá un webhook sólo si ERP, CRM o e-commerce necesitan reaccionar a eventos sin consultar la API." actionHref="#webhook-create-title" actionLabel="Configurar webhook" /> : null}
          </div>
        </Card>

        <Card className="p-5" role="region" aria-labelledby="delivery-list-title">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Observabilidad</p><h2 id="delivery-list-title" className="mt-2 text-xl font-semibold text-white">Entregas recientes</h2></div>
            <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">últimas 20</span>
          </div>
          <div className="mt-5 space-y-3">
            {!loading ? deliveries.map((row) => {
              const statusLabel = row.ok ? "Entregado" : row.status === "retrying" ? "Reintentando" : row.status === "dead_letter" ? "Dead letter" : "Falló";
              return (
                <article key={row.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-white">{row.event_name}</p>
                    <StatusBadge tone={row.ok ? "success" : row.status === "retrying" ? "warning" : "error"} label={statusLabel} />
                  </div>
                  <p className="mt-2 break-all text-xs text-slate-400">{row.url}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-3">
                    <div><dt className="text-slate-600">HTTP</dt><dd className="mt-1 font-mono text-slate-200">{row.status_code ?? "—"}</dd></div>
                    <div><dt className="text-slate-600">Intentos</dt><dd className="mt-1 font-mono text-slate-200">{row.attempt_count ?? 0}</dd></div>
                    <div><dt className="text-slate-600">Último intento</dt><dd className="mt-1 text-slate-200">{displayDate(row.last_attempt_at || row.delivered_at)}</dd></div>
                  </dl>
                  {row.event_id ? <p className="mt-3 break-all font-mono text-[10px] text-slate-500">event {row.event_id}</p> : null}
                  {row.last_error ? <p className="mt-3 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">{row.last_error}</p> : null}
                  {!row.ok && row.next_attempt_at ? <p className="mt-2 text-xs text-amber-100">Próximo intento: {displayDate(row.next_attempt_at)}</p> : null}
                </article>
              );
            }) : null}
            {!loading && !deliveries.length ? <EmptyState title="Aún no hay entregas" body={enabledWebhooks ? "El historial aparecerá cuando nexID emita un evento suscrito. Una respuesta 2xx completará el onboarding." : "Primero configurá un webhook firmado; esta vista mostrará estado HTTP, intentos y errores seguros."} /> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return <><p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p><p className={`mt-2 truncate text-2xl font-bold ${tone}`}>{value}</p></>;
}

function NoticeBanner({ notice, onRetry }: { notice: Notice; onRetry?: () => Promise<void> }) {
  const tone = notice.tone === "success"
    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
    : notice.tone === "error"
      ? "border-rose-300/25 bg-rose-400/10 text-rose-100"
      : "border-cyan-300/25 bg-cyan-400/10 text-cyan-100";
  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${tone}`} role={notice.tone === "error" ? "alert" : "status"} aria-live={notice.tone === "error" ? "assertive" : "polite"}>
      <span>{notice.text}</span>
      {onRetry ? <Button type="button" variant="ghost" onClick={() => void onRetry()}>Reintentar</Button> : null}
    </div>
  );
}

function StatusBadge({ tone, label }: { tone: "success" | "warning" | "error" | "neutral"; label: string }) {
  const styles = tone === "success" ? "bg-emerald-400/10 text-emerald-200" : tone === "warning" ? "bg-amber-400/10 text-amber-100" : tone === "error" ? "bg-rose-400/10 text-rose-200" : "bg-slate-500/20 text-slate-300";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-xs ${styles}`}>{label}</span>;
}

function EmptyState({ title, body, actionHref, actionLabel }: { title: string; body: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-400">{body}</p>
      {actionHref && actionLabel ? <a href={actionHref} className="mt-3 inline-flex rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-400/10">{actionLabel}</a> : null}
    </div>
  );
}
