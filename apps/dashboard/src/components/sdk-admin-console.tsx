"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card } from "@product/ui";

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | string;
  status: string;
  last_used_at?: string | null;
};

type WebhookRow = {
  id: string;
  name?: string;
  url: string;
  enabled: boolean;
  events: string[] | string;
  has_signing_secret?: boolean;
};

type DeliveryRow = {
  id: string;
  event_name: string;
  url: string;
  ok: boolean;
  status_code?: number | null;
  last_error?: string | null;
};

function eventList(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch {
      return value;
    }
  }
  return "";
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = data && typeof data === "object" ? String((data as Record<string, unknown>).reason || (data as Record<string, unknown>).error || "") : "";
    throw new Error(reason || `HTTP ${res.status}`);
  }
  return data as Record<string, unknown>;
}

export function SdkAdminConsole({ tenantSlug }: { tenantSlug?: string | null }) {
  const scopedTenant = String(tenantSlug || "").trim().toLowerCase();
  const [tenantInput, setTenantInput] = useState(scopedTenant);
  const tenant = tenantInput.trim().toLowerCase();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [secret, setSecret] = useState("");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [usage, setUsage] = useState({ monthRequests: 0, avgLatencyMs: 0 });
  const [keyName, setKeyName] = useState("POS + SDK production key");
  const [bid, setBid] = useState("DEMO-2026-02");
  const [claimPin, setClaimPin] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    setTenantInput(scopedTenant);
  }, [scopedTenant]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const withTenant = (path: string, extra?: Record<string, string>) => {
        const params = new URLSearchParams(extra || {});
        if (tenant) params.set("tenant", tenant);
        const query = params.toString();
        return `${path}${query ? `?${query}` : ""}`;
      };
      const [keysPayload, webhooksPayload, deliveriesPayload] = await Promise.all([
        fetch(withTenant("/api/admin/sdk/api-keys"), { cache: "no-store" }).then(readJson),
        fetch(withTenant("/api/admin/webhooks"), { cache: "no-store" }).then(readJson),
        fetch(withTenant("/api/admin/webhook-deliveries", { limit: "10" }), { cache: "no-store" }).then(readJson),
      ]);
      setKeys(Array.isArray(keysPayload.rows) ? keysPayload.rows as ApiKeyRow[] : Array.isArray(keysPayload) ? keysPayload as ApiKeyRow[] : []);
      setUsage({
        monthRequests: Number((keysPayload.usage as Record<string, unknown> | undefined)?.monthRequests || 0),
        avgLatencyMs: Number((keysPayload.usage as Record<string, unknown> | undefined)?.avgLatencyMs || 0),
      });
      setWebhooks(Array.isArray(webhooksPayload) ? webhooksPayload as WebhookRow[] : Array.isArray(webhooksPayload.rows) ? webhooksPayload.rows as WebhookRow[] : []);
      setDeliveries(Array.isArray(deliveriesPayload) ? deliveriesPayload as DeliveryRow[] : Array.isArray(deliveriesPayload.rows) ? deliveriesPayload.rows as DeliveryRow[] : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar la consola SDK.");
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeys = useMemo(() => keys.filter((row) => row.status === "active").length, [keys]);
  const enabledWebhooks = useMemo(() => webhooks.filter((row) => row.enabled).length, [webhooks]);

  async function createKey() {
    setMessage("");
    setSecret("");
    if (!tenant) {
      setMessage("Elegí un tenant antes de crear una API key.");
      return;
    }
    try {
      const payload = await fetch("/api/admin/sdk/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, name: keyName }),
      }).then(readJson);
      setSecret(String(payload.secret || ""));
      setMessage("Key creada. Guardala ahora: el secreto no se vuelve a mostrar.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la key.");
    }
  }

  async function revokeKey(id: string) {
    setMessage("");
    try {
      await fetch(`/api/admin/sdk/api-keys/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "revoked" }),
      }).then(readJson);
      setMessage("Key revocada.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo revocar la key.");
    }
  }

  async function saveClaimPolicy() {
    setMessage("");
    if (!tenant) {
      setMessage("Elegí un tenant antes de cambiar una politica de claim.");
      return;
    }
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
      setMessage("Politica guardada: el claim queda bloqueado sin POS token valido.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la politica.");
    }
  }

  async function createWebhook() {
    setMessage("");
    if (!tenant) {
      setMessage("Elegí un tenant antes de crear un webhook.");
      return;
    }
    try {
      await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant,
          name: "SDK enterprise webhook",
          url: webhookUrl,
          signingSecret: webhookSecret || undefined,
          enabled: true,
          events: ["sdk.verify", "sdk.claim.created", "sdk.claim.claimed", "sdk.pos.activated", "sdk.external_event"],
        }),
      }).then(readJson);
      setWebhookUrl("");
      setWebhookSecret("");
      setMessage("Webhook activo.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el webhook.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Tenant operativo</p>
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
            value={tenantInput}
            onChange={(event) => setTenantInput(event.target.value)}
            placeholder="Sin filtro: vista global"
          />
        </Card>
        <Card className="p-4"><Metric label="Keys activas" value={String(activeKeys)} tone="text-cyan-200" /></Card>
        <Card className="p-4"><Metric label="Uso mensual" value={String(usage.monthRequests)} tone="text-emerald-200" /></Card>
        <Card className="p-4"><Metric label="Webhooks" value={String(enabledWebhooks)} tone="text-violet-200" /></Card>
      </div>

      {message ? <div className="rounded-lg border border-cyan-300/25 bg-cyan-400/10 p-3 text-sm text-cyan-100">{message}</div> : null}
      {secret ? (
        <Card className="border-emerald-300/25 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-100">Secreto visible una sola vez</p>
          <div className="mt-3 break-all rounded-lg border border-white/10 bg-slate-950 p-3 font-mono text-xs text-emerald-100">{secret}</div>
          <Button className="mt-3" variant="secondary" type="button" onClick={() => void navigator.clipboard?.writeText(secret)}>Copiar secreto</Button>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">API keys</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Integraciones por tenant</h2>
              <p className="mt-1 text-sm text-slate-400">Scopes: verify, claim, products, events y POS. Revoca al instante si un partner deja de operar.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className="min-w-0 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={keyName} onChange={(event) => setKeyName(event.target.value)} />
              <Button type="button" onClick={createKey}>Crear key</Button>
            </div>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr><th className="py-2">Nombre</th><th>Prefix</th><th>Scopes</th><th>Estado</th><th>Ultimo uso</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                {loading ? <tr><td className="py-4" colSpan={6}>Cargando...</td></tr> : null}
                {!loading && !keys.length ? <tr><td className="py-4" colSpan={6}>Sin keys todavia.</td></tr> : null}
                {keys.map((row) => (
                  <tr key={row.id}>
                    <td className="py-3 font-medium text-white">{row.name}</td>
                    <td className="font-mono text-xs">{row.key_prefix}</td>
                    <td className="max-w-[260px] truncate">{eventList(row.scopes)}</td>
                    <td><span className={`rounded-full px-2 py-1 text-xs ${row.status === "active" ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{row.status}</span></td>
                    <td>{row.last_used_at ? new Date(row.last_used_at).toLocaleString() : "never"}</td>
                    <td className="text-right">{row.status === "active" ? <Button type="button" variant="ghost" onClick={() => revokeKey(row.id)}>Revocar</Button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Claim seguro</p>
          <h2 className="mt-2 text-xl font-semibold text-white">POS + PIN para no reclamar desde gondola</h2>
          <p className="mt-1 text-sm text-slate-400">Una botella solo pasa a ownership automatico con tag fisico seguro y comprobante POS valido.</p>
          <div className="mt-5 space-y-3">
            <label className="block text-sm text-slate-300">Lote / BID</label>
            <input className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={bid} onChange={(event) => setBid(event.target.value)} />
            <label className="block text-sm text-slate-300">PIN opcional para caja o etiqueta cerrada</label>
            <input className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={claimPin} onChange={(event) => setClaimPin(event.target.value)} placeholder="Ej: 4921" />
            <Button type="button" onClick={saveClaimPolicy}>Guardar politica</Button>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Outbound webhooks</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Eventos hacia ERP, e-commerce o CRM</h2>
          <div className="mt-4 grid gap-3">
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://cliente.com/api/nexid/webhook" />
            <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Signing secret opcional" />
            <Button type="button" onClick={createWebhook} disabled={!webhookUrl.trim()}>Crear webhook</Button>
          </div>
          <div className="mt-5 space-y-3">
            {webhooks.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-white">{row.name || "Webhook"}</p>
                  <span className={`rounded-full px-2 py-1 text-xs ${row.enabled ? "bg-emerald-400/10 text-emerald-200" : "bg-slate-500/20 text-slate-300"}`}>{row.enabled ? "enabled" : "paused"}</span>
                </div>
                <p className="mt-1 truncate text-slate-400">{row.url}</p>
                <p className="mt-2 text-xs text-slate-500">{eventList(row.events)} {row.has_signing_secret ? " / signed" : ""}</p>
              </div>
            ))}
            {!webhooks.length ? <p className="text-sm text-slate-500">Sin webhooks configurados.</p> : null}
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Entregas recientes</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Auditoria para soporte enterprise</h2>
          <div className="mt-5 space-y-3">
            {deliveries.map((row) => (
              <div key={row.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-white">{row.event_name}</p>
                  <span className={`rounded-full px-2 py-1 text-xs ${row.ok ? "bg-emerald-400/10 text-emerald-200" : "bg-rose-400/10 text-rose-200"}`}>{row.ok ? "ok" : row.status_code || "fail"}</span>
                </div>
                <p className="mt-1 truncate text-slate-400">{row.url}</p>
                {row.last_error ? <p className="mt-2 text-xs text-rose-200">{row.last_error}</p> : null}
              </div>
            ))}
            {!deliveries.length ? <p className="text-sm text-slate-500">Todavia no hay entregas.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "text-white" }: { label: string; value: string; tone?: string }) {
  return (
    <>
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 truncate text-2xl font-bold ${tone}`}>{value}</p>
    </>
  );
}
