import { sql, type SqlExecutor } from "./db";
import { editorialContentDigest, parseEditorialDocument, type EditorialDocument } from "./passport-editorial-policy";

export const CURRENT_EDITORIAL_PROTOCOL = "nexid.current-editorial.v1" as const;
type EditorialState = "published" | "unpublished" | "legacy" | "withdrawn" | "invalid" | "unavailable";
type EditorialBase = { protocol: typeof CURRENT_EDITORIAL_PROTOCOL; source: "passport_studio"; observedAt: string | null };
export type CurrentPassportEditorial = EditorialBase & (
  { state: "published"; version: number; publishedAt: string; contentDigest: string; document: EditorialDocument }
  | { state: Exclude<EditorialState, "published"> }
);
const PUBLISHED_BATCH_STATES = new Set(["active", "active_in_market", "production_registered"]);
const WITHHELD_BATCH_STATES = new Set(["draft", "revoked", "deprecating", "archived"]);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function timestamp(value: unknown): string | null {
  if (!(value instanceof Date) && (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))) return null;
  const date = new Date(value as string | Date);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function empty(state: Exclude<EditorialState, "published">, observedAt: string | null = null): CurrentPassportEditorial {
  return { protocol: CURRENT_EDITORIAL_PROTOCOL, source: "passport_studio", state, observedAt };
}

/** Only the published public document leaves this reader. Missing data never
 * falls back to a draft, a different batch, or the historical SUN contract. */
export function projectCurrentPassportEditorial(raw: unknown): CurrentPassportEditorial {
  const row = record(raw), observedAt = timestamp(row.observed_at);
  if (!row.event_id) return empty("unavailable", observedAt);
  if (!observedAt || typeof row.tenant_id !== "string" || !UUID.test(row.tenant_id)
    || typeof row.batch_id !== "string" || !UUID.test(row.batch_id) || row.scope_valid !== true) return empty("invalid", observedAt);
  const status = row.batch_status;
  if (typeof status !== "string" || (!PUBLISHED_BATCH_STATES.has(status) && !WITHHELD_BATCH_STATES.has(status))) return empty("invalid", observedAt);
  // This concerns batch availability, not a recall or an editorial withdrawal.
  if (WITHHELD_BATCH_STATES.has(status)) return empty("withdrawn", observedAt);
  if (row.editorial_managed === false && row.head_present === false && row.publication_count === 0) return empty("legacy", observedAt);
  if (row.editorial_managed !== true || row.head_present !== true || row.head_scope_valid !== true) return empty("invalid", observedAt);
  const published = record(row.published);
  const version = row.published_version;
  if (!Number.isSafeInteger(version) || (version as number) < 0 || published.version !== version
    || !Number.isSafeInteger(row.publication_count) || row.publication_count !== row.distinct_revisions) return empty("invalid", observedAt);
  // Studio enrollment stores a version-zero baseline; it is not a publication.
  if (version === 0 && row.publication_count === 0) return empty("unpublished", observedAt);
  if ((version as number) < 1 || row.publication_count !== version || row.valid_revisions !== true
    || row.live_projection_matches !== true || typeof published.contentDigest !== "string" || !HASH.test(published.contentDigest)) return empty("invalid", observedAt);
  const history = record(row.latest_publication), publishedAt = timestamp(history.created_at);
  if (!publishedAt || publishedAt > observedAt || !Number.isSafeInteger(history.revision) || (history.revision as number) < 1
    || history.content_digest !== published.contentDigest) return empty("invalid", observedAt);
  try {
    const document = parseEditorialDocument(published.document);
    if (editorialContentDigest(document) !== published.contentDigest
      || editorialContentDigest(history.document) !== published.contentDigest) return empty("invalid", observedAt);
    return { protocol: CURRENT_EDITORIAL_PROTOCOL, source: "passport_studio", state: "published", observedAt,
      version: version as number, publishedAt, contentDigest: published.contentDigest, document };
  } catch { return empty("invalid", observedAt); }
}

/** One read snapshot, keyed by persisted event scope. No schema installation or
 * secret/configuration projection. The caller must authorize access to the event. */
