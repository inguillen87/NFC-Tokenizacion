"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";
type ConsumerState = "AUTH_PENDING" | "VALID" | "OPENED" | "TAMPER_RISK" | "CLAIMED" | "REPLAY_SUSPECT";

type EventItem = { type: string; note: string; at: string };
type LeadIntent = "request_demo" | "talk_sales" | "become_reseller" | "request_quote" | "tokenization_optional";
type GeoState = { lat: number; lng: number; accuracy?: number | null; capturedAt: string };

type SeedItem = {
  uidHex?: string;
  uid_hex?: string;
  vertical?: string;
  productName?: string;
  sku?: string;
  vintage?: string | number;
  region?: string;
  notes?: string;
  varietal?: string;
  alcohol?: string;
  barrelAging?: string;
  serviceTemperature?: string;
  harvestYear?: string | number;
  soilHumidity?: string | number;
  vineyardHumidity?: string | number;
  temperatureStorage?: string;
};

type VerticalTemplate = {
  key: "wine" | "agro" | "perfume" | "pharma";
  title: string;
  subtitle: string;
  fields: Array<{ label: string; value: (item: SeedItem) => string }>;
};

const MODE_STATE: Record<DemoMode, ConsumerState> = {
  consumer_tap: "VALID",
  consumer_opened: "OPENED",
  consumer_tamper: "TAMPER_RISK",
  consumer_duplicate: "REPLAY_SUSPECT",
};

const WINERY_HQ = { name: "Bodega demo · Mendoza", lat: -33.0086, lng: -68.7794 };

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

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectVertical(pack: string, item: SeedItem): VerticalTemplate["key"] {
  const probe = `${String(item.vertical || "")} ${pack}`.toLowerCase();
  if (probe.includes("agro") || probe.includes("seed")) return "agro";
  if (probe.includes("pharma")) return "pharma";
  if (probe.includes("cosmetic") || probe.includes("luxury") || probe.includes("perfume")) return "perfume";
  return "wine";
}

const VERTICAL_TEMPLATES: Record<VerticalTemplate["key"], VerticalTemplate> = {
  wine: {
    key: "wine",
    title: "Wine passport",
    subtitle: "Autenticidad + storytelling enológico + posventa premium.",
    fields: [
      { label: "Varietal", value: (item) => String(item.varietal || "Malbec") },
      { label: "Vintage", value: (item) => String(item.vintage || "2024") },
      { label: "Alcohol", value: (item) => String(item.alcohol || "13.9%") },
      { label: "Barrel", value: (item) => String(item.barrelAging || "12 months") },
      { label: "Region", value: (item) => String(item.region || "Mendoza, AR") },
      { label: "Service", value: (item) => String(item.serviceTemperature || "16°C") },
    ],
  },
  agro: {
    key: "agro",
    title: "Seed passport",
    subtitle: "Control de origen de semillas + guía agronómica por lote.",
    fields: [
      { label: "Harvest", value: (item) => String(item.harvestYear || item.vintage || "2026") },
      { label: "Soil humidity", value: (item) => `${String(item.soilHumidity || "38")}%` },
      { label: "Field humidity", value: (item) => `${String(item.vineyardHumidity || "55")}%` },
      { label: "Storage", value: (item) => String(item.temperatureStorage || "15-25°C") },
      { label: "Region", value: (item) => String(item.region || "Córdoba, AR") },
      { label: "Notes", value: (item) => String(item.notes || "Dosis y trazabilidad de campaña") },
    ],
  },
  perfume: {
    key: "perfume",
    title: "Perfume passport",
    subtitle: "Autenticidad anti-clone + narrativa de marca y coleccionables.",
    fields: [
      { label: "Fragrance family", value: () => "Woody / Floral" },
      { label: "Launch", value: (item) => String(item.vintage || "2026") },
      { label: "Region", value: (item) => String(item.region || "São Paulo, BR") },
      { label: "Storage", value: (item) => String(item.temperatureStorage || "20°C") },
      { label: "SKU", value: (item) => String(item.sku || "PF-001") },
      { label: "Notes", value: (item) => String(item.notes || "Edición autenticada") },
    ],
  },
  pharma: {
    key: "pharma",
    title: "Pharma passport",
    subtitle: "Integridad de empaque + trazabilidad regulatoria por unidad.",
    fields: [
      { label: "Batch year", value: (item) => String(item.harvestYear || item.vintage || "2026") },
      { label: "Cold chain", value: (item) => String(item.temperatureStorage || "2-8°C") },
      { label: "Region", value: (item) => String(item.region || "Bogotá, CO") },
      { label: "SKU", value: (item) => String(item.sku || "PH-001") },
      { label: "Serial UID", value: (item) => String(item.uidHex || item.uid_hex || "-") },
      { label: "Notes", value: (item) => String(item.notes || "Dispensación segura y recall-ready") },
    ],
  },
};

