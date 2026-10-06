import { sql } from "./db";
import { ACTIONS_VERSION, CUSTOMER_ACTIONS, record } from "./tenant-loyalty-configuration";
import { getPublishedTriviaForEvent } from "./trivia-service";

export type PublishedCustomerConfiguration = {
  version: typeof ACTIONS_VERSION;
  status: "published" | "unpublished" | "unavailable";
  allowedActions: Array<typeof CUSTOMER_ACTIONS[number]>;
  program: null | { id: string; name: string; pointsName: string; pointsPerValidTap: number | null };
  trivia: null | { id: string; title: string; revision: string; pointsPerCorrect: number; completionBonus: number };
  catalogAvailable: boolean;
  tenantSlug: string | null;
};
export const unavailableCustomerConfiguration = (): PublishedCustomerConfiguration => ({
  version: ACTIONS_VERSION, status: "unavailable", allowedActions: [], program: null, trivia: null, catalogAvailable: false, tenantSlug: null,
});
/** Public capabilities only. Identity comes exclusively from the persisted event. */
const defaults = {query:sql,readTrivia:getPublishedTriviaForEvent};
export async function getPublishedCustomerConfiguration(eventId: string, overrides: Partial<typeof defaults> = {}): Promise<PublishedCustomerConfiguration> {
  const {query,readTrivia} = {...defaults,...overrides};
  if (!/^[1-9]\d{0,15}$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) throw new Error("configuration_event_invalid");
  const events = await query`
    SELECT e.tenant_id, t.slug AS tenant_slug, sp.metadata FROM events e
    JOIN tenants t ON t.id=e.tenant_id LEFT JOIN tenant_sun_profiles sp ON sp.tenant_id=e.tenant_id
    WHERE e.id=${eventId}::bigint LIMIT 2`;
  if (events.length !== 1) throw new Error("configuration_event_not_found_or_ambiguous");
  const event = events[0];
  if (!event?.tenant_id) throw new Error("configuration_event_not_found");
  const [programs, catalog] = await Promise.all([
    query`SELECT *,start_at::text AS configuration_start_at,end_at::text AS configuration_end_at,updated_at::text AS configuration_updated_at FROM loyalty_programs WHERE tenant_id=${event.tenant_id}::uuid
      AND status='active' AND start_at<=now() AND (end_at IS NULL OR end_at>=now()) ORDER BY created_at DESC LIMIT 1`,
    query`SELECT EXISTS(SELECT 1 FROM marketplace_products p JOIN marketplace_brand_profiles b ON b.tenant_id=p.tenant_id
      WHERE p.tenant_id=${event.tenant_id}::uuid AND p.status='active' AND b.status='active' AND b.visible_in_network=true) AS available`.catch(() => [{available:false}]),
  ]);
  const settings = record(record(event.metadata).postTap), p = programs[0], rules = record(p?.rules_json);
  const published = settings.version === ACTIONS_VERSION && settings.status === "published";
  const catalogAvailable = catalog[0]?.available === true;
  const configuredActions = Array.isArray(settings.allowedActions) ? settings.allowedActions : [];
  const allowedActions = published ? CUSTOMER_ACTIONS.filter(a => configuredActions.includes(a) && (a !== "marketplace" || catalogAvailable)) : [];
  const trivia = p ? await readTrivia(eventId, p) : null;
  return { version: ACTIONS_VERSION, status: published ? "published" : "unpublished", allowedActions,
    program: p ? { id: String(p.id), name: String(p.name), pointsName: String(p.points_name), pointsPerValidTap: typeof rules.pointsPerValidTap === "number" && Number.isSafeInteger(rules.pointsPerValidTap) && rules.pointsPerValidTap >= 0 && rules.pointsPerValidTap <= 10_000 ? rules.pointsPerValidTap : null } : null,
    trivia, catalogAvailable, tenantSlug: typeof event.tenant_slug === "string" && /^[a-z0-9][a-z0-9_-]{0,119}$/i.test(event.tenant_slug) ? event.tenant_slug : null };
}