export async function readCurrentPassportEditorial(eventId: unknown, execute: SqlExecutor = sql): Promise<CurrentPassportEditorial> {
  if (typeof eventId !== "string" || !/^[1-9]\d{0,18}$/.test(eventId) || BigInt(eventId) > 9_223_372_036_854_775_807n) return empty("unavailable");
  try {
    const rows = await execute`
      SELECT event.id::text AS event_id, event.tenant_id::text AS tenant_id, event.batch_id::text AS batch_id,
        (batch.id IS NOT NULL AND tenant.id IS NOT NULL) AS scope_valid,
        batch.status::text AS batch_status, batch.editorial_managed,
        (head.batch_id IS NOT NULL) AS head_present,
        (head.batch_id = event.batch_id AND head.tenant_id = event.tenant_id) AS head_scope_valid,
        head.published, head.published_version,
        publications.publication_count, publications.distinct_revisions, publications.valid_revisions,
        latest.latest_publication,
        (
          jsonb_build_object(
            'product_name', batch.sdm_config->'product_name', 'public_lot_label', batch.sdm_config->'public_lot_label',
            'sku', batch.sdm_config->'sku', 'winery', batch.sdm_config->'winery',
            'region', batch.sdm_config->'region', 'image_url', batch.sdm_config->'image_url'
          ) IS NOT DISTINCT FROM head.published#>'{document,identity}'
          AND batch.sdm_config->'lot' IS NOT DISTINCT FROM head.published#>'{document,identity,public_lot_label}'
          AND batch.sdm_config->'batch_lot' IS NOT DISTINCT FROM head.published#>'{document,identity,public_lot_label}'
          AND batch.sdm_config->'lot_number' IS NOT DISTINCT FROM head.published#>'{document,identity,public_lot_label}'
          AND batch.sdm_config#>'{sun,product,name}' IS NOT DISTINCT FROM head.published#>'{document,identity,product_name}'
          AND batch.sdm_config#>'{sun,product,producer}' IS NOT DISTINCT FROM head.published#>'{document,identity,winery}'
          AND batch.sdm_config#>'{sun,product,sku}' IS NOT DISTINCT FROM head.published#>'{document,identity,sku}'
          AND batch.sdm_config#>'{sun,product,imageUrl}' IS NOT DISTINCT FROM head.published#>'{document,identity,image_url}'
          AND batch.sdm_config#>'{sun,origin,region}' IS NOT DISTINCT FROM head.published#>'{document,identity,region}'
          AND (head.published#>>'{document,template}' <> 'agro'
            OR batch.sdm_config->'agro_product_profile' IS NOT DISTINCT FROM head.published#>'{document,agro_product_profile}')
        ) AS live_projection_matches,
        statement_timestamp() AS observed_at
      FROM events event
      LEFT JOIN tenants tenant ON tenant.id = event.tenant_id
      LEFT JOIN batches batch ON batch.id = event.batch_id AND batch.tenant_id = event.tenant_id
      LEFT JOIN passport_editorial_heads head ON head.batch_id = batch.id AND head.tenant_id = event.tenant_id
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS publication_count, count(DISTINCT history.revision)::integer AS distinct_revisions,
          coalesce(bool_and(history.revision > 0), true) AS valid_revisions
        FROM passport_editorial_history history
        WHERE history.batch_id = batch.id AND history.tenant_id = event.tenant_id AND history.action = 'publish'
      ) publications ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_build_object('revision', history.revision, 'content_digest', history.content_digest,
          'document', history.document, 'created_at', history.created_at) AS latest_publication
        FROM passport_editorial_history history
        WHERE history.batch_id = batch.id AND history.tenant_id = event.tenant_id AND history.action = 'publish'
        ORDER BY history.revision DESC LIMIT 1
      ) latest ON true
      WHERE event.id = ${eventId}::bigint
      LIMIT 2
    `;
    if (rows.length !== 1) return empty(rows.length ? "invalid" : "unavailable");
    return projectCurrentPassportEditorial(rows[0]);
  } catch { return empty("unavailable"); }
}
