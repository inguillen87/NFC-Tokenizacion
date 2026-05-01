"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_CANONICAL_BATCH_ID, DEMO_TENANT_SLUG, DEMO_WINE_ITEM_ID } from "@product/config";
import { WorldMapRealtime } from "@product/ui";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type Vertical = "wine" | "events" | "cosmetics" | "agro";
type DemoMode = "consumer_tap" | "consumer_tamper" | "consumer_opened" | "consumer_duplicate";
type SimulationMode = "valid" | "tamper" | "replay";

type DemoEvent = {
  id?: string;
  result?: string;
  uidMasked?: string;
  created_at?: string;
  city?: string;
  country_code?: string;
  lat?: number | null;
  lng?: number | null;
  product_name?: string;
  sku?: string;
  vertical?: string;
};

type DemoSummary = {
  ok?: boolean;
  exists?: boolean;
  source?: string;
  tagCount?: number;
  crm?: { leads?: number; tickets?: number; orders?: number };
  events?: DemoEvent[];
  generatedAt?: string;
};

const LOCATIONS = {
  origin: {
    city: "Valle de Uco",
    country: "Argentina",
    countryCode: "AR",
    lat: -33.6131,
    lng: -69.2075,
    label: "Origen del producto",
  },
  mendoza: {
    city: "Mendoza",
    country: "Argentina",
    countryCode: "AR",
    lat: -32.8895,
    lng: -68.8458,
    label: "Bodega / control de calidad",
  },
  zurich: {
    city: "Zurich",
    country: "Switzerland",
    countryCode: "CH",
    lat: 47.3769,
    lng: 8.5417,
    label: "Tap del cliente",
  },
  miami: {
    city: "Miami",
    country: "USA",
    countryCode: "US",
    lat: 25.7617,
    lng: -80.1918,
    label: "Importador / retail",
  },
};

const beatToMode: Record<Beat, DemoMode> = {
  0: "consumer_tap",
  1: "consumer_tap",
  2: "consumer_duplicate",
  3: "consumer_opened",
};

const beatCopy: Record<Beat, { title: string; body: string; event: string; mode: SimulationMode; location: keyof typeof LOCATIONS }> = {
  0: {
    title: "1. Producto nacido en origen",
    body: "La bodega programa el lote, asocia cada UID fisico y deja lista la trazabilidad de origen.",
    event: "Batch + tags reales de DemoBodega listos para operar.",
    mode: "valid",
    location: "mendoza",
  },
  1: {
    title: "2. Tap del cliente en destino",
    body: "El consumidor toca la etiqueta, ve autenticidad, origen y una ruta clara desde Mendoza hasta su ubicacion.",
    event: "Tap valido en Zurich con distancia y link al origen.",
    mode: "valid",
    location: "zurich",
  },
  2: {
    title: "3. Replay o duplicado bloqueado",
    body: "La misma identidad fisica aparece con comportamiento sospechoso y el panel lo marca como riesgo.",
    event: "Replay signal para mostrar antifraude y operaciones.",
    mode: "replay",
    location: "zurich",
  },
  3: {
    title: "4. Apertura, ownership y tokenizacion",
    body: "Al romper sello o descorchar, el passport cambia de estado y abre club, garantia, marketplace y token premium.",
    event: "Sello abierto + CTA de ownership/tokenizacion.",
    mode: "tamper",
    location: "zurich",
  },
};

const roleCopy: Record<Role, { label: string; headline: string; focus: string }> = {
  ceo: {
    label: "CEO / investor",
    headline: "Historia comercial clara: hardware + SaaS + datos + canal",
    focus: "Mostra ROI, expansion reseller, proteccion de marca y fidelizacion post-tap.",
  },
  operator: {
    label: "Operaciones",
    headline: "Control real de lotes, UIDs, mapas y alertas",
    focus: "Aterriza el rollout: importacion, activacion, lecturas reales y excepciones de riesgo.",
  },
  buyer: {
    label: "Comprador",
    headline: "Confianza instantanea antes de comprar o consumir",
    focus: "La persona entiende origen, estado del sello, beneficios y marketplace sin friccion.",
  },
};

