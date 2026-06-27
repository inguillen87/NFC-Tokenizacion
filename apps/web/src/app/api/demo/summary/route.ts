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
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) {
    return publicProofFallback();
  }

  const events = Array.isArray(data.events) ? data.events.map(safeEvent).filter(Boolean) : [];
  return NextResponse.json({
    ...data,
    events,
    generatedAt: new Date().toISOString(),
  });
}
