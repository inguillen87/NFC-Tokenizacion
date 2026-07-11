export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { productUrls } from "@product/config";

function clean(value: unknown) {
  return String(value || "").trim();
}

function maskUid(uidHex: unknown) {
  const value = clean(uidHex).toUpperCase().replace(/[^A-F0-9]/g, "");
  if (!value) return "UID-NA";
  if (value.length <= 8) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

function safeEvent(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const event = row as Record<string, unknown>;
  const lat = typeof event.lat === "number" ? event.lat : Number(event.lat);
  const lng = typeof event.lng === "number" ? event.lng : Number(event.lng);
  return {
    id: clean(event.id) || `${clean(event.created_at)}-${maskUid(event.uid_hex)}`,
    result: clean(event.result) || "UNKNOWN",
    uidMasked: maskUid(event.uid_hex),
    created_at: clean(event.created_at),
    city: clean(event.city) || "Unknown",
    country_code: clean(event.country_code) || "UNK",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    product_name: clean(event.product_name),
    sku: clean(event.sku),
    vertical: clean(event.vertical) || "wine",
  };
}

const KNOWN_COORDS = [
  { match: /(demo bodega|bodega demo)/i, lat: -33.2095, lng: -69.1211 },
  { match: /(mendoza|valle de uco|finca altamira)/i, lat: -33.2095, lng: -69.1211 },
  { match: /(san rafael)/i, lat: -34.6177, lng: -68.3301 },
  { match: /(cafayate|salta)/i, lat: -26.0729, lng: -65.9761 },
  { match: /(patagonia|rio negro)/i, lat: -39.033, lng: -67.583 },
  { match: /(san martin|san martín).*?(ar|argentina|buenos aires)|^(san martin|san martín)$/i, lat: -34.5744, lng: -58.5358 },
  { match: /(buenos aires|caba|palermo|recoleta|puerto madero)/i, lat: -34.6037, lng: -58.3816 },
  { match: /(sao paulo|são paulo|brasil|brazil)/i, lat: -23.5558, lng: -46.6396 },
  { match: /(santiago|chile)/i, lat: -33.4489, lng: -70.6693 },
  { match: /(miami|florida|estados unidos|united states|usa)/i, lat: 25.7617, lng: -80.1918 },
  { match: /(zurich|zürich|suiza|switzerland)/i, lat: 47.3769, lng: 8.5417 },
  { match: /(new york|nyc|manhattan)/i, lat: 40.7128, lng: -74.006 },
  { match: /(london|londres|uk|united kingdom|inglaterra)/i, lat: 51.5074, lng: -0.1278 },
  { match: /(paris|parís|france|francia)/i, lat: 48.8566, lng: 2.3522 },
  { match: /(madrid|spain|españa)/i, lat: 40.4168, lng: -3.7038 },
  { match: /(shanghai|shanghái|china)/i, lat: 31.2304, lng: 121.4737 },
  { match: /(rosario)/i, lat: -32.9442, lng: -60.6505 },
  { match: /(cordoba|córdoba)/i, lat: -31.4201, lng: -64.1888 },
  { match: /(neuquen|neuquén)/i, lat: -38.9516, lng: -68.0591 },
  { match: /(mar del plata)/i, lat: -38.0055, lng: -57.5426 },
];

function resolveCoordinates(city: string, country: string) {
  const blob = `${city} - ${country}`;
  const match = KNOWN_COORDS.find((item) => item.match.test(blob) || item.match.test(city));
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function safePublicEvent(row: unknown) {
  if (!row || typeof row !== "object") return null;
  const event = row as Record<string, unknown>;
  const city = clean(event.city) || "Unknown";
  const country = clean(event.country) || "UNK";
  const coords = resolveCoordinates(city, country);
  return {
    id: `${clean(event.occurredAt)}-${clean(event.uidMasked)}`,
    result: clean(event.verdict) || "UNKNOWN",
    uidMasked: clean(event.uidMasked) || "UID-NA",
    created_at: clean(event.occurredAt),
    city,
    country_code: country,
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
    product_name: "",
    sku: "",
    vertical: "wine",
  };
}

function safeCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function demoRecordCount(value: unknown) {
  return Array.isArray(value) ? Math.min(value.length, 20) : 0;
}

function demoOrdinal(index: number) {
  return String(index + 1).padStart(2, "0");
}

function demoTimestamp(generatedAt: string, minutesAgo: number) {
  return new Date(Date.parse(generatedAt) - minutesAgo * 60_000).toISOString();
}

const DEMO_LEAD_TEMPLATES = [
  {
    name: "Equipo de compras demo",
    company: "Bodega Demo Andina",
    country: "Argentina",
    vertical: "wine",
    role_interest: "buyer",
    estimated_volume: "1,000-5,000",
    tag_type: "NTAG 424 DNA",
    volume: 2500,
    status: "new",
  },
  {
    name: "Equipo de marca demo",
    company: "Cosmetica Demo Sur",
    country: "Chile",
    vertical: "cosmetics",
    role_interest: "brand",
    estimated_volume: "5,000-10,000",
    tag_type: "NTAG 424 DNA TT",
    volume: 6000,
    status: "contacted",
  },
  {
    name: "Equipo de operaciones demo",
    company: "Agro Demo Regional",
    country: "Uruguay",
    vertical: "agro",
    role_interest: "operations",
    estimated_volume: "10,000+",
    tag_type: "QR + NFC UID",
    volume: 12000,
    status: "qualified",
  },
] as const;

const DEMO_TICKET_TEMPLATES = [
  {
    title: "Alerta demo de lectura duplicada",
    detail: "Incidente simulado para mostrar el flujo de revision antifraude.",
    status: "open",
  },
  {
    title: "Alerta demo de sello abierto",
    detail: "Evento simulado de tamper pendiente de validacion operativa.",
    status: "pending",
  },
  {
    title: "Alerta demo resuelta",
    detail: "Caso simulado cerrado con evidencia de trazabilidad.",
    status: "resolved",
  },
] as const;

const DEMO_ORDER_TEMPLATES = [
  { company: "Distribuidor Demo Andino", tag_type: "NTAG 424 DNA", volume: 2500, status: "pending" },
  { company: "Integrador Demo Regional", tag_type: "NTAG 424 DNA TT", volume: 5000, status: "approved" },
  { company: "Imprenta Demo Asociada", tag_type: "QR + NFC UID", volume: 10000, status: "new" },
] as const;

function demoLeads(count: number, generatedAt: string) {
  return Array.from({ length: count }, (_, index) => {
    const template = DEMO_LEAD_TEMPLATES[index % DEMO_LEAD_TEMPLATES.length];
    return {
      id: `demo-lead-${index + 1}`,
      locale: "es-AR",
      contact: `Contacto demo ${demoOrdinal(index)}`,
      name: template.name,
      email: null,
      phone: null,
      company: template.company,
      country: template.country,
      vertical: template.vertical,
      role_interest: template.role_interest,
      estimated_volume: template.estimated_volume,
      tag_type: template.tag_type,
      volume: template.volume,
      source: "demo-lab",
      status: template.status,
      message: "Consulta simulada para la demostracion comercial.",
      notes: null,
      assigned_to: null,
      created_at: demoTimestamp(generatedAt, 8 + index * 7),
    };
  });
}

function demoTickets(count: number, generatedAt: string) {
  return Array.from({ length: count }, (_, index) => {
    const template = DEMO_TICKET_TEMPLATES[index % DEMO_TICKET_TEMPLATES.length];
    return {
      id: `demo-ticket-${index + 1}`,
      locale: "es-AR",
      contact: `Cuenta demo ${demoOrdinal(index)}`,
      title: template.title,
      detail: template.detail,
      status: template.status,
      source: "demo-lab",
      assigned_to: null,
      created_at: demoTimestamp(generatedAt, 12 + index * 9),
      updated_at: demoTimestamp(generatedAt, 6 + index * 9),
    };
  });
}

function demoOrders(count: number, generatedAt: string) {
  return Array.from({ length: count }, (_, index) => {
    const template = DEMO_ORDER_TEMPLATES[index % DEMO_ORDER_TEMPLATES.length];
    return {
      id: `demo-order-${index + 1}`,
      locale: "es-AR",
      contact: `Canal demo ${demoOrdinal(index)}`,
      company: template.company,
      tag_type: template.tag_type,
      volume: template.volume,
      notes: "Solicitud simulada para la demostracion operativa.",
      status: template.status,
      source: "demo-lab",
      assigned_to: null,
      created_at: demoTimestamp(generatedAt, 18 + index * 11),
      updated_at: demoTimestamp(generatedAt, 10 + index * 11),
    };
  });
}

function emptyDemoSummary(reason: string) {
  return NextResponse.json({
    ok: true,
    degraded: true,
    exists: false,
    source: "visual-demo",
    tagCount: undefined,
    crm: { leads: 0, tickets: 0, orders: 0 },
    recentLeads: [],
    recentTickets: [],
    recentOrders: [],
    events: [],
    reason,
    generatedAt: new Date().toISOString(),
  });
}

async function publicProofFallback() {
  let response: Response;
  try {
    response = await fetch(`${productUrls.api}/public/proof/summary`, { cache: "no-store" });
  } catch {
    return emptyDemoSummary("Modo demo visual: feed publico no disponible en este runtime.");
  }
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid public proof json" }));
  if (!response.ok || data?.ok === false) {
    return emptyDemoSummary("Modo demo visual: feed publico no disponible en este runtime.");
  }
  const events = Array.isArray(data.latestPublicEvents) ? data.latestPublicEvents.map(safePublicEvent).filter(Boolean) : [];
  return NextResponse.json({
    ok: true,
    exists: true,
    source: "public-proof",
    tagCount: undefined,
    crm: { leads: 0, tickets: 0, orders: 0 },
    recentLeads: [],
    recentTickets: [],
    recentOrders: [],
    events,
    generatedAt: new Date().toISOString(),
  });
}

export async function GET() {
  const adminKey = clean(process.env.ADMIN_API_KEY);
  if (!adminKey) {
    return publicProofFallback();
  }

  let response: Response;
  try {
    response = await fetch(`${productUrls.api}/internal/demo/summary`, {
      headers: { Authorization: `Bearer ${adminKey}` },
      cache: "no-store",
    });
  } catch {
    return publicProofFallback();
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || (payload as Record<string, unknown>).ok === false) {
    return publicProofFallback();
  }

  const data = payload as Record<string, unknown>;
  const crm = data.crm && typeof data.crm === "object" ? data.crm as Record<string, unknown> : {};
  const generatedAt = new Date().toISOString();
  const events = Array.isArray(data.events) ? data.events.map(safeEvent).filter(Boolean) : [];
  return NextResponse.json({
    ok: true,
    exists: data.exists !== false,
    source: "internal-demo-sanitized",
    tagCount: safeCount(data.tagCount),
    crm: {
      leads: safeCount(crm.leads),
      tickets: safeCount(crm.tickets),
      orders: safeCount(crm.orders),
    },
    recentLeads: demoLeads(demoRecordCount(data.recentLeads), generatedAt),
    recentTickets: demoTickets(demoRecordCount(data.recentTickets), generatedAt),
    recentOrders: demoOrders(demoRecordCount(data.recentOrders), generatedAt),
    events,
    generatedAt,
  });
}
