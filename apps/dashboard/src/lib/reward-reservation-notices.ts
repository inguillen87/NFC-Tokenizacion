/** Read-only presentation of persisted configuration. This model never decides whether a member can reserve. */
export const REWARD_REQUIREMENTS_VERSION = "portal-reservation-requirements.v1";

export type RewardNoticeRow = { label: string; value: string; attention: boolean };
export type RewardReservationNotice = {
  state: "reported" | "review" | "legacy" | "invalid" | "scope_mismatch" | "demo" | "unavailable";
  summary: string;
  note: string;
  rows: RewardNoticeRow[];
};
type NoticeContext = {
  tenantScope: string;
  dataSource: "production" | "demo" | "unavailable";
};
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const flag = (value: unknown): boolean | null => typeof value === "boolean" ? value : null;
const text = (value: unknown): string | null => typeof value === "string" && value.trim().length > 0 && value.length <= 200 ? value.trim() : null;
const integer = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647 ? value : null;
const advisory = "Estas condiciones describen la configuración guardada. La reserva se valida para cada persona en el portal; el estado Activo no confirma que pueda reservar.";

/** Navigation only: never infer an association from a program name or an unconfirmed source. */
export function rewardProgramConfigurationLink(rewardValue: unknown, context: NoticeContext): string | null {
  if (context.dataSource !== "production") return null;
  const reward = object(rewardValue);
  const tenant = context.tenantScope;
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(tenant) || reward?.tenant_slug !== tenant) return null;
  const requirements = object(reward.reservation_requirements);
  const program = object(requirements?.program);
  if (requirements?.version !== REWARD_REQUIREMENTS_VERSION || program?.association_confirmed !== true
    || typeof reward.program_id !== "string" || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(reward.program_id)) return null;
  return `/loyalty/configuration?${new URLSearchParams({ tenant, program: reward.program_id.toLowerCase() })}`;
}

function dateRow(label: string, value: unknown): RewardNoticeRow {
  if (value === null) return { label, value: "Fecha no informada", attention: true };
  // The API's versioned model emits canonical ISO instants. Never turn an invalid or missing value into an open-ended period.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return { label, value: "Fecha sin confirmar", attention: true };
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) return { label, value: "Fecha sin confirmar", attention: true };
  return { label, value: `${new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date)} UTC`, attention: false };
}

export function rewardReservationNotice(rewardValue: unknown, context: NoticeContext): RewardReservationNotice {
  if (context.dataSource === "unavailable") return {
    state: "unavailable", summary: "Condiciones no disponibles", rows: [],
    note: "No se pudo confirmar la fuente del catálogo. Volvé a consultar antes de revisar sus condiciones.",
  };
  if (context.dataSource === "demo") return {
    state: "demo", summary: "Información ilustrativa", rows: [],
    note: "Esta muestra no confirma programas, requisitos ni reservas de una empresa real.",
  };
  const reward = object(rewardValue);
  const scope = context.tenantScope.trim().toLowerCase();
  const tenant = text(reward?.tenant_slug)?.toLowerCase();
  if (!reward || !tenant || (scope && tenant !== scope)) return {
    state: "scope_mismatch", summary: "Empresa sin confirmar", rows: [],
    note: "Las condiciones no se muestran porque no pudo confirmarse la empresa del beneficio en esta consulta. Volvé a consultar el catálogo de la empresa.",
  };
  if (!Object.hasOwn(reward, "reservation_requirements")) return {
    state: "legacy", summary: "Detalle de condiciones pendiente", rows: [],
    note: `La fuente todavía no informó este detalle. No se presupone que el beneficio esté disponible para reservar. ${advisory}`,
  };
  const requirements = object(reward.reservation_requirements);
  if (!requirements || requirements.version !== REWARD_REQUIREMENTS_VERSION) return {
    state: "invalid", summary: "Condiciones sin confirmar", rows: [],
    note: "La fuente devolvió un detalle que no pudo interpretarse. Revisá la configuración de la empresa antes de habilitar reservas.",
  };
  const program = object(requirements.program);
  const association = flag(program?.association_confirmed);
  const programName = association === true ? text(program?.name) : null;
  const rewardAge = flag(requirements.requires_age_gate);
  const programAge = association === true ? flag(program?.age_gate_required) : null;
  const ageRequired = rewardAge === true || programAge === true;
  const ageUnknown = rewardAge === null || programAge === null;
  const rows: RewardNoticeRow[] = [
    {
      label: "Programa",
      value: association === true ? programName || "Programa asociado · nombre no informado"
        : association === false ? "Sin programa confirmado para esta empresa" : "Asociación con el programa sin confirmar",
      attention: association !== true || programName === null,
    },
    dateRow("Desde", requirements.starts_at),
    dateRow("Hasta", requirements.ends_at),
    {
      label: "Edad",
      value: ageRequired ? `Verificación de edad (+18) configurada${ageUnknown ? " · falta confirmar el resto de la configuración" : ""}`
        : ageUnknown ? "Requisito de edad sin confirmar" : "Sin requisito de edad configurado en el beneficio ni en el programa",
      attention: ageUnknown,
    },
  ];
  if (!rows[1].attention && !rows[2].attention && Date.parse(String(requirements.ends_at)) < Date.parse(String(requirements.starts_at))) {
    rows[2] = { ...rows[2], value: `${rows[2].value} · anterior al inicio, revisar la vigencia`, attention: true };
  }
  for (const [key, label] of [["eligibility_policy_review", "Acceso"], ["fulfillment_policy_review", "Entrega"]] as const) {
    const review = flag(requirements[key]);
    rows.push({
      label,
      value: review === true ? "Condiciones personalizadas · requieren revisión antes de habilitar reservas"
        : review === false ? "Sin condiciones personalizadas configuradas" : "Condiciones sin confirmar · requieren revisión",
      attention: review !== false,
    });
  }
  const limit = integer(requirements.redemption_limit_per_member);
  const limitKnown = requirements.redemption_limit_known === true;
  rows.push({
    label: "Límite por persona",
    value: !limitKnown ? "Límite sin confirmar" : requirements.redemption_limit_per_member === null ? "Sin límite configurado"
      : limit === null ? "Límite sin confirmar" : limit === 0 ? "Cero reservas configuradas" : `${limit} ${limit === 1 ? "reserva" : "reservas"}`,
    attention: !limitKnown || (requirements.redemption_limit_per_member !== null && limit === null),
  });
  const review = rows.some(row => row.attention);
  return { state: review ? "review" : "reported", summary: review ? "Revisar condiciones" : "Condiciones informadas", note: advisory, rows };
}
