type EventIdentity = {
  eventId: string;
  tenantSlug: string | null;
  tenantId?: string | null;
};

export type IncidentEventSelection<T extends EventIdentity> = {
  events: readonly T[];
  index: number;
};

export function incidentEventNavigationKey(event: EventIdentity) {
  return JSON.stringify([String(event.tenantSlug || "").trim().toLowerCase(), String(event.eventId)]);
}

export function snapshotIncidentEventSelection<T extends EventIdentity>(selected: T, visible: readonly T[]): IncidentEventSelection<T> {
  const selectedKey = incidentEventNavigationKey(selected);
  const tenant = String(selected.tenantSlug || "").trim().toLowerCase();
  const seen = new Set<string>();
  const events = visible.filter((event) => {
    const key = incidentEventNavigationKey(event);
    const sameTenantId = !selected.tenantId || !event.tenantId || selected.tenantId === event.tenantId;
    const sameTenant = tenant && String(event.tenantSlug || "").trim().toLowerCase() === tenant
      && sameTenantId;
    if ((!sameTenant && !(key === selectedKey && sameTenantId)) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((event) => ({ ...event }));
  const index = events.findIndex((event) => incidentEventNavigationKey(event) === selectedKey);
  return index < 0 ? { events: [{ ...selected }], index: 0 } : { events, index };
}

export function moveIncidentEventSelection<T extends EventIdentity>(selection: IncidentEventSelection<T> | null, direction: -1 | 1) {
  if (!selection) return null;
  const index = Math.max(0, Math.min(selection.events.length - 1, selection.index + direction));
  return index === selection.index ? selection : { ...selection, index };
}
