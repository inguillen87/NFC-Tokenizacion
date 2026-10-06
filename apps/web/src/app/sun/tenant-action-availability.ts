export const TENANT_ACTIONS_VERSION = "nexid.tenant-actions.v1";
export type TenantPublicAction = "lead" | "feedback" | "sommelier" | "marketplace";
export type PublishedTrivia = { id: string; title: string; revision: string; pointsPerCorrect: number; completionBonus: number };
export type TenantActionConfiguration = {
  version: typeof TENANT_ACTIONS_VERSION;
  status: "published" | "unpublished" | "unavailable";
  allowedActions: TenantPublicAction[];
  program: null | { id: string; name: string; pointsName: string; pointsPerValidTap: number | null };
  trivia: PublishedTrivia | null;
  catalogAvailable: boolean;
  tenantSlug?: string | null;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}
export function publishedQuizIdentity(id: unknown, revision: unknown): id is string {
  return typeof id === "string" && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)
    && typeof revision === "string" && /^[a-f\d]{64}$/.test(revision);
}
function amount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
}
export function parseTenantActionConfiguration(value: unknown): TenantActionConfiguration | null {
  const raw = record(value);
  if (!raw || raw.version !== TENANT_ACTIONS_VERSION || !["published", "unpublished", "unavailable"].includes(String(raw.status))
    || !Array.isArray(raw.allowedActions) || raw.allowedActions.some(action => !["lead", "feedback", "sommelier", "marketplace"].includes(action))
    || typeof raw.catalogAvailable !== "boolean") return null;
  if (raw.tenantSlug !== undefined && raw.tenantSlug !== null && (!text(raw.tenantSlug, 120) || !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(raw.tenantSlug))) return null;
  let program: TenantActionConfiguration["program"] = null;
  if (raw.program !== null) {
    const p = record(raw.program);
    if (!p || !text(p.id, 100) || !text(p.name, 160) || !text(p.pointsName, 100)
      || p.pointsPerValidTap !== null && !amount(p.pointsPerValidTap)) return null;
    program = { id: p.id, name: p.name, pointsName: p.pointsName, pointsPerValidTap: p.pointsPerValidTap as number | null };
  }
  let trivia: PublishedTrivia | null = null;
  if (raw.trivia !== null) {
    const q = record(raw.trivia);
    if (!q || !program || !publishedQuizIdentity(q.id, q.revision) || !text(q.title, 240)
      || !amount(q.pointsPerCorrect) || !amount(q.completionBonus)) return null;
    trivia = { id: q.id, title: q.title, revision: q.revision as string, pointsPerCorrect: q.pointsPerCorrect, completionBonus: q.completionBonus };
  }
  return { version: TENANT_ACTIONS_VERSION, status: raw.status as TenantActionConfiguration["status"],
    allowedActions: [...new Set(raw.allowedActions)] as TenantPublicAction[], program, trivia, catalogAvailable: raw.catalogAvailable,
    ...(raw.tenantSlug !== undefined ? { tenantSlug: raw.tenantSlug as string | null } : {}) };
}

/** Publication decides company services; the existing tap policy still decides rights.
 * Program and quiz publication remain independent of the profile's service toggles. */
export function resolveTenantActionAvailability({ configuration, verifiedTenant = false, canEngage = true, isDemoPreview = false,
  allowedActions = [], blockedActions = [] }: {
  configuration?: unknown; verifiedTenant?: boolean; canEngage?: boolean; isDemoPreview?: boolean;
  allowedActions?: readonly string[]; blockedActions?: readonly string[];
}) {
  const parsed = parseTenantActionConfiguration(configuration);
  const known = verifiedTenant && parsed !== null && parsed.status !== "unavailable";
  const published = known && parsed.status === "published";
  const allowed = new Set(allowedActions.map(action => action.trim().toLowerCase()));
  const blocked = new Set(blockedActions.map(action => action.trim().toLowerCase()));
  const enabled = (action: TenantPublicAction) => isDemoPreview || Boolean(canEngage && published && parsed.allowedActions.includes(action) && !blocked.has(action));
  const loyalty = isDemoPreview || Boolean(canEngage && known && parsed.program && allowed.has("rewards") && !blocked.has("rewards"));
  return { configuration: parsed, state: isDemoPreview ? "demo" as const : !known ? "unavailable" as const : published ? "published" as const : "unpublished" as const,
    companyPublished: isDemoPreview || published, lead: enabled("lead"), feedback: enabled("feedback"), sommelier: enabled("sommelier"),
    marketplace: enabled("marketplace") && (isDemoPreview || parsed?.catalogAvailable === true), loyalty,
    trivia: isDemoPreview || Boolean(loyalty && parsed?.trivia), quiz: known ? parsed.trivia : null };
}

export const TENANT_ACTION_COPY = {
  "es-AR": { unavailable: "No pudimos cargar las opciones de la marca. La información del producto sigue disponible.", unpublished: "La marca todavía no habilitó experiencias para este producto.", empty: "No hay experiencias habilitadas para este producto en este momento." },
  en: { unavailable: "We could not load the brand's options. Product information remains available.", unpublished: "The brand has not enabled experiences for this product yet.", empty: "No experiences are enabled for this product at the moment." },
  "pt-BR": { unavailable: "Não foi possível carregar as opções da marca. As informações do produto continuam disponíveis.", unpublished: "A marca ainda não habilitou experiências para este produto.", empty: "Não há experiências habilitadas para este produto no momento." },
} as const;
