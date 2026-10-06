export const POST_TAP_SERVICES = ["lead", "feedback", "sommelier", "marketplace"] as const;
export const CONFIGURATION_VERTICALS = ["wine", "spirits", "events", "cosmetics", "agro", "pharma", "luxury", "art", "documents"] as const;
export type ConfigurationAction = "save_draft" | "publish" | "withdraw";
export type ConfigurationKind = "profile" | "program" | "quiz";
export type ConfigurationQuestion = { id: string; prompt: string; options: string[]; correctIndex: number; explanation?: string };
export type ConfigurationProfile = { revision: string; lastOperationId: string | null; status: "draft" | "published" | "paused"; allowedActions: string[] };
export type ConfigurationProgram = { id: string; revision: string; lastOperationId: string | null; name: string; vertical: string; status: string; pointsName: string; pointsPerValidTap: number | null; cooldownSeconds: number | null; startAt: string | null; endAt: string | null };
export type ConfigurationQuiz = { id: string; revision: string; lastOperationId: string | null; programId: string; title: string; description: string; vertical: string; status: string; startsAt: string | null; endsAt: string | null; questions: ConfigurationQuestion[]; pointsPerCorrect: number; completionBonus: number; passThreshold: number; managed: boolean };
export type ConfigurationResource = ConfigurationProfile | ConfigurationProgram | ConfigurationQuiz;
export type LoyaltyConfiguration = { ok: true; tenant: string; profile: ConfigurationProfile; programs: ConfigurationProgram[]; quizzes: ConfigurationQuiz[];
  limits?: { programs: number; quizzes: number; programsTruncated: boolean; quizzesTruncated: boolean } };
export type ConfigurationCommand = Record<string, unknown> & { kind: ConfigurationKind; expectedRevision: string | null; operationId: string; action: ConfigurationAction; id?: string };

export function configurationReconciliation(resource: ConfigurationResource | null, command: ConfigurationCommand): "confirmed" | "retry_allowed" | "changed" | "unavailable" {
  if (resource?.lastOperationId === command.operationId) return "confirmed";
  if (!resource) return command.expectedRevision === null ? "retry_allowed" : "unavailable";
  return resource.revision === command.expectedRevision ? "retry_allowed" : "changed";
}

const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const revision = (value: unknown): value is string => text(value) && value.length > 0 && value.length <= 200;
const integer = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2_147_483_647;
const date = (value: unknown) => value === null || (text(value) && Number.isFinite(Date.parse(value)));
const programStatuses = ["draft", "active", "paused", "archived"];
const quizStatuses = ["draft", "active", "paused", "archived"];

export function isConfigurationResource(kind: ConfigurationKind, value: unknown): value is ConfigurationResource {
  if (!record(value) || !revision(value.revision) || !(value.lastOperationId === null || text(value.lastOperationId) && uuid.test(value.lastOperationId))) return false;
  if (kind === "profile") return ["draft", "published", "paused"].includes(String(value.status)) && Array.isArray(value.allowedActions)
    && value.allowedActions.every(action => POST_TAP_SERVICES.includes(action as typeof POST_TAP_SERVICES[number]));
  if (!text(value.id) || !uuid.test(value.id) || !text(value.vertical)) return false;
  if (kind === "program") return programStatuses.includes(String(value.status)) && text(value.name) && text(value.pointsName)
    && (value.pointsPerValidTap === null || integer(value.pointsPerValidTap)) && (value.cooldownSeconds === null || integer(value.cooldownSeconds))
    && date(value.startAt) && date(value.endAt);
  return quizStatuses.includes(String(value.status)) && text(value.programId) && uuid.test(value.programId) && text(value.title) && text(value.description)
    && date(value.startsAt) && date(value.endsAt) && integer(value.pointsPerCorrect) && integer(value.completionBonus) && integer(value.passThreshold)
    && typeof value.managed === "boolean" && Array.isArray(value.questions) && value.questions.length <= (value.managed ? 12 : 50) && value.questions.every(q => record(q)
      && text(q.id) && text(q.prompt) && Array.isArray(q.options) && q.options.length <= (value.managed ? 6 : 100) && q.options.every(text)
      && Number.isInteger(q.correctIndex) && (q.explanation === undefined || text(q.explanation)));
}

