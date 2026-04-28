export type NexidEventVerdict =
  | "valid"
  | "invalid"
  | "replay_suspect"
  | "blocked_replay"
  | "revoked"
  | "broken"
  | "tampered"
  | "unknown_batch"
  | "not_registered"
  | "not_active";

export type RiskScoreInput = {
  replayRate: number;
  invalidRate: number;
  tamperRate: number;
  revokedTapRate: number;
  geoAnomalyRate: number;
  deviceAnomalyRate: number;
};

export type RiskScoreBreakdown = RiskScoreInput & {
  rawScore: number;
  score: number;
};

export type NexidTapEvent = {
  id?: string | number | null;
  uidHex?: string | null;
  bid?: string | null;
  tenantSlug?: string | null;
  result?: string | null;
  verdict: NexidEventVerdict;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  city?: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
  createdAt?: string | null;
  isDemo: boolean;
};

const WEIGHTS = {
  replay: 45,
  invalid: 25,
  tamper: 50,
  revoked: 35,
  geo: 20,
  device: 15,
} as const;

export function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mapResultToVerdict(result: string): NexidEventVerdict {
  const normalized = String(result || "").trim().toUpperCase();
  if (normalized === "VALID" || normalized === "TAP_VALID") return "valid";
  if (normalized === "REPLAY_SUSPECT" || normalized === "DUPLICATE") return "replay_suspect";
  if (normalized === "BLOCKED_REPLAY") return "blocked_replay";
  if (normalized === "REVOKED") return "revoked";
  if (normalized === "BROKEN") return "broken";
  if (normalized === "TAMPER" || normalized === "TAMPERED") return "tampered";
  if (normalized === "UNKNOWN_BATCH") return "unknown_batch";
  if (normalized === "NOT_REGISTERED") return "not_registered";
  if (normalized === "NOT_ACTIVE") return "not_active";
  return "invalid";
}

function verdictToRiskLevel(verdict: NexidEventVerdict): NexidTapEvent["riskLevel"] {
  if (verdict === "valid") return "none";
  if (verdict === "replay_suspect" || verdict === "blocked_replay" || verdict === "tampered") return "high";
  if (verdict === "revoked" || verdict === "broken") return "critical";
  if (verdict === "invalid" || verdict === "unknown_batch" || verdict === "not_registered" || verdict === "not_active") return "medium";
  return "low";
}

export function computeRiskScore(input: RiskScoreInput): RiskScoreBreakdown {
  const rawScore =
    input.replayRate * WEIGHTS.replay +
    input.invalidRate * WEIGHTS.invalid +
    input.tamperRate * WEIGHTS.tamper +
    input.revokedTapRate * WEIGHTS.revoked +
    input.geoAnomalyRate * WEIGHTS.geo +
    input.deviceAnomalyRate * WEIGHTS.device;
  return { ...input, rawScore, score: clamp(rawScore) };
}

export function normalizeEvent(row: Record<string, unknown>): NexidTapEvent {
  const verdict = (typeof row.verdict === "string" && row.verdict
    ? String(row.verdict).toLowerCase()
    : mapResultToVerdict(String(row.result || ""))) as NexidEventVerdict;
  const source = String(row.source || "");
  return {
    id: (row.id as string | number | null | undefined) ?? null,
    uidHex: String(row.uid_hex || row.uidHex || "") || null,
    bid: String(row.bid || "") || null,
    tenantSlug: String(row.tenant_slug || row.tenantSlug || "") || null,
    result: String(row.result || "") || null,
    verdict,
    riskLevel: verdictToRiskLevel(verdict),
    city: String(row.city || row.geo_city || "") || null,
    countryCode: String(row.country_code || row.geo_country || "") || null,
    lat: typeof row.lat === "number" ? row.lat : typeof row.geo_lat === "number" ? (row.geo_lat as number) : null,
    lng: typeof row.lng === "number" ? row.lng : typeof row.geo_lng === "number" ? (row.geo_lng as number) : null,
    source: source || null,
    createdAt: String(row.created_at || row.createdAt || "") || null,
    isDemo: source === "demo" || source === "demo_simulation",
  };
}

export function aggregateTenantMetrics(input: {
  events?: Array<Record<string, unknown>>;
  counts?: Partial<Record<"scans" | "valid" | "invalid" | "duplicates" | "tamper" | "revoked", number>>;
  geoAnomalyRate?: number;
  deviceAnomalyRate?: number;
}) {
  const events = Array.isArray(input.events) ? input.events.map(normalizeEvent) : [];
  const scans = input.counts?.scans ?? events.length;
  const valid = input.counts?.valid ?? events.filter((event) => event.verdict === "valid").length;
  const duplicates = input.counts?.duplicates ?? events.filter((event) => event.verdict === "replay_suspect" || event.verdict === "blocked_replay").length;
  const tamper = input.counts?.tamper ?? events.filter((event) => event.verdict === "tampered").length;
  const revoked = input.counts?.revoked ?? events.filter((event) => event.verdict === "revoked").length;
  const invalid = input.counts?.invalid ?? Math.max(scans - valid, 0);
  const safeScans = Math.max(0, Number(scans || 0));

  const breakdown = computeRiskScore({
    replayRate: safeScans ? duplicates / safeScans : 0,
    invalidRate: safeScans ? invalid / safeScans : 0,
    tamperRate: safeScans ? tamper / safeScans : 0,
    revokedTapRate: safeScans ? revoked / safeScans : 0,
    geoAnomalyRate: Number(input.geoAnomalyRate || 0),
    deviceAnomalyRate: Number(input.deviceAnomalyRate || 0),
  });

  return {
    scans: safeScans,
    valid: Number(valid || 0),
    invalid: Number(invalid || 0),
    duplicates: Number(duplicates || 0),
    tamper: Number(tamper || 0),
    revoked: Number(revoked || 0),
    validRate: safeScans ? Number((((valid || 0) / safeScans) * 100).toFixed(1)) : 0,
    invalidRate: safeScans ? Number((((invalid || 0) / safeScans) * 100).toFixed(1)) : 0,
    riskScore: Number(breakdown.score.toFixed(1)),
    riskBreakdown: breakdown,
    demoEvents: events.filter((event) => event.isDemo).length,
    productionEvents: events.filter((event) => !event.isDemo).length,
  };
}
