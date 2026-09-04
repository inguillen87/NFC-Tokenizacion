export const PUBLIC_CLIENT_EXPERIENCE_EVENT_TYPES = [
  "PRODUCT_VIEWED",
  "TECHNICAL_SHEET_VIEWED",
  "SAFETY_SHEET_VIEWED",
  "PPE_CONTENT_VIEWED",
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
  "TRAINING_STARTED",
  "PROBLEM_REPORTED",
] as const;

export type PublicClientExperienceEventType = (typeof PUBLIC_CLIENT_EXPERIENCE_EVENT_TYPES)[number];

export type PublicExperienceEventData = Partial<Record<
  | "surface"
  | "placement"
  | "ctaLabel"
  | "destinationHost"
  | "trainingStep"
  | "locale"
  | "sourceCarrier"
  | "profileVersion",
  string | number | boolean
>>;

type PublicExperienceEventInput = {
  bid: string;
  eventId: string;
  freshToken?: string;
  eventType: PublicClientExperienceEventType;
  placement: string;
  interactionId: string;
  data?: PublicExperienceEventData;
  keepalive?: boolean;
  sensitiveActionAllowed?: boolean;
};

const EVENT_TYPES = new Set<string>(PUBLIC_CLIENT_EXPERIENCE_EVENT_TYPES);
const SENSITIVE_EVENT_TYPES = new Set<PublicClientExperienceEventType>([
  "STEWARDSHIP_CONFIRMED",
  "CROPWISE_CTA_CLICKED",
  "ADVISOR_CONTACT_REQUESTED",
  "LOYALTY_OFFER_VIEWED",
]);

function normalizedPart(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stableData(value: PublicExperienceEventData) {
  return Object.entries(value)
    .filter(([, item]) => typeof item === "boolean" || typeof item === "number" || String(item ?? "").trim().length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}=${String(item)}`)
    .join("&");
}

function fnv1a64(value: string) {
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function normalizePublicClientExperienceEventType(value: unknown): PublicClientExperienceEventType | null {
  const normalized = normalizedPart(value, 80).toUpperCase();
  return EVENT_TYPES.has(normalized) ? normalized as PublicClientExperienceEventType : null;
}

export function isSensitivePublicClientExperienceEvent(eventType: PublicClientExperienceEventType) {
  return SENSITIVE_EVENT_TYPES.has(eventType);
}

export function hasPublicExperienceEventScope(input: { bid?: string | null; eventId?: string | null }) {
  return Boolean(normalizedPart(input.bid, 240) && /^\d+$/.test(normalizedPart(input.eventId, 40)));
}

export function buildPublicExperienceIdempotencyKey(input: {
  eventId: string;
  eventType: PublicClientExperienceEventType;
  placement: string;
  interactionId: string;
  data?: PublicExperienceEventData;
}) {
  const eventId = normalizedPart(input.eventId, 40);
  const placement = normalizedPart(input.placement, 80).toLowerCase();
  const interactionId = normalizedPart(input.interactionId, 120).toLowerCase();
  const data = input.data || {};
  const fingerprint = fnv1a64([
    eventId,
    input.eventType,
    placement,
    interactionId,
    stableData(data),
  ].join("|"));
  const readablePlacement = placement.replace(/[^a-z0-9._-]/g, "_").slice(0, 16) || "surface";
  return `nexid:experience:v1:${eventId}:${input.eventType.toLowerCase()}:${readablePlacement}:${fingerprint}`;
}

export async function recordPublicExperienceEvent(input: PublicExperienceEventInput) {
  if (!hasPublicExperienceEventScope(input)) return { ok: false as const, reason: "event_scope_unavailable" };
  // A share token only identifies the public event scope. Every semantic write
  // also needs the short-lived capability issued by the physical SUN handoff.
  const freshToken = normalizedPart(input.freshToken, 4096);
  if (!freshToken) return { ok: false as const, reason: "fresh_tap_capability_unavailable" };
  const eventType = normalizePublicClientExperienceEventType(input.eventType);
  if (!eventType) return { ok: false as const, reason: "experience_event_type_invalid" };
  if (isSensitivePublicClientExperienceEvent(eventType) && input.sensitiveActionAllowed !== true) {
    return { ok: false as const, reason: "sensitive_action_blocked_by_trust_state" };
  }

  const data: PublicExperienceEventData = {
    ...input.data,
    placement: normalizedPart(input.placement, 120),
  };
  const idempotencyKey = buildPublicExperienceIdempotencyKey({
    eventId: input.eventId,
    eventType,
    placement: input.placement,
    interactionId: input.interactionId,
    data,
  });

  try {
    const response = await fetch("/api/public-cta/experience-event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify({
        bid: input.bid,
        event_id: input.eventId,
        event_type: eventType,
        idempotency_key: idempotencyKey,
        fresh_token: freshToken,
        data,
      }),
      cache: "no-store",
      credentials: "same-origin",
      keepalive: input.keepalive === true,
    });
    const payload = await response.json().catch(() => null) as { ok?: unknown; reason?: unknown; replayed?: unknown } | null;
    return response.ok && payload?.ok === true
      ? { ok: true as const, replayed: payload.replayed === true }
      : { ok: false as const, reason: String(payload?.reason || "event_record_failed") };
  } catch {
    return { ok: false as const, reason: "network_unavailable" };
  }
}