export function parseLoyaltyConfiguration(value: unknown, tenant: string): LoyaltyConfiguration | null {
  if (!record(value) || value.ok !== true || value.tenant !== tenant || !tenant || !isConfigurationResource("profile", value.profile)
    || !Array.isArray(value.programs) || !value.programs.every(item => isConfigurationResource("program", item))
    || !Array.isArray(value.quizzes) || !value.quizzes.every(item => isConfigurationResource("quiz", item))) return null;
  if (value.limits !== undefined && (!record(value.limits) || value.limits.programs !== 100 || value.limits.quizzes !== 300
    || typeof value.limits.programsTruncated !== "boolean" || typeof value.limits.quizzesTruncated !== "boolean")) return null;
  const programs = value.programs as ConfigurationProgram[];
  const quizzes = value.quizzes as ConfigurationQuiz[];
  if (new Set(programs.map(p => p.id)).size !== programs.length || new Set(quizzes.map(q => q.id)).size !== quizzes.length) return null;
  return value as LoyaltyConfiguration;
}

export function isPublished(resource: ConfigurationResource) { return resource.status === "active" || resource.status === "published"; }
export function configurationState(resource: ConfigurationResource, now = Date.now()): string {
  if (resource.status === "paused") return "Retirado";
  if (resource.status === "archived") return "Archivado";
  if (!isPublished(resource)) return "Borrador";
  const start = "startAt" in resource ? resource.startAt : "startsAt" in resource ? resource.startsAt : null;
  const end = "endAt" in resource ? resource.endAt : "endsAt" in resource ? resource.endsAt : null;
  if (start && Date.parse(start) > now) return "Publicado · programado";
  if (end && Date.parse(end) < now) return "Publicado · finalizado";
  return "Publicado";
}

export function explicitInteger(value: string): number {
  if (!/^\d+$/.test(value.trim()) || !integer(Number(value))) throw new Error("configuration_invalid");
  return Number(value);
}
export function configurationDate(value: string): string | null {
  if (!value.trim()) return null;
  const utc = `${value}Z`;
  if (!Number.isFinite(Date.parse(utc))) throw new Error("configuration_invalid");
  return new Date(utc).toISOString();
}
export function dateInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function buildConfigurationCommand(kind: ConfigurationKind, action: ConfigurationAction, resource: ConfigurationResource, operationId: string, fields: Record<string, unknown> = {}): ConfigurationCommand {
  if (!uuid.test(operationId) || !(resource.revision === "" || revision(resource.revision))) throw new Error("configuration_unavailable");
  if (kind !== "profile" && (!("id" in resource) || !uuid.test(resource.id))) throw new Error("configuration_unavailable");
  if (kind === "quiz" && (!("managed" in resource) || !resource.managed)) throw new Error("configuration_unavailable");
  if (action !== "withdraw" && (isPublished(resource) || resource.status === "archived")) throw new Error("configuration_active_edit");
  if (!resource.revision && action !== "save_draft") throw new Error("configuration_invalid");
  const base: ConfigurationCommand = { kind, action, operationId, expectedRevision: resource.revision || null, ...(kind !== "profile" && "id" in resource ? { id: resource.id } : {}) };
  if (action === "withdraw") {
    if (!resource.revision || !isPublished(resource)) throw new Error("configuration_invalid");
    return base;
  }
  if (kind === "profile") {
    if (!Array.isArray(fields.allowedActions) || fields.allowedActions.some(a => !POST_TAP_SERVICES.includes(a as typeof POST_TAP_SERVICES[number]))) throw new Error("configuration_invalid");
    return { ...base, allowedActions: [...new Set(fields.allowedActions)] };
  }
  const start = fields[kind === "program" ? "startAt" : "startsAt"];
  const end = fields[kind === "program" ? "endAt" : "endsAt"];
  if (!start || !date(start) || !date(end) || (end && Date.parse(String(end)) < Date.parse(String(start)))) throw new Error("configuration_invalid");
  if (!text(fields.vertical) || !CONFIGURATION_VERTICALS.includes(fields.vertical as typeof CONFIGURATION_VERTICALS[number])) throw new Error("configuration_invalid");
  if (kind === "program") {
    if (!text(fields.name) || fields.name.length > 120 || !text(fields.pointsName) || fields.pointsName.length > 60
      || !(fields.pointsPerValidTap === null && action === "save_draft" || integer(fields.pointsPerValidTap) && Number(fields.pointsPerValidTap) <= 10_000)
      || !(fields.cooldownSeconds === null && action === "save_draft" || integer(fields.cooldownSeconds) && Number(fields.cooldownSeconds) <= 604800)
      || action === "publish" && (!fields.name.trim() || !fields.pointsName.trim())) throw new Error("configuration_invalid");
    return { ...base, name: fields.name.trim(), vertical: fields.vertical, pointsName: fields.pointsName.trim(), pointsPerValidTap: fields.pointsPerValidTap, cooldownSeconds: fields.cooldownSeconds, startAt: start, endAt: end };
  }
  if (!text(fields.programId) || !uuid.test(fields.programId) || ("programId" in resource && resource.revision && fields.programId !== resource.programId)
    || !text(fields.title) || fields.title.length > 160 || !text(fields.description) || fields.description.length > 1000
    || !integer(fields.pointsPerCorrect) || Number(fields.pointsPerCorrect) > 1_000_000 || !integer(fields.completionBonus) || Number(fields.completionBonus) > 1_000_000 || !integer(fields.passThreshold) || Number(fields.passThreshold) > 12
    || !Array.isArray(fields.questions) || fields.questions.length > 12) throw new Error("configuration_invalid");
  const questions = fields.questions as ConfigurationQuestion[];
  if (new Set(questions.map(q => q.id)).size !== questions.length || questions.some(q => !text(q.id) || !/^[a-zA-Z0-9_-]{1,64}$/.test(q.id) || !text(q.prompt) || q.prompt.length > 500 || !Array.isArray(q.options)
    || q.options.length > 6 || !q.options.every(o => text(o) && o.length <= 240) || !integer(q.correctIndex) || q.correctIndex > 5 || (q.explanation?.length ?? 0) > 1000)) throw new Error("configuration_invalid");
  if (action === "publish" && (!fields.title.trim() || !start || questions.length < 1 || Number(fields.passThreshold) > questions.length
    || questions.some(q => !q.prompt.trim() || q.options.length < 2 || q.options.some(o => !o.trim()) || new Set(q.options.map(o => o.trim())).size !== q.options.length || q.correctIndex < 0 || q.correctIndex >= q.options.length)
    || questions.length * Number(fields.pointsPerCorrect) + Number(fields.completionBonus) > 1_000_000)) throw new Error("configuration_invalid");
  return { ...base, programId: fields.programId, title: fields.title, description: fields.description, vertical: fields.vertical, startsAt: start, endsAt: end,
    questions, pointsPerCorrect: fields.pointsPerCorrect, completionBonus: fields.completionBonus, passThreshold: fields.passThreshold };
}

