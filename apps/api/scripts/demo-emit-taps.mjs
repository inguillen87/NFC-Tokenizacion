import { neon } from "@neondatabase/serverless";

function assertDemoWriteAllowed(scriptName) {
  const demoMode = String(process.env.DEMO_MODE || "").toLowerCase() === "true";
  if (!demoMode) {
    console.error(`${scriptName} blocked: set DEMO_MODE=true to run demo corpus writers.`);
    process.exit(1);
  }
  const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const explicitProdAllow = String(process.env.DEMO_ALLOW_PROD_DATA_WRITE || "").toLowerCase() === "true";
  if (isProduction && !explicitProdAllow) {
    console.error(`${scriptName} blocked in production. Set DEMO_ALLOW_PROD_DATA_WRITE=true only for explicit demo environments.`);
    process.exit(1);
  }
}

assertDemoWriteAllowed("demo:emit-taps");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const countArg = Number(process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] || 10);
const count = Number.isFinite(countArg) ? Math.max(1, Math.min(200, countArg)) : 10;
const bid = process.argv.find((a) => a.startsWith("--bid="))?.split("=")[1] || "DEMO-2026-02";
const tenantSlug = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1] || "demobodega";

const sql = neon(url);

const rows = await sql`
  SELECT t.id AS tenant_id, t.slug AS tenant_slug, b.id AS batch_id, b.bid
  FROM tenants t
  JOIN batches b ON b.tenant_id = t.id
  WHERE t.slug = ${tenantSlug} AND b.bid = ${bid}
  LIMIT 1
`;
const scope = rows[0];
if (!scope) {
  console.error(`Missing tenant/batch for tenant=${tenantSlug} bid=${bid}. Run demo:seed first.`);
  process.exit(1);
}

const tags = await sql`
  SELECT id, uid_hex
  FROM tags
  WHERE batch_id = ${scope.batch_id}
  ORDER BY created_at ASC
  LIMIT ${count}
`;
if (!tags.length) {
  console.error(`No tags found for batch ${bid}. Run demo:seed first.`);
  process.exit(1);
}

const cities = [
  { city: "Mendoza", country: "AR", lat: -32.8895, lng: -68.8458 },
  { city: "Buenos Aires", country: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "São Paulo", country: "BR", lat: -23.5505, lng: -46.6333 },
  { city: "New York", country: "US", lat: 40.7128, lng: -74.006 },
  { city: "Madrid", country: "ES", lat: 40.4168, lng: -3.7038 },
];

const verdictCycle = [
  { result: "VALID", event_type: "TAP_VALID", verdict: "valid", risk_level: "none" },
  { result: "REPLAY_SUSPECT", event_type: "REPLAY_SUSPECT", verdict: "replay_suspect", risk_level: "high" },
  { result: "TAMPERED", event_type: "TAMPERED", verdict: "tampered", risk_level: "critical" },
  { result: "REVOKED", event_type: "REVOKED", verdict: "revoked", risk_level: "high" },
  { result: "INVALID", event_type: "TAP_INVALID", verdict: "invalid", risk_level: "medium" },
];

let inserted = 0;
for (let i = 0; i < count; i += 1) {
  const tag = tags[i % tags.length];
  const geo = cities[i % cities.length];
  const verdict = verdictCycle[i % verdictCycle.length];
  await sql`
    INSERT INTO events (
      tenant_id, batch_id, uid_hex, tag_id, bid, result, reason,
      event_type, verdict, risk_level,
      city, country_code, lat, lng,
      source, device_label, meta
    ) VALUES (
      ${scope.tenant_id}, ${scope.batch_id}, ${tag.uid_hex}, ${tag.id}, ${scope.bid},
      ${verdict.result}, ${verdict.result === "VALID" ? "sun_ok" : "demo_simulation"},
      ${verdict.event_type}::event_type, ${verdict.verdict}, ${verdict.risk_level}::risk_level,
      ${geo.city}, ${geo.country}, ${geo.lat}, ${geo.lng},
      'demo'::text, 'Demo Emitter', ${JSON.stringify({ demoEmitter: true, corpus: "demobodega-flagship" })}::jsonb
    )
  `;
  inserted += 1;
}

console.log(`Inserted ${inserted} demo events for tenant=${tenantSlug} bid=${bid}`);
