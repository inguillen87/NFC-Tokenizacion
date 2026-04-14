"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";
type ConsumerState = "AUTH_PENDING" | "VALID" | "OPENED" | "TAMPER_RISK" | "CLAIMED" | "REPLAY_SUSPECT";

type EventItem = { type: string; note: string; at: string };
type LeadIntent = "request_demo" | "talk_sales" | "become_reseller" | "request_quote" | "tokenization_optional";

type SeedItem = {
  uidHex?: string;
  uid_hex?: string;
  productName?: string;
  sku?: string;
  vintage?: string | number;
  region?: string;
  notes?: string;
  varietal?: string;
  alcohol?: string;
  barrelAging?: string;
  serviceTemperature?: string;
};

const MODE_STATE: Record<DemoMode, ConsumerState> = {
  consumer_tap: "VALID",
  consumer_opened: "OPENED",
  consumer_tamper: "TAMPER_RISK",
  consumer_duplicate: "REPLAY_SUSPECT",
};

const STATE_COPY: Record<ConsumerState, { label: string; tone: "green" | "amber" | "cyan" | "red"; message: string }> = {
  AUTH_PENDING: { label: "AUTH PENDING", tone: "cyan", message: "Verificando autenticidad criptográfica y estado del lote." },
  VALID: { label: "VALID", tone: "green", message: "Producto auténtico. Escaneo válido y trazabilidad activa." },
  OPENED: { label: "OPENED", tone: "cyan", message: "Producto abierto: estado transparente para comprador final." },
  TAMPER_RISK: { label: "TAMPER RISK", tone: "amber", message: "Riesgo de manipulación detectado en sello o contexto." },
  CLAIMED: { label: "CLAIMED", tone: "green", message: "Ownership activado para lifecycle, soporte y postventa." },
  REPLAY_SUSPECT: { label: "REPLAY SUSPECT", tone: "red", message: "Lectura sospechosa por repetición o posible clonación." },
};

function nowIso() {
  return new Date().toISOString();
}

function storeKey(tenant: string, itemId: string, pack: string) {
  return `nexid:mobile:${tenant}:${itemId}:${pack}`;
}