const verticals: Record<Vertical, { label: string; profile: string; product: string; visual: string; proof: string[] }> = {
  wine: {
    label: "Vino",
    profile: "NTAG 424 DNA TT",
    product: "Gran Reserva Malbec",
    visual: "hero-bottle scanning tampered",
    proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN dinamico anti-replay", "Origen Mendoza + tap global"],
  },
  events: {
    label: "Eventos",
    profile: "NTAG215",
    product: "Pulsera VIP",
    visual: "wristband-demo scanning",
    proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueo de reingreso duplicado"],
  },
  cosmetics: {
    label: "Cosmetica",
    profile: "NTAG 424 DNA",
    product: "Serum premium",
    visual: "cosmetic-demo scanning",
    proof: ["Tapa verificada", "Lote y vencimiento", "Garantia", "Anti grey-market"],
  },
  agro: {
    label: "Agro",
    profile: "QR + NFC UID",
    product: "Bolsa semilla",
    visual: "agro-demo tampered scanning",
    proof: ["Lote trazable", "Ficha tecnica", "Custodia logistica", "Activacion rural offline-first"],
  },
};

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function mapsLink(location: { lat: number; lng: number }) {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}

async function readDemoSummary(): Promise<DemoSummary> {
  const response = await fetch("/api/demo/summary", { cache: "no-store" });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) {
    throw new Error(String(data?.reason || "No se pudo leer DemoBodega."));
  }
  return data as DemoSummary;
}