export function configurationErrorCopy(reason: unknown): string {
  const messages: Record<string, string> = {
    configuration_revision_conflict: "La configuración cambió. Tu formulario sigue aquí. Consultá el estado guardado y comparalo antes de continuar.",
    configuration_active_edit: "Retirá la publicación antes de editar. El contenido publicado continúa vigente hasta confirmar el retiro.",
    configuration_active_conflict: "Ya hay otra publicación en este ámbito. Consultá los programas y trivias publicados antes de continuar.",
    configuration_invalid: "Revisá los campos: puntos por lectura de 0 a 10.000, espera de 0 a 604.800 segundos, fechas en orden y preguntas completas. La trivia publicada admite hasta 1.000.000 de puntos en total. Tu formulario sigue aquí.",
    configuration_unavailable: "No pudo confirmarse la configuración. Tu formulario sigue aquí. Consultá el estado guardado antes de continuar.",
    configuration_profile_required: "Esta empresa necesita completar su perfil de marca antes de configurar servicios y beneficios. Contactá al administrador; tu formulario sigue aquí.",
    configuration_tenant_required: "Seleccioná la empresa antes de consultar o guardar su configuración.",
    configuration_body_too_large: "La configuración supera el tamaño admitido. Acortá los textos; tu formulario sigue aquí.",
    configuration_idempotency_conflict: "Esta operación ya tiene otro contenido registrado. Consultá el estado guardado; tu formulario sigue aquí.",
    configuration_forbidden: "Este perfil no tiene acceso a la configuración de la empresa. Solicitá el permiso correspondiente al administrador.",
  };
  return typeof reason === "string" && messages[reason] ? messages[reason] : messages.configuration_unavailable;
}