export function MobileDemoClient({
  tenant,
  itemId,
  pack,
  mode,
  locale,
  seedItems,
}: {
  tenant: string;
  itemId: string;
  pack: string;
  mode: DemoMode;
  locale: string;
  seedItems: SeedItem[];
}) {
  const [consumerState, setConsumerState] = useState<ConsumerState>("AUTH_PENDING");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [warrantyName, setWarrantyName] = useState("");
  const [warrantySaved, setWarrantySaved] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("request_demo");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadCountry, setLeadCountry] = useState("");
  const [leadRole, setLeadRole] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);

  const current = STATE_COPY[consumerState];
  const activeItem = useMemo(() => seedItems.find((item) => (item.uidHex || item.uid_hex || "").length > 0) || seedItems[0] || {}, [seedItems]);

  useEffect(() => {
    const mapped = MODE_STATE[mode] || "VALID";
    const t = window.setTimeout(() => setConsumerState(mapped), 450);
    return () => window.clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(storeKey(tenant, itemId, pack));
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as EventItem[];
      if (Array.isArray(parsed)) setEvents(parsed.slice(0, 12));
    } catch {
      // ignore corrupted local demo state
    }
  }, [tenant, itemId, pack]);

  function pushEvent(type: string, note: string) {
    const next = [{ type, note, at: nowIso() }, ...events].slice(0, 12);
    setEvents(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storeKey(tenant, itemId, pack), JSON.stringify(next));
    }
  }


  async function postCta(action: "claim-ownership" | "register-warranty" | "tokenize-request") {
    const bid = "DEMO-2026-02";
    const uid = String(activeItem.uidHex || activeItem.uid_hex || "").trim().toUpperCase();
    if (!uid) throw new Error("UID missing for CTA call");
    const response = await fetch(`/api/public-cta/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bid, uid, tenant, itemId, pack }),
    });
    const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.reason || `CTA failed (${response.status})`));
    }
    return data;
  }

  async function fetchProvenance() {
    const bid = "DEMO-2026-02";
    const uid = String(activeItem.uidHex || activeItem.uid_hex || "").trim().toUpperCase();
    if (!uid) throw new Error("UID missing for provenance");
    const url = new URL(`/api/public-cta/provenance`, window.location.origin);
    url.searchParams.set("bid", bid);
    url.searchParams.set("uid", uid);
    const response = await fetch(url.toString(), { method: "GET" });
    const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.reason || `Provenance failed (${response.status})`));
    }
    return data;
  }

  async function activateOwnership() {
    setConsumerState("CLAIMED");
    try {
      await postCta("claim-ownership");
      pushEvent("OWNERSHIP_CLAIMED", "Ownership activado y persistido en backend CTA.");
    } catch (error) {
      pushEvent("OWNERSHIP_CLAIMED_LOCAL", `Fallback local: ${error instanceof Error ? error.message : "CTA unavailable"}`);
    }
  }

  async function saveWarranty() {
    if (!warrantyName.trim()) return;
    setWarrantySaved(true);
    try {
      await postCta("register-warranty");
      pushEvent("WARRANTY_REGISTERED", `Garantía registrada para ${warrantyName.trim()} y persistida en backend.`);
    } catch (error) {
      pushEvent("WARRANTY_REGISTERED_LOCAL", `Fallback local: ${error instanceof Error ? error.message : "CTA unavailable"}`);
    }
  }

  function requestTokenization() {
    setShowTokenModal(true);
    setLeadIntent("tokenization_optional");
    pushEvent("TOKENIZATION_GATE_OPENED", "Interés en tokenización capturado (tokenization-ready).");
  }

  function openLeadFlow(intent: LeadIntent) {
    setLeadIntent(intent);
    setShowLeadModal(true);
  }

  async function saveLeadInterest() {
    if (!leadEmail.trim()) return;
    const payload = {
      name: leadName || "Demo visitor",
      email: leadEmail.trim(),
      company: leadCompany || "Unknown",
      country: leadCountry || "Unknown",
      role: leadRole || "Buyer",
      source: "public_mobile_demo",
      interest: leadIntent,
      message: leadMessage || "Lead captured from mobile preview CTA",
      vertical: pack,
      created_at: new Date().toISOString(),
    };
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // keep demo resilient even if backend is unavailable
    } finally {
      if (leadIntent === "tokenization_optional") {
        try {
          await postCta("tokenize-request");
          pushEvent("TOKENIZATION_REQUESTED", "Tokenización opcional solicitada y guardada en CTA backend.");
        } catch (error) {
          pushEvent("TOKENIZATION_REQUESTED_LOCAL", `Fallback local: ${error instanceof Error ? error.message : "CTA unavailable"}`);
        }
      }
      setLeadSaved(true);
      pushEvent("LEAD_CAPTURED", `${leadIntent} · ${leadEmail.trim()}`);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="mx-auto w-full max-w-[430px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Consumer App · {locale}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{current.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{current.message}</p>
              </div>
              <Badge tone={current.tone}>{current.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">Tenant: {tenant} · Item: {itemId} · Pack: {pack}</p>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Wine passport</h2>
            <p className="mt-2 text-lg font-semibold text-white">{activeItem.productName || "Reserva Demo 2024"}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <p>Varietal: <span className="text-white">{activeItem.varietal || "Malbec"}</span></p>
              <p>Vintage: <span className="text-white">{String(activeItem.vintage || "2024")}</span></p>
              <p>Alcohol: <span className="text-white">{activeItem.alcohol || "13.9%"}</span></p>
              <p>Barrel: <span className="text-white">{activeItem.barrelAging || "12 months"}</span></p>
              <p>Region: <span className="text-white">{activeItem.region || "Mendoza, AR"}</span></p>
              <p>Service: <span className="text-white">{activeItem.serviceTemperature || "16°C"}</span></p>
            </div>
            <p className="mt-2 text-slate-400">SKU {activeItem.sku || "wine-secure"} · UID {(activeItem.uidHex || activeItem.uid_hex || "-")}</p>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Ownership · Warranty · Provenance</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100" onClick={() => void activateOwnership()}>Activar ownership</button>
              <button type="button" className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-left text-violet-100" onClick={() => void saveWarranty()}>Registrar garantía</button>
              <button type="button" className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-amber-100" onClick={() => void (async () => {
                try {
                  const data = await fetchProvenance();
                  const total = Array.isArray((data as { actions?: unknown[] }).actions) ? (data as { actions: unknown[] }).actions.length : 0;
                  pushEvent("PROVENANCE_VIEWED", `Provenance consultada: ${total} acciones registradas.`);
                } catch (error) {
                  pushEvent("PROVENANCE_VIEWED_LOCAL", `Fallback local: ${error instanceof Error ? error.message : "provenance unavailable"}`);
                }
                setTimelineOpen((value) => !value);
              })()}>Ver provenance</button>
              <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-left text-white" onClick={requestTokenization}>Tokenización opcional</button>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900 p-2">
              <input value={warrantyName} onChange={(event) => setWarrantyName(event.target.value)} placeholder="Nombre para garantía" className="w-full rounded border border-white/10 bg-slate-950 px-2 py-1 text-white" />
              {warrantySaved ? <p className="mt-2 text-emerald-300">Garantía guardada y vinculada al lifecycle.</p> : null}
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Commercial CTA</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-left text-cyan-100" onClick={() => openLeadFlow("request_demo")}>Request Demo</button>
              <button type="button" className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-left text-violet-100" onClick={() => openLeadFlow("talk_sales")}>Talk to Sales</button>
              <button type="button" className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-left text-amber-100" onClick={() => openLeadFlow("become_reseller")}>Become Reseller</button>
              <button type="button" className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-left text-emerald-100" onClick={() => openLeadFlow("request_quote")}>Request Quote</button>
            </div>
          </Card>

          {timelineOpen ? (
            <Card className="p-4 text-xs text-slate-300">
              <h3 className="text-sm font-semibold text-white">Provenance timeline</h3>
              <div className="mt-2 space-y-2">
                {events.length ? events.map((event, index) => (
                  <div key={`${event.type}-${index}`} className="rounded-lg border border-white/10 bg-slate-900 p-2">
                    <p className="font-semibold text-white">{event.type}</p>
                    <p>{event.note}</p>
                    <p className="text-slate-400">{event.at}</p>
                  </div>
                )) : <p className="text-slate-400">Sin eventos todavía.</p>}
              </div>
            </Card>
          ) : null}
        </div>
      </div>

      {showTokenModal ? (
        <Card className="mx-auto max-w-[430px] border border-cyan-300/25 bg-slate-950/95 p-4 text-xs text-slate-300">
          <p className="text-sm font-semibold text-white">Tokenization-ready (feature gate)</p>
          <p className="mt-1">El backend de emisión on-chain no está activado en este demo público. Capturamos interés comercial y lead para CRM.</p>
          <input className="mt-3 w-full rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Email de contacto" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded border border-cyan-300/40 bg-cyan-500/10 px-3 py-1 text-cyan-100" onClick={saveLeadInterest}>Guardar interés</button>
            <button type="button" className="rounded border border-white/20 px-3 py-1 text-white" onClick={() => setShowTokenModal(false)}>Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Lead capturado para seguimiento comercial.</p> : null}
        </Card>
      ) : null}

      {showLeadModal ? (
        <Card className="mx-auto max-w-[430px] border border-violet-300/25 bg-slate-950/95 p-4 text-xs text-slate-300">
          <p className="text-sm font-semibold text-white">Lead capture · {leadIntent}</p>
          <p className="mt-1">Este CTA crea una oportunidad real en CRM-lite (o fallback local si el backend no responde).</p>
          <div className="mt-3 grid gap-2">
            <input className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Nombre" value={leadName} onChange={(event) => setLeadName(event.target.value)} />
            <input className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Email" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
            <input className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Compañía" value={leadCompany} onChange={(event) => setLeadCompany(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="País" value={leadCountry} onChange={(event) => setLeadCountry(event.target.value)} />
              <input className="rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Rol" value={leadRole} onChange={(event) => setLeadRole(event.target.value)} />
            </div>
            <textarea className="min-h-20 rounded border border-white/10 bg-slate-900 px-2 py-1 text-white" placeholder="Mensaje" value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} />
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="rounded border border-violet-300/40 bg-violet-500/10 px-3 py-1 text-violet-100" onClick={() => void saveLeadInterest()}>Guardar lead</button>
            <button type="button" className="rounded border border-white/20 px-3 py-1 text-white" onClick={() => setShowLeadModal(false)}>Cerrar</button>
          </div>
          {leadSaved ? <p className="mt-2 text-emerald-300">Lead guardado.</p> : null}
        </Card>
      ) : null}
    </main>
  );
}
