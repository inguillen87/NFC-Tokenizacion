import type { SupplierAssignedRequest } from "./supplier-assigned-request-client";

export type AssignedWorkbenchFilter = "all" | "actionable" | "pending" | "answered" | "needs_information" | "provisioned" | "unknown";
export type AssignedWorkbenchSort = "review_first" | "oldest_activity" | "recent_activity";
type RequestState = Exclude<AssignedWorkbenchFilter, "all" | "actionable">;

export const ASSIGNED_WORKBENCH_LABELS: Record<RequestState, string> = {
  pending: "Revisión de NexID pendiente",
  answered: "Respuesta recibida",
  needs_information: "Esperando respuesta de la empresa",
  provisioned: "Pedido preparado",
  unknown: "Revisión sin confirmar",
};

export function assignedWorkbenchState(item: SupplierAssignedRequest): RequestState {
  if (item.status === "provisioned") return "provisioned";
  if (item.status !== "submitted") return "unknown";
  const state = item.review_summary?.state;
  return state === "pending" || state === "answered" || state === "needs_information" ? state : "unknown";
}

export function assignedWorkbenchActivity(item: SupplierAssignedRequest): string {
  return item.review_summary?.updated_at || item.submitted_at || item.updated_at;
}

function activityTime(item: SupplierAssignedRequest): number {
  const time = Date.parse(assignedWorkbenchActivity(item));
  return Number.isFinite(time) ? time : 0;
}

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

/** Presentation only: neither priorities nor counters authorize an operation. */
export function buildAssignedWorkbench(
  items: readonly SupplierAssignedRequest[],
  query = "",
  filter: AssignedWorkbenchFilter = "all",
  sort: AssignedWorkbenchSort = "review_first",
) {
  const counts = { all: items.length, actionable: 0, pending: 0, answered: 0, needs_information: 0, provisioned: 0, unknown: 0 };
  const terms = searchable(query.trim()).split(/\s+/).filter(Boolean);
  for (const item of items) {
    const state = assignedWorkbenchState(item);
    counts[state]++;
    if (state === "pending" || state === "answered") counts.actionable++;
  }
  const priority: Record<RequestState, number> = { unknown: 0, answered: 1, pending: 2, needs_information: 3, provisioned: 4 };
  const visible = items.filter(item => {
    const state = assignedWorkbenchState(item);
    const matches = filter === "all" || (filter === "actionable" ? state === "pending" || state === "answered" : state === filter);
    const text = searchable([item.title, item.tenant_slug, item.id, item.construction_id].join(" "));
    return matches && terms.every(term => text.includes(term));
  }).sort((a, b) => {
    const stateOrder = sort === "review_first" ? priority[assignedWorkbenchState(a)] - priority[assignedWorkbenchState(b)] : 0;
    const activityOrder = sort === "recent_activity" ? activityTime(b) - activityTime(a) : activityTime(a) - activityTime(b);
    return stateOrder || activityOrder || a.id.localeCompare(b.id);
  });
  return { counts, visible };
}

export function assignedWorkbenchNextStep(item: SupplierAssignedRequest, canWrite: boolean): string {
  switch (assignedWorkbenchState(item)) {
    case "unknown": return "Volver a consultar el estado antes de actuar.";
    case "answered": return canWrite ? "Revisar la respuesta de la empresa y sus aclaraciones." : "Consultar la respuesta de la empresa, en modo lectura.";
    case "pending": return canWrite ? "Revisar los datos y pedir una aclaración si hace falta." : "Consultar los datos y el historial, en modo lectura.";
    case "needs_information": return "La próxima respuesta corresponde a la empresa.";
    case "provisioned": return "Consultar el historial. No confirma fabricación ni entrega.";
  }
}

export type AssignedReadKind = "list" | "detail";
export type AssignedReadTicket = Readonly<{ kind: AssignedReadKind; controller: AbortController }>;

/** Invalidated responses cannot repopulate a revoked or unmounted scope, even if fetch ignores abort. */
export function createAssignedReadScope() {
  const active = new Map<AssignedReadKind, AssignedReadTicket>();
  return {
    begin(kind: AssignedReadKind): AssignedReadTicket {
      const previous = active.get(kind);
      const ticket = Object.freeze({ kind, controller: new AbortController() });
      active.set(kind, ticket);
      previous?.controller.abort();
      return ticket;
    },
    isCurrent(ticket: AssignedReadTicket): boolean { return active.get(ticket.kind) === ticket; },
    pending(): boolean { return active.size > 0; },
    finish(ticket: AssignedReadTicket): boolean {
      if (active.get(ticket.kind) !== ticket) return false;
      active.delete(ticket.kind);
      return true;
    },
    invalidate(): void {
      const previous = [...active.values()];
      active.clear();
      for (const ticket of previous) ticket.controller.abort();
    },
  };
}

/** A list-level denial invalidates the whole view; a record-level 404 removes that record only. */
export function assignedReadDenialScope(status: number, kind: AssignedReadKind): "all" | "record" | null {
  if (status === 401 || status === 403 || (status === 404 && kind === "list")) return "all";
  return status === 404 ? "record" : null;
}
