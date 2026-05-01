"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_TENANT_SLUG } from "@product/config";
import type { AppLocale } from "@product/config";
import { WorldMapRealtime } from "@product/ui";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type Vertical = "wine" | "events" | "cosmetics" | "agro";
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
};

const LOCATIONS = {
  origin: { city: "Valle de Uco", country: "Argentina", countryCode: "AR", lat: -33.6131, lng: -69.2075, label: "Origen del producto" },
  mendoza: { city: "Mendoza", country: "Argentina", countryCode: "AR", lat: -32.8895, lng: -68.8458, label: "Bodega / QA" },
  zurich: { city: "Zurich", country: "Switzerland", countryCode: "CH", lat: 47.3769, lng: 8.5417, label: "Tap del cliente" },
};

type DemoLocation = (typeof LOCATIONS)[keyof typeof LOCATIONS];

const STABLE_DEMO_TIME = "2026-05-01T00:00:00.000Z";

const copy: Record<AppLocale, {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  nav: { landing: string; login: string; sun: string; portal: string };
  kpis: { tags: string; events: string; portal: string; route: string; noFeed: string; leads: string };
  roles: Record<Role, { label: string; headline: string; focus: string }>;
  beats: Record<Beat, { title: string; body: string; event: string; mode: SimulationMode; location: keyof typeof LOCATIONS; status: string; cta: string }>;
  verticals: Record<Vertical, { label: string; profile: string; product: string; visual: string; proof: string[] }>;
  controls: { narrative: string; cinematicStart: string; cinematicStop: string; product: string; mobile: string; feed: string; valid: string; tamper: string; replay: string; refresh: string; marketplace: string; mapTitle: string; mapSubtitle: string; realFeed: string; adminKey: string; noGeo: string; origin: string; currentTap: string; distance: string; openOrigin: string; openTap: string; joinClub: string; warranty: string; tokenize: string; syncing: string; synced: string; unavailable: string; sendingScan: string; registeredScan: string; failedScan: string; configs: Array<{ title: string; body: string }> };
}> = {
  "es-AR": {
    heroEyebrow: "Demo Lab enterprise",
    heroTitle: "Mira como un producto fisico se vuelve verificable, vendible y medible.",
    heroBody: "Una demo para vender la historia completa: origen, tap del cliente, seguridad, portal, marketplace y datos de negocio.",
    nav: { landing: "Landing", login: "Ingresar", sun: "SUN mobile", portal: "Portal usuario" },
    kpis: { tags: "Tags fisicos", events: "Eventos", portal: "Portal", route: "Ruta origen-tap", noFeed: "Sin feed reciente", leads: "Leads / asociaciones" },
    roles: {
      ceo: { label: "CEO / inversor", headline: "Del tap al revenue: proteccion de marca, datos y fidelizacion.", focus: "Usalo para mostrar margen, canal reseller y valor recurrente sin entrar en jerga tecnica." },
      operator: { label: "Operaciones", headline: "Control real de lotes, UIDs, mapas y alertas.", focus: "Aterriza importacion, activacion, lecturas reales y excepciones de riesgo." },
      buyer: { label: "Comprador", headline: "Confianza instantanea antes de comprar o consumir.", focus: "La persona entiende origen, estado del sello, beneficios y proximo paso." },
    },
    beats: {
      0: { title: "1. Nace el producto", body: "La marca activa lote, UID y origen.", event: "Lote real conectado a DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "Ver origen" },
      1: { title: "2. Tap del cliente", body: "El consumidor verifica y ve distancia.", event: "Tap valido en Zurich con ruta al origen.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Unirme al club" },
      2: { title: "3. Riesgo bloqueado", body: "Replay o duplicado entra al feed.", event: "Replay signal para antifraude.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "Ver alerta" },
      3: { title: "4. Apertura + venta", body: "El sello cambia estado y abre beneficios.", event: "Sello abierto + CTA de ownership/tokenizacion.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Activar ownership" },
    },
    verticals: {
      wine: { label: "Vino", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN anti-replay", "Origen + tap global"] },
      events: { label: "Eventos", profile: "NTAG215", product: "Pulsera VIP", visual: "wristband-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueo de reingreso"] },
      cosmetics: { label: "Cosmetica", profile: "NTAG 424 DNA", product: "Serum premium", visual: "cosmetic-demo", proof: ["Tapa verificada", "Lote y vencimiento", "Garantia", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Bolsa semilla", visual: "agro-demo", proof: ["Lote trazable", "Ficha tecnica", "Custodia logistica", "Uso rural"] },
    },
    controls: {
      narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Producto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar tap valido en Zurich", tamper: "Romper sello / descorchar", replay: "Simular replay duplicado", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origen del producto vs tap del cliente", mapSubtitle: "Linea animada, distancia y links de ubicacion para construir confianza.", realFeed: "Feed publico real conectado.", adminKey: "Para escribir scans del tenant falta ADMIN_API_KEY en web.", noGeo: "Todavia no hay eventos geolocalizados disponibles desde la API.", origin: "Origen", currentTap: "Tap actual", distance: "Distancia", openOrigin: "Abrir origen", openTap: "Abrir tap", joinClub: "Unirme al club", warranty: "Activar garantia", tokenize: "Tokenizar premium", syncing: "Conectando con DemoBodega...", synced: "DemoBodega sincronizado con backend.", unavailable: "DemoBodega no disponible.", sendingScan: "Enviando scan", registeredScan: "Scan registrado en DemoBodega.", failedScan: "No se pudo simular el tap.", configs: [
        { title: "QR comun", body: "Rapido y barato para contenido o marketing; no protege contra copia." },
        { title: "NTAG215", body: "Perfecto para pulseras, tickets y activaciones con UID serializado." },
        { title: "NTAG 424 DNA", body: "SUN dinamico para bajar replay, screenshots y clonacion simple." },
        { title: "424 DNA TT + blockchain", body: "Tamper fisico, estado abierto/cerrado y token premium opcional." },
      ] },
  },
  "pt-BR": {
    heroEyebrow: "Demo Lab enterprise",
    heroTitle: "Veja como um produto fisico vira confianca, dados e receita.",
    heroBody: "Uma demo para vender a historia completa: origem, toque do cliente, seguranca, portal, marketplace e dados de negocio.",
    nav: { landing: "Landing", login: "Entrar", sun: "SUN mobile", portal: "Portal usuario" },
    kpis: { tags: "Tags fisicas", events: "Eventos", portal: "Portal", route: "Rota origem-toque", noFeed: "Sem feed recente", leads: "Leads / associacoes" },
    roles: {
      ceo: { label: "CEO / investidor", headline: "Do toque ao revenue: marca protegida, dados e fidelizacao.", focus: "Use para mostrar margem, canal revendedor e receita recorrente sem jargao tecnico." },
      operator: { label: "Operacoes", headline: "Controle de lotes, UIDs, mapas e alertas.", focus: "Mostra importacao, ativacao, leituras reais e excecoes de risco." },
      buyer: { label: "Comprador", headline: "Confianca instantanea antes de comprar ou consumir.", focus: "A pessoa entende origem, estado do lacre, beneficios e proximo passo." },
    },
    beats: {
      0: { title: "1. Produto nasce", body: "A marca ativa lote, UID e origem.", event: "Lote real conectado ao DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "Ver origem" },
      1: { title: "2. Toque do cliente", body: "O consumidor verifica e ve distancia.", event: "Toque valido em Zurique com rota de origem.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Entrar no clube" },
      2: { title: "3. Risco bloqueado", body: "Replay ou duplicata entra no feed.", event: "Replay signal para antifraude.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "Ver alerta" },
      3: { title: "4. Abertura + venda", body: "O lacre muda estado e abre beneficios.", event: "Lacre aberto + ownership/tokenizacao.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Ativar ownership" },
    },
    verticals: {
      wine: { label: "Vinho", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta na garrafa", "Rolha / lacre aberto", "SUN anti-replay", "Origem + toque global"] },
      events: { label: "Eventos", profile: "NTAG215", product: "Pulseira VIP", visual: "wristband-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueio duplicado"] },
      cosmetics: { label: "Cosmeticos", profile: "NTAG 424 DNA", product: "Serum premium", visual: "cosmetic-demo", proof: ["Tampa verificada", "Lote e validade", "Garantia", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Saco de semente", visual: "agro-demo", proof: ["Lote rastreavel", "Ficha tecnica", "Custodia logistica", "Uso rural"] },
    },
    controls: { narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Produto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar toque valido em Zurique", tamper: "Abrir lacre / rolha", replay: "Simular replay duplicado", refresh: "Atualizar", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origem do produto vs toque do cliente", mapSubtitle: "Linha animada, distancia e links de localizacao para construir confianca.", realFeed: "Feed publico real conectado.", adminKey: "Para gravar scans do tenant falta ADMIN_API_KEY no web.", noGeo: "Ainda nao ha eventos geolocalizados na API.", origin: "Origem", currentTap: "Toque atual", distance: "Distancia", openOrigin: "Abrir origem", openTap: "Abrir toque", joinClub: "Entrar no clube", warranty: "Ativar garantia", tokenize: "Tokenizar premium", syncing: "Conectando ao DemoBodega...", synced: "DemoBodega sincronizado com backend.", unavailable: "DemoBodega indisponivel.", sendingScan: "Enviando scan", registeredScan: "Scan registrado no DemoBodega.", failedScan: "Nao foi possivel simular o toque.", configs: [
      { title: "QR comum", body: "Rapido e barato para conteudo; nao protege contra copia." },
      { title: "NTAG215", body: "Ideal para pulseiras, tickets e ativacoes com UID serializado." },
      { title: "NTAG 424 DNA", body: "SUN dinamico contra replay, screenshots e clonagem simples." },
      { title: "424 DNA TT + blockchain", body: "Tamper fisico, estado aberto/fechado e token premium opcional." },
    ] },
  },
  en: {
    heroEyebrow: "Enterprise Demo Lab",
    heroTitle: "See a physical product become trust, data, and revenue.",
    heroBody: "A sales-ready demo for origin, customer tap, security, portal, marketplace and business analytics.",
    nav: { landing: "Landing", login: "Login", sun: "SUN mobile", portal: "User portal" },
    kpis: { tags: "Physical tags", events: "Events", portal: "Portal", route: "Origin-tap route", noFeed: "No recent feed", leads: "Leads / associations" },
    roles: {
      ceo: { label: "CEO / investor", headline: "From tap to revenue: protected brand, data and loyalty.", focus: "Show margin, reseller channel and recurring value without technical friction." },
      operator: { label: "Operations", headline: "Real control for batches, UIDs, maps and alerts.", focus: "Ground the rollout: import, activation, live scans and risk exceptions." },
      buyer: { label: "Buyer", headline: "Instant confidence before buying or consuming.", focus: "People understand origin, seal status, benefits and the next action." },
    },
    beats: {
      0: { title: "1. Product origin", body: "Brand activates batch, UID and origin.", event: "Real batch connected to DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "View origin" },
      1: { title: "2. Customer tap", body: "Consumer verifies and sees distance.", event: "Valid Zurich tap with origin route.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Join club" },
      2: { title: "3. Risk blocked", body: "Replay or duplicate enters the feed.", event: "Replay signal for anti-fraud.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "View alert" },
      3: { title: "4. Open + monetize", body: "Seal state changes and benefits open.", event: "Opened seal + ownership/tokenization CTA.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Activate ownership" },
    },
    verticals: {
      wine: { label: "Wine", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Label on bottle", "Uncork / broken seal", "SUN anti-replay", "Origin + global tap"] },
      events: { label: "Events", profile: "NTAG215", product: "VIP wristband", visual: "wristband-demo", proof: ["Fast check-in", "Serialized UID", "VIP zones", "Duplicate block"] },
      cosmetics: { label: "Cosmetics", profile: "NTAG 424 DNA", product: "Premium serum", visual: "cosmetic-demo", proof: ["Verified cap", "Batch and expiry", "Warranty", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Seed bag", visual: "agro-demo", proof: ["Traceable lot", "Technical sheet", "Logistics custody", "Rural use"] },
    },
    controls: { narrative: "Audience narrative", cinematicStart: "Start cinematic", cinematicStop: "Pause cinematic", product: "Physical product", mobile: "Mobile result", feed: "Command feed", valid: "Register valid Zurich tap", tamper: "Break seal / uncork", replay: "Simulate duplicate replay", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Live map: product origin vs customer tap", mapSubtitle: "Animated route, distance and location links to build trust.", realFeed: "Real public feed connected.", adminKey: "ADMIN_API_KEY is required in web to write tenant scans.", noGeo: "No geolocated API events yet.", origin: "Origin", currentTap: "Current tap", distance: "Distance", openOrigin: "Open origin", openTap: "Open tap", joinClub: "Join club", warranty: "Activate warranty", tokenize: "Tokenize premium", syncing: "Connecting to DemoBodega...", synced: "DemoBodega synced with backend.", unavailable: "DemoBodega unavailable.", sendingScan: "Sending scan", registeredScan: "Scan registered in DemoBodega.", failedScan: "Could not simulate the tap.", configs: [
      { title: "Common QR", body: "Fast and cheap for content; does not protect against copying." },
      { title: "NTAG215", body: "Best for wristbands, tickets and serialized activations." },
      { title: "NTAG 424 DNA", body: "Dynamic SUN to reduce replay, screenshots and simple cloning." },
      { title: "424 DNA TT + blockchain", body: "Physical tamper, open/closed state and optional premium token." },
    ] },
  },
};

type DemoCopy = (typeof copy)["es-AR"];

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
  if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "No se pudo leer DemoBodega."));
  return data as DemoSummary;
}

export function DemoLabClient({ locale }: { locale: AppLocale }) {
  const txt = copy[locale] || copy["es-AR"];
  const [role, setRole] = useState<Role>("ceo");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [beat, setBeat] = useState<Beat>(1);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [status, setStatus] = useState(txt.controls.syncing);
  const [simulating, setSimulating] = useState(false);
  const [fallbackLastSeen, setFallbackLastSeen] = useState(STABLE_DEMO_TIME);

  useEffect(() => setFallbackLastSeen(new Date().toISOString()), []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await readDemoSummary();
        if (!alive) return;
        setSummary(next);
        setStatus(next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
      } catch (error) {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [txt.controls.adminKey, txt.controls.realFeed]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setBeat((current) => (current >= 3 ? 0 : ((current + 1) as Beat))), 5000);
    return () => window.clearInterval(id);
  }, [running]);

  const activeBeat = txt.beats[beat];
  const activeRole = txt.roles[role];
  const activeVertical = txt.verticals[vertical];
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
      lastSeen: event.created_at || fallbackLastSeen,
      vertical,
    }];
  });

  const mapPoints = useMemo(() => {
    const originPoint = { city: LOCATIONS.origin.city, country: LOCATIONS.origin.country, lat: LOCATIONS.origin.lat, lng: LOCATIONS.origin.lng, scans: 1, risk: 0, status: "PRODUCT_ORIGIN", lastSeen: fallbackLastSeen, vertical };
    if (livePoints.length) return [originPoint, ...livePoints.slice(0, 18)];
    return [originPoint, { city: destination.city, country: destination.country, lat: destination.lat, lng: destination.lng, scans: 1, risk: activeBeat.mode === "replay" ? 1 : 0, status: activeBeat.status, lastSeen: fallbackLastSeen, vertical }];
  }, [activeBeat.mode, activeBeat.status, destination, fallbackLastSeen, livePoints, vertical]);

  async function refreshSummary() {
    try {
      const next = await readDemoSummary();
      setSummary(next);
      setStatus(next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
    }
  }

  async function simulate(mode: SimulationMode) {
    setSimulating(true);
    setStatus(`${txt.controls.sendingScan} ${mode} - ${destination.city}...`);
    try {
      const response = await fetch("/api/demo/simulate-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, city: destination.city, countryCode: destination.countryCode, lat: destination.lat, lng: destination.lng, deviceLabel: `Demo Lab - ${destination.label}` }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || payload?.ok === false) throw new Error(String(payload?.reason || payload?.payload?.reason || "scan failed"));
      setStatus(`${mode.toUpperCase()}: ${txt.controls.registeredScan}`);
      await refreshSummary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.failedScan);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <main className="demo-lab-shell container-shell py-8 text-slate-100">
      <section className="demo-lab-hero rounded-3xl border border-cyan-300/20 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{txt.heroEyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">{txt.heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{txt.heroBody}</p>
          </div>
          <div className="grid min-w-[18rem] gap-2 text-xs sm:grid-cols-2">
            <a href="/" className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center font-semibold text-slate-100">{txt.nav.landing}</a>
            <a href="/login" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-center font-semibold text-emerald-100">{txt.nav.login}</a>
            <a href="/sun" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center font-semibold text-cyan-100">{txt.nav.sun}</a>
            <a href="/me" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center font-semibold text-violet-100">{txt.nav.portal}</a>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { label: txt.kpis.tags, value: summary?.tagCount === undefined ? "--" : String(summary.tagCount), detail: "DemoBodega / supplier" },
            { label: txt.kpis.events, value: String(liveEvents.length), detail: latestEvent ? `${latestEvent.city || "Unknown"} / ${latestEvent.result || "UNKNOWN"}` : txt.kpis.noFeed },
            { label: txt.kpis.portal, value: String(summary?.crm?.leads ?? 0), detail: txt.kpis.leads },
            { label: txt.kpis.route, value: `${routeKm.toLocaleString(locale)} km`, detail: `${LOCATIONS.origin.city} -> ${destination.city}` },
          ].map((kpi) => (
            <div key={kpi.label} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{kpi.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.narrative}</p>
              <h2 className="mt-2 text-2xl font-black text-white">{activeRole.headline}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeRole.focus}</p>
            </div>
            <button suppressHydrationWarning type="button" onClick={() => setRunning((current) => !current)} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100">{running ? txt.controls.cinematicStop : txt.controls.cinematicStart}</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(txt.roles) as Role[]).map((item) => (
              <button suppressHydrationWarning key={item} type="button" onClick={() => setRole(item)} className={`rounded-full border px-3 py-2 text-xs font-bold ${role === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.roles[item].label}</button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {([0, 1, 2, 3] as Beat[]).map((item) => (
              <button suppressHydrationWarning key={item} type="button" onClick={() => setBeat(item)} className={`rounded-2xl border p-3 text-left ${beat === item ? "border-emerald-300/45 bg-emerald-500/10" : "border-white/10 bg-slate-900/60"}`}>
                <p className="text-xs font-black text-white">{txt.beats[item].title}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">{txt.beats[item].body}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.86fr_1.14fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.product}</p>
                  <h3 className="mt-1 text-xl font-black text-white">{activeVertical.product}</h3>
                </div>
                <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-100">{activeVertical.profile}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(txt.verticals) as Vertical[]).map((item) => (
                  <button suppressHydrationWarning key={item} type="button" onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.verticals[item].label}</button>
                ))}
              </div>
              <div className={`demo-lab-product-stage demo-lab-product-stage--${vertical} demo-lab-product-stage--beat-${beat} mt-4`}>
                <div className={`${activeVertical.visual} demo-lab-live-visual ${beat === 3 ? "tampered" : "scanning"}`} />
                <span className="demo-lab-cork" />
                <span className="demo-lab-product-label">nexID secure</span>
                <span className="demo-lab-seal-split" />
                <span className="demo-lab-tap-chip">SUN</span>
                <span className="demo-lab-tap-wave" />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {activeVertical.proof.map((item) => <p key={item} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{item}</p>)}
              </div>
            </div>

            <MobileOutcome txt={txt} beat={beat} vertical={vertical} status={activeBeat.status} product={activeVertical.product} destination={destination} routeKm={routeKm} />
          </div>
        </article>

        <aside className="space-y-5">
          <DemoJourneyMap txt={txt} routeKm={routeKm} status={activeBeat.status} destination={destination} />

          <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.feed}</p>
            <h2 className="mt-2 text-2xl font-black text-white">{activeBeat.event}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>
            <div className="mt-4 grid gap-2">
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("valid")} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-left text-xs font-bold text-emerald-100 disabled:opacity-60">{txt.controls.valid}</button>
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("tamper")} className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-left text-xs font-bold text-amber-100 disabled:opacity-60">{txt.controls.tamper}</button>
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("replay")} className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-left text-xs font-bold text-rose-100 disabled:opacity-60">{txt.controls.replay}</button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">DemoBodega</p>
                <button suppressHydrationWarning type="button" onClick={() => void refreshSummary()} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200">{txt.controls.refresh}</button>
              </div>
              <div className="mt-3 space-y-2">
                {liveEvents.slice(0, 5).length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">{txt.controls.noGeo}</p> : liveEvents.slice(0, 5).map((event) => (
                  <div key={event.id || `${event.created_at}-${event.uidMasked}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                    <p className="font-bold text-white">{event.city || "Unknown"}, {event.country_code || "UNK"} / {event.result || "UNKNOWN"}</p>
                    <p className="mt-1 text-slate-400">{event.product_name || activeVertical.product} / {event.uidMasked || "UID-NA"}</p>
                    <p className="mt-1 text-slate-500">{event.created_at || "sin timestamp"}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </aside>
      </section>

      <section className="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-3 md:p-5">
        <WorldMapRealtime
          title={txt.controls.mapTitle}
          subtitle={`${LOCATIONS.origin.city} -> ${destination.city}. ${txt.controls.distance}: ${routeKm.toLocaleString(locale)} km.`}
          points={mapPoints}
          routes={[{ fromLat: LOCATIONS.origin.lat, fromLng: LOCATIONS.origin.lng, toLat: destination.lat, toLng: destination.lng, tone: activeBeat.mode === "replay" ? "warn" : "info" }]}
          metadataRows={(point) => [{ label: "Google Maps", value: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` }, { label: "Abrir", value: mapsLink(point) }]}
          initialExpanded
        />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-4">
        {txt.controls.configs.map((item) => (
          <article key={item.title} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-2 text-xs leading-6 text-slate-300">{item.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function MobileOutcome({ txt, beat, vertical, status, product, destination, routeKm }: { txt: DemoCopy; beat: Beat; vertical: Vertical; status: string; product: string; destination: DemoLocation; routeKm: number }) {
  const tone = beat === 2 ? "risk" : beat === 3 ? "open" : "ok";
  return (
    <article className={`demo-lab-mobile-card demo-lab-mobile-card--${tone} rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.mobile}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{status}</h3>
          <p className="mt-1 text-sm text-slate-300">{product}</p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">{vertical.toUpperCase()}</span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <InfoCell label={txt.controls.origin} value={LOCATIONS.origin.city} />
        <InfoCell label={txt.controls.currentTap} value={destination.city} />
        <InfoCell label={txt.controls.distance} value={`${routeKm.toLocaleString()} km`} />
      </div>
      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <div className="demo-lab-mobile-progress">
          <span />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <a href={mapsLink(LOCATIONS.origin)} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-3 text-center text-xs font-bold text-cyan-100">{txt.controls.openOrigin}</a>
          <a href={mapsLink(destination)} target="_blank" rel="noreferrer" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-3 text-center text-xs font-bold text-violet-100">{txt.controls.openTap}</a>
          <button suppressHydrationWarning type="button" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{beat === 3 ? txt.controls.tokenize : txt.controls.joinClub}</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label="Passport" value={beat === 3 ? "OPENED" : "VALID"} />
        <InfoCell label="Warranty" value={txt.controls.warranty} />
        <InfoCell label="Marketplace" value={beat === 2 ? "Blocked" : "Ready"} />
      </div>
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function DemoJourneyMap({ txt, routeKm, status, destination }: { txt: DemoCopy; routeKm: number; status: string; destination: DemoLocation }) {
  return (
    <article className="demo-lab-panel demo-lab-journey-card rounded-3xl border border-white/10 bg-slate-950/60 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.mapTitle}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{txt.controls.mapSubtitle}</p>
      <div className="demo-lab-journey-map mt-4">
        <svg viewBox="0 0 760 330" role="img" aria-label={txt.controls.mapTitle}>
          <path className="journey-land journey-land-a" d="M76 126 C130 66 235 76 268 136 C302 196 211 232 130 218 C66 207 35 171 76 126Z" />
          <path className="journey-land journey-land-b" d="M450 74 C557 46 687 96 700 181 C711 253 603 281 510 244 C420 209 365 97 450 74Z" />
          <path className="journey-route-shadow" d="M218 218 C318 99 455 66 584 128" />
          <path className="journey-route" d="M218 218 C318 99 455 66 584 128" />
          <circle className="journey-dot origin" cx="218" cy="218" r="9" />
          <circle className="journey-dot tap" cx="584" cy="128" r="9" />
          <circle className="journey-pulse" cx="584" cy="128" r="16" />
          <circle className="journey-plane" r="6">
            <animateMotion dur="3.8s" repeatCount="indefinite" path="M218 218 C318 99 455 66 584 128" />
          </circle>
        </svg>
        <div className="journey-map-label origin-label">{LOCATIONS.origin.city}</div>
        <div className="journey-map-label tap-label">{destination.city}</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InfoCell label={txt.controls.distance} value={`${routeKm.toLocaleString()} km`} />
        <InfoCell label="Status" value={status} />
        <InfoCell label="Tenant" value={DEMO_TENANT_SLUG} />
      </div>
    </article>
  );
}