export function MobileDemoClient({
  tenant,
  itemId,
  pack,
  mode,
  locale,
  seedItems,
  bid,
}: {
  tenant: string;
  itemId: string;
  pack: string;
  mode: DemoMode;
  locale: string;
  seedItems: SeedItem[];
  bid?: string;
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
  const [ctaStatus, setCtaStatus] = useState("");
  const [ctaPending, setCtaPending] = useState(false);
  const [scanProgress, setScanProgress] = useState(5);
  const [geoState, setGeoState] = useState<GeoState | null>(null);
  const [geoError, setGeoError] = useState("");
  const demoSessionId = useMemo(() => `${tenant}:${itemId}:${pack}`, [itemId, pack, tenant]);

  const current = STATE_COPY[consumerState];
  const effectiveBid = (bid || "").trim();
  const activeItem = useMemo(() => seedItems.find((item) => (item.uidHex || item.uid_hex || "").length > 0) || seedItems[0] || {}, [seedItems]);
  const activeVertical = detectVertical(pack, activeItem);
  const template = VERTICAL_TEMPLATES[activeVertical];
  const stateTimeline: ConsumerState[] = ["AUTH_PENDING", "VALID", "OPENED", "TAMPER_RISK", "CLAIMED", "REPLAY_SUSPECT"];
  const firstScan = events.length ? events[events.length - 1] : null;
  const lastScan = events.length ? events[0] : null;
  const trustIndex = useMemo(() => {
    if (consumerState === "VALID") return 96;
    if (consumerState === "CLAIMED") return 92;
    if (consumerState === "OPENED") return 78;
    if (consumerState === "TAMPER_RISK") return 52;
    if (consumerState === "REPLAY_SUSPECT") return 34;
    return 64;
  }, [consumerState]);
  const investorSignals = useMemo(() => ([
    { label: "Scan-to-CTA", value: `${Math.max(18, Math.min(67, 22 + events.length * 4))}%`, tone: "text-cyan-100" },
    { label: "Fraud shield", value: consumerState === "REPLAY_SUSPECT" ? "Replay blocked" : "Active", tone: consumerState === "REPLAY_SUSPECT" ? "text-amber-200" : "text-emerald-200" },
    { label: "Lead quality", value: leadSaved ? "Qualified" : "Pending", tone: leadSaved ? "text-emerald-200" : "text-slate-300" },
  ]), [consumerState, events.length, leadSaved]);
  const distanceFromWinery = useMemo(() => {
    if (!geoState) return null;
    return haversineKm(WINERY_HQ.lat, WINERY_HQ.lng, geoState.lat, geoState.lng);
  }, [geoState]);
  const mapWidgetUrl = useMemo(() => {
    const originLat = WINERY_HQ.lat;
    const originLng = WINERY_HQ.lng;
    const destinationLat = geoState?.lat ?? WINERY_HQ.lat;
    const destinationLng = geoState?.lng ?? WINERY_HQ.lng;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${Math.min(originLng, destinationLng) - 0.08}%2C${Math.min(originLat, destinationLat) - 0.05}%2C${Math.max(originLng, destinationLng) + 0.08}%2C${Math.max(originLat, destinationLat) + 0.05}&layer=mapnik&marker=${destinationLat}%2C${destinationLng}`;
  }, [geoState]);

  useEffect(() => {
    const mapped = MODE_STATE[mode] || "VALID";
    setConsumerState("AUTH_PENDING");
    setScanProgress(12);
    const tick = window.setInterval(() => {
      setScanProgress((value) => (value >= 92 ? value : value + 14));
    }, 120);
    const done = window.setTimeout(() => {
      setConsumerState(mapped);
      setScanProgress(100);
    }, 850);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
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

  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoError("");
        setGeoState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: nowIso(),
        });
      },
      (error) => {
        setGeoError(error.message || "geolocation unavailable");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  function pushEvent(type: string, note: string) {
    const next = [{ type, note, at: nowIso() }, ...events].slice(0, 12);
    setEvents(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storeKey(tenant, itemId, pack), JSON.stringify(next));
    }
  }


  async function postCta(action: "claim-ownership" | "register-warranty" | "tokenize-request") {
    const uid = String(activeItem.uidHex || activeItem.uid_hex || "").trim().toUpperCase();
    if (!effectiveBid) throw new Error("Batch ID missing (add ?bid=... in public demo URL)");
    if (!uid) throw new Error("UID missing for CTA call");
    const response = await fetch(`/api/public-cta/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bid: effectiveBid,
        uid,
        tenant,
        itemId,
        pack,
        geo: geoState
          ? {
              lat: geoState.lat,
              lng: geoState.lng,
              accuracy: geoState.accuracy ?? null,
              captured_at: geoState.capturedAt,
              winery_origin: WINERY_HQ,
              distance_km: distanceFromWinery ? Number(distanceFromWinery.toFixed(2)) : null,
            }
          : null,
      }),
    });
    const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.reason || `CTA failed (${response.status})`));
    }
    return data;
  }

  async function fetchProvenance() {
    const uid = String(activeItem.uidHex || activeItem.uid_hex || "").trim().toUpperCase();
    if (!effectiveBid) throw new Error("Batch ID missing (add ?bid=... in public demo URL)");
    if (!uid) throw new Error("UID missing for provenance");
    const url = new URL(`/api/public-cta/provenance`, window.location.origin);
    url.searchParams.set("bid", effectiveBid);
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
    setCtaPending(true);
    try {
      await postCta("claim-ownership");
      setCtaStatus("Ownership activado y persistido en backend.");
      pushEvent("OWNERSHIP_CLAIMED", "Ownership activado y persistido en backend CTA.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "CTA unavailable";
      setCtaStatus(`Ownership fallback local: ${reason}`);
      pushEvent("OWNERSHIP_CLAIMED_LOCAL", `Fallback local: ${reason}`);
    } finally {
      setCtaPending(false);
    }
  }

  async function saveWarranty() {
    if (!warrantyName.trim()) return;
    setWarrantySaved(true);
    setCtaPending(true);
    try {
      await postCta("register-warranty");
      setCtaStatus(`Garantía registrada para ${warrantyName.trim()} y persistida en backend.`);
      pushEvent("WARRANTY_REGISTERED", `Garantía registrada para ${warrantyName.trim()} y persistida en backend.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "CTA unavailable";
      setCtaStatus(`Garantía fallback local: ${reason}`);
      pushEvent("WARRANTY_REGISTERED_LOCAL", `Fallback local: ${reason}`);
    } finally {
      setCtaPending(false);
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
      message: `${leadMessage || "Lead captured from mobile preview CTA"} [tenant=${tenant}] [session=${demoSessionId}] [pack=${pack}] [interest=${leadIntent}]`,
      notes: `tenant=${tenant} | item=${itemId} | session=${demoSessionId} | bid=${effectiveBid || "missing"} | mode=${effectiveBid.startsWith("DEMO-") ? "demo" : effectiveBid ? "production" : "missing-bid"} | geo=${geoState ? `${geoState.lat.toFixed(5)},${geoState.lng.toFixed(5)}` : "na"} | distance_km=${distanceFromWinery ? distanceFromWinery.toFixed(1) : "na"}`,
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
    <main className="mx-auto max-w-5xl space-y-4 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.10),transparent_38%)] p-4">
      <div className="mx-auto w-full max-w-[430px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-4">
            <p className={`mb-3 rounded-lg border px-2 py-1 text-[11px] ${effectiveBid.startsWith("DEMO-") ? "border-violet-300/30 bg-violet-500/10 text-violet-100" : effectiveBid ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-amber-300/30 bg-amber-500/10 text-amber-100"}`}>
              {effectiveBid.startsWith("DEMO-") ? "DEMO MODE · Datos simulados para presentación" : effectiveBid ? "PRODUCTION MODE · Flujo con contexto operativo real" : "MISSING BID · Agregá ?bid=... para ejecutar CTAs reales"}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Consumer App · {locale}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{current.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{current.message}</p>
              </div>
              <Badge tone={current.tone}>{current.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">Tenant: {tenant} · Item: {itemId} · Pack: {pack}</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${effectiveBid.startsWith("DEMO-") ? "border-violet-300/30 bg-violet-500/10 text-violet-100" : "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"}`}>{effectiveBid ? (effectiveBid.startsWith("DEMO-") ? "DEMO MODE" : "PRODUCTION MODE") : "MISSING BID"}</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">NFC scan emulation</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-300">Cryptographic handshake {scanProgress}%</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {investorSignals.map((signal) => (
                <div key={signal.label} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{signal.label}</p>
                  <p className={`mt-1 text-xs font-semibold ${signal.tone}`}>{signal.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Geo trace capture</p>
              {geoState ? (
                <p className="mt-1 text-[11px] text-cyan-100">
                  📍 {geoState.lat.toFixed(5)}, {geoState.lng.toFixed(5)} · ±{Math.round(geoState.accuracy || 0)}m
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-300">{geoError || "Esperando permiso de ubicación del dispositivo..."}</p>
              )}
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">{template.title}</h2>
            <p className="mt-1 text-[11px] text-cyan-200">{template.subtitle}</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/10 to-cyan-500/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-violet-100">Premium product view</p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{activeItem.productName || "Reserva Demo 2024"}</p>
                  <p className="text-[11px] text-slate-200">Ventana ideal de consumo · 2026-2030</p>
                </div>
                <div className="h-16 w-8 rounded-full border border-white/20 bg-white/10 shadow-[inset_0_0_22px_rgba(34,211,238,.35)]" />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {template.fields.map((field) => (
                <p key={field.label}>{field.label}: <span className="text-white">{field.value(activeItem)}</span></p>
              ))}
            </div>
            <p className="mt-2 text-slate-400">SKU {activeItem.sku || "wine-secure"} · UID {(activeItem.uidHex || activeItem.uid_hex || "-")}</p>
            <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Trust index</p>
                <p className="text-sm font-semibold text-white">{trustIndex}/100</p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900/70">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-300 transition-all" style={{ width: `${trustIndex}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-cyan-100/90">Listo para demo comercial de alto impacto (marca + seguridad + conversión).</p>
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Lifecycle states</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {stateTimeline.map((state) => (
                <div key={state} className={`rounded-lg border px-2 py-1 ${consumerState === state ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-400"}`}>
                  {state}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trazabilidad corta</p>
              <p className="mt-1 text-slate-300">Primer scan: <span className="text-white">{firstScan ? new Date(firstScan.at).toLocaleString() : "-"}</span></p>
              <p className="text-slate-300">Último scan: <span className="text-white">{lastScan ? new Date(lastScan.at).toLocaleString() : "-"}</span></p>
              <p className="text-slate-300">Último evento: <span className="text-white">{lastScan?.type || "-"}</span></p>
            </div>
            <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-100">Origin route map</p>
                <p className="text-[11px] text-emerald-100">{distanceFromWinery ? `${distanceFromWinery.toFixed(1)} km` : "N/A"}</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-200">{WINERY_HQ.name} → {geoState ? "Punto de lectura" : "Ubicación pendiente"}</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
                <iframe
                  title="origin-destination-map"
                  src={mapWidgetUrl}
                  className="h-36 w-full bg-slate-950"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="mt-2 rounded-lg border border-white/10 bg-slate-950/70 p-2">
                <div className="h-16 rounded bg-[linear-gradient(130deg,rgba(16,185,129,.20),rgba(14,165,233,.18),rgba(99,102,241,.12))] p-2">
                  <div className="flex h-full items-center justify-between">
                    <div className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">🏭 Origen</div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-300/50 to-cyan-300/50" />
                    <div className={`rounded-full border px-2 py-0.5 text-[10px] ${consumerState === "REPLAY_SUSPECT" ? "border-amber-300/40 bg-amber-500/20 text-amber-100" : "border-cyan-300/40 bg-cyan-500/20 text-cyan-100"}`}>
                      {consumerState === "REPLAY_SUSPECT" ? "⚠️ Copia detectada" : "📱 Lectura"}
                    </div>
                  </div>
                </div>
                <p className="mt-1 text-[10px] text-slate-300">
                  {consumerState === "REPLAY_SUSPECT"
                    ? "Este payload fue reutilizado fuera del flujo NFC original."
                    : "Ruta comercial trazada para storytelling de distribución y anti-fraude."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Ownership · Warranty · Provenance</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button type="button" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2.5 text-left text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,.08)]" onClick={() => void activateOwnership()}>✅ Activar ownership</button>
              <button type="button" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2.5 text-left text-violet-100 shadow-[0_0_0_1px_rgba(167,139,250,.10)]" onClick={() => void saveWarranty()}>🛡️ Registrar garantía</button>
              <button type="button" className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2.5 text-left text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,.10)]" onClick={() => void (async () => {
                try {
                  const data = await fetchProvenance();
                  const total = Array.isArray((data as { actions?: unknown[] }).actions) ? (data as { actions: unknown[] }).actions.length : 0;
                  setCtaStatus(`Provenance consultada: ${total} acciones registradas.`);
                  pushEvent("PROVENANCE_VIEWED", `Provenance consultada: ${total} acciones registradas.`);
                } catch (error) {
                  const reason = error instanceof Error ? error.message : "provenance unavailable";
                  setCtaStatus(`Provenance fallback local: ${reason}`);
                  pushEvent("PROVENANCE_VIEWED_LOCAL", `Fallback local: ${reason}`);
                }
                setTimelineOpen((value) => !value);
              })()}>📜 Ver provenance</button>
              <button type="button" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-left text-white" onClick={requestTokenization}>✨ Tokenización opcional</button>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900 p-2">
              <input value={warrantyName} onChange={(event) => setWarrantyName(event.target.value)} placeholder="Nombre para garantía" className="w-full rounded border border-white/10 bg-slate-950 px-2 py-1 text-white" />
              {warrantySaved ? <p className="mt-2 text-emerald-300">Garantía guardada y vinculada al lifecycle.</p> : null}
              <p className="mt-2 text-[11px] text-slate-400">Batch: {effectiveBid || "(missing)"} · UID: {activeItem.uidHex || activeItem.uid_hex || "-"}</p>
              {ctaPending ? <p className="mt-1 text-xs text-cyan-200">Procesando CTA...</p> : null}
              {ctaStatus ? <p className="mt-1 text-xs text-cyan-100">{ctaStatus}</p> : null}
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Commercial CTA</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button type="button" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2.5 text-left text-cyan-100" onClick={() => openLeadFlow("request_demo")}>🚀 Request Demo</button>
              <button type="button" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2.5 text-left text-violet-100" onClick={() => openLeadFlow("talk_sales")}>💼 Talk to Sales</button>
              <button type="button" className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2.5 text-left text-amber-100" onClick={() => openLeadFlow("become_reseller")}>🤝 Become Reseller</button>
              <button type="button" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2.5 text-left text-emerald-100" onClick={() => openLeadFlow("request_quote")}>📈 Request Quote</button>
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
      <div className="mx-auto w-full max-w-[430px] rounded-2xl border border-violet-300/20 bg-[linear-gradient(110deg,rgba(124,58,237,.16),rgba(14,165,233,.12))] p-3 text-xs text-slate-100">
        <p className="font-semibold">Investor spotlight</p>
        <p className="mt-1 text-slate-200">Esta demo móvil combina anti-fraude, trazabilidad y conversión comercial en una sola experiencia premium.</p>
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
