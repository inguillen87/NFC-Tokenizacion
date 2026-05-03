import { sql } from "./db";

const UID_HEX_RE = /^[0-9A-F]{8,20}$/;

function clean(value: unknown) {
  return String(value || "").trim();
}

export function eventShareUid(eventId: string | number) {
  return `EVENT-${String(eventId).trim()}`;
}

export async function resolvePublicCtaTarget(input: {
  bid?: unknown;
  uid?: unknown;
  uid_hex?: unknown;
  event_id?: unknown;
  eventId?: unknown;
}) {
  const bid = clean(input.bid);
  const uid = clean(input.uid || input.uid_hex).toUpperCase();
  const eventId = clean(input.event_id || input.eventId);

  if (bid && UID_HEX_RE.test(uid)) {
    return {
      ok: true as const,
      bid,
      uid,
      eventId: eventId || null,
      shareUid: uid,
      source: "uid" as const,
    };
  }

  const numericEventId = Number(eventId);
  if (!bid || !Number.isFinite(numericEventId) || numericEventId <= 0) {
    return { ok: false as const, reason: "bid and uid or event_id required" };
  }

  const rows = await sql/*sql*/`
    SELECT e.id, e.uid_hex, b.bid
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    WHERE e.id = ${numericEventId}
      AND b.bid = ${bid}
    LIMIT 1
  `;
  const row = rows[0] as { id?: number; uid_hex?: string | null; bid?: string | null } | undefined;
  const resolvedUid = String(row?.uid_hex || "").trim().toUpperCase();
  if (!row || !UID_HEX_RE.test(resolvedUid)) {
    return { ok: false as const, reason: "event not found for bid" };
  }

  return {
    ok: true as const,
    bid,
    uid: resolvedUid,
    eventId: String(row.id || numericEventId),
    shareUid: eventShareUid(row.id || numericEventId),
    source: "event" as const,
  };
}