export function DemoLabClient() {
  const [role, setRole] = useState<Role>("ceo");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [beat, setBeat] = useState<Beat>(1);
  const [running, setRunning] = useState<false | "cinematic">(false);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [status, setStatus] = useState("Conectando con DemoBodega...");
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await readDemoSummary();
        if (!alive) return;
        setSummary(next);
        setStatus(next.exists === false ? "DemoBodega aun no existe en API." : next.source === "public-proof" ? "Feed publico real conectado. Para escribir scans del tenant falta ADMIN_API_KEY en web." : "DemoBodega sincronizado con backend.");
      } catch (error) {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : "DemoBodega no disponible.");
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setBeat((current) => (current >= 3 ? 0 : ((current + 1) as Beat))), 6500);
    return () => window.clearInterval(id);
  }, [running]);

  const activeBeat = beatCopy[beat];
  const activeRole = roleCopy[role];
  const activeVertical = verticals[vertical];
  const destination = LOCATIONS[activeBeat.location];
  const routeKm = haversineKm(LOCATIONS.origin, destination);
  const liveEvents = Array.isArray(summary?.events) ? summary.events : [];
  const latestEvent = liveEvents[0];
  const livePoints = liveEvents.flatMap((event) => {
    const lat = toFiniteNumber(event.lat);
    const lng = toFiniteNumber(event.lng);
    if (lat === null || lng === null) return [];
    return [{
      city: event.city || "Unknown",
      country: event.country_code || "UNK",
      lat,
      lng,
      scans: 1,
      risk: /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "") ? 1 : 0,
      status: event.result || "UNKNOWN",
      lastSeen: event.created_at || new Date().toISOString(),
      vertical: event.vertical || vertical,
    }];
  });

  const mapPoints = useMemo(() => {
    const originPoint = {
      city: LOCATIONS.origin.city,
      country: LOCATIONS.origin.country,
      lat: LOCATIONS.origin.lat,
      lng: LOCATIONS.origin.lng,
      scans: 1,
      risk: 0,
      status: "PRODUCT_ORIGIN",
      lastSeen: new Date().toISOString(),
      vertical,
    };
    if (livePoints.length) return [originPoint, ...livePoints.slice(0, 18)];
    return [
      originPoint,
      {
        city: destination.city,
        country: destination.country,
        lat: destination.lat,
        lng: destination.lng,
        scans: 1,
        risk: activeBeat.mode === "replay" ? 1 : 0,
        status: activeBeat.mode === "tamper" ? "OPENED" : activeBeat.mode === "replay" ? "REPLAY_SIGNAL" : "AUTH_OK",
        lastSeen: new Date().toISOString(),
        vertical,
      },
    ];
  }, [activeBeat.mode, destination.city, destination.country, destination.lat, destination.lng, livePoints, vertical]);

  const mobileUrl = useMemo(
    () => `/demo-lab/mobile/${DEMO_TENANT_SLUG}/${DEMO_WINE_ITEM_ID}?pack=wine-secure&locale=es-AR&demoMode=${beatToMode[beat]}&bid=${DEMO_CANONICAL_BATCH_ID}`,
    [beat],
  );

  async function refreshSummary() {
    try {
      const next = await readDemoSummary();
      setSummary(next);
      setStatus(next.source === "public-proof" ? "Feed publico real conectado. Para escribir scans del tenant falta ADMIN_API_KEY en web." : "DemoBodega sincronizado con backend.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "DemoBodega no disponible.");
    }
  }

  async function simulate(mode: SimulationMode, locationKey: keyof typeof LOCATIONS) {
    const location = LOCATIONS[locationKey];
    setSimulating(true);
    setStatus(`Enviando scan ${mode} desde ${location.city}...`);
    try {
      const response = await fetch("/api/demo/simulate-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          city: location.city,
          countryCode: location.countryCode,
          lat: location.lat,
          lng: location.lng,
          deviceLabel: `Demo Lab - ${location.label}`,
        }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || payload?.ok === false) throw new Error(String(payload?.reason || payload?.payload?.reason || "scan failed"));
      setStatus(`Scan ${mode} registrado en DemoBodega.`);
      await refreshSummary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo simular el tap.");
    } finally {
      setSimulating(false);
    }
  }

  return (
    <main className="demo-lab-shell container-shell py-8 text-slate-100">
      <section className="demo-lab-hero rounded-3xl border border-cyan-300/20 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Demo Lab enterprise</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">Una demo viva: producto fisico, tap, mapa, portal y marketplace.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              Esta consola usa el tenant {DEMO_TENANT_SLUG}, el batch {DEMO_CANONICAL_BATCH_ID} y eventos reales cuando el backend esta disponible. El objetivo es vender la experiencia completa, no solo mostrar pantallas.
            </p>
          </div>
          <div className="grid min-w-[18rem] gap-2 text-xs sm:grid-cols-2">
            <a href="/" className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center font-semibold text-slate-100">Landing</a>
            <a href="/login" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-center font-semibold text-emerald-100">Ingresar</a>
            <a href="/sun" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center font-semibold text-cyan-100">SUN mobile</a>
            <a href="/me" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center font-semibold text-violet-100">Portal usuario</a>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { label: "Tags fisicos", value: summary?.tagCount === undefined ? "--" : String(summary.tagCount), detail: "DemoBodega / proveedor" },
            { label: "Eventos", value: String(liveEvents.length), detail: latestEvent ? `${latestEvent.city || "Unknown"} / ${latestEvent.result || "UNKNOWN"}` : "Sin feed reciente" },
            { label: "Portal", value: String(summary?.crm?.leads ?? 0), detail: "Leads / asociaciones" },
            { label: "Ruta origen-tap", value: `${routeKm.toLocaleString("es-AR")} km`, detail: `${LOCATIONS.origin.city} a ${destination.city}` },
          ].map((kpi) => (
            <div key={kpi.label} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{kpi.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Narrativa por audiencia</p>
              <h2 className="mt-2 text-2xl font-black text-white">{activeRole.headline}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeRole.focus}</p>
            </div>
            <button type="button" onClick={() => setRunning(running ? false : "cinematic")} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100">
              {running ? "Pausar cinematic" : "Iniciar cinematic"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(roleCopy) as Role[]).map((item) => (
              <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-full border px-3 py-2 text-xs font-bold ${role === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
                {roleCopy[item].label}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {([0, 1, 2, 3] as Beat[]).map((item) => (
              <button key={item} type="button" onClick={() => setBeat(item)} className={`rounded-2xl border p-3 text-left ${beat === item ? "border-emerald-300/45 bg-emerald-500/10" : "border-white/10 bg-slate-900/60"}`}>
                <p className="text-xs font-black text-white">{beatCopy[item].title}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">{beatCopy[item].body}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.82fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Producto fisico</p>
                  <h3 className="mt-1 text-xl font-black text-white">{activeVertical.product}</h3>
                </div>
                <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-100">{activeVertical.profile}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(verticals) as Vertical[]).map((item) => (
                  <button key={item} type="button" onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
                    {verticals[item].label}
                  </button>
                ))}
              </div>

              <div className="demo-lab-product-stage mt-4">
                <div className={activeVertical.visual} />
                <span className="demo-lab-product-label">nexID secure</span>
                <span className="demo-lab-tap-chip">SUN</span>
                <span className="demo-lab-tap-wave" />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {activeVertical.proof.map((item) => (
                  <p key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{item}</p>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Salida mobile sincronizada</p>
              <div className="demo-lab-phone mt-4 rounded-[2rem] border-[10px] border-slate-800 bg-slate-950 p-3">
                <div className="mx-auto mb-3 h-5 w-24 rounded-b-2xl bg-black" />
                <iframe title="demo mobile preview" src={mobileUrl} className="h-[32rem] w-full rounded-2xl border border-white/10 bg-slate-950" />
              </div>
            </div>
          </div>
        </article>

        <aside className="space-y-5">
          <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Command feed</p>
            <h2 className="mt-2 text-2xl font-black text-white">{activeBeat.event}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>

            <div className="mt-4 grid gap-2">
              <button type="button" disabled={simulating} onClick={() => void simulate("valid", "zurich")} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-left text-xs font-bold text-emerald-100 disabled:opacity-60">
                Registrar tap valido en Zurich
              </button>
              <button type="button" disabled={simulating} onClick={() => void simulate("tamper", "zurich")} className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-left text-xs font-bold text-amber-100 disabled:opacity-60">
                Romper sello / descorchar
              </button>
              <button type="button" disabled={simulating} onClick={() => void simulate("replay", "zurich")} className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-left text-xs font-bold text-rose-100 disabled:opacity-60">
                Simular replay duplicado
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">Eventos DemoBodega</p>
                <button type="button" onClick={() => void refreshSummary()} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200">Refresh</button>
              </div>
              <div className="mt-3 space-y-2">
                {liveEvents.slice(0, 6).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">Todavia no hay eventos geolocalizados disponibles desde la API.</p>
                ) : liveEvents.slice(0, 6).map((event) => (
                  <div key={event.id || `${event.created_at}-${event.uidMasked}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                    <p className="font-bold text-white">{event.city || "Unknown"}, {event.country_code || "UNK"} / {event.result || "UNKNOWN"}</p>
                    <p className="mt-1 text-slate-400">{event.product_name || activeVertical.product} / {event.uidMasked || "UID-NA"}</p>
                    <p className="mt-1 text-slate-500">{event.created_at || "sin timestamp"}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Portal + marketplace</p>
            <div className="mt-3 grid gap-2 text-xs text-slate-300">
              <p className="rounded-xl border border-white/10 bg-white/5 p-3">El cliente anonimo puede asociarse al portal despues del tap sin romper la privacidad.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3">El marketplace se abre por tenant: vouchers, club, recompra, garantia y experiencias.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3">La capa premium permite ownership, trazabilidad y tokenizacion sandbox en Polygon Amoy.</p>
            </div>
          </article>
        </aside>
      </section>

      <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-3 md:p-5">
        <WorldMapRealtime
          title="Mapa profesional origen vs tap"
          subtitle={`Origen ${LOCATIONS.origin.city} -> tap actual ${destination.city}. Distancia aproximada: ${routeKm.toLocaleString("es-AR")} km.`}
          points={mapPoints}
          routes={[{ fromLat: LOCATIONS.origin.lat, fromLng: LOCATIONS.origin.lng, toLat: destination.lat, toLng: destination.lng, tone: activeBeat.mode === "replay" ? "warn" : "info" }]}
          metadataRows={(point) => [
            { label: "Google Maps", value: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` },
            { label: "Abrir", value: mapsLink(point) },
          ]}
          initialExpanded
        />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-4">
        {[
          { title: "QR comun", body: "Barato y rapido para contenido o marketing. Sirve si el riesgo de copia es bajo." },
          { title: "NTAG215", body: "Ideal para pulseras, tickets y activaciones donde importa velocidad + UID serializado." },
          { title: "NTAG 424 DNA", body: "SUN dinamico por lectura para reducir replay, screenshots y clonacion simple." },
          { title: "424 DNA TT + blockchain", body: "Tamper fisico, estado abierto/cerrado y token premium opcional para ownership." },
        ].map((item) => (
          <article key={item.title} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-2 text-xs leading-6 text-slate-300">{item.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
