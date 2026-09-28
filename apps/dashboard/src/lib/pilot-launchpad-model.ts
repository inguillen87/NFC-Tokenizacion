import type { DashboardSession } from './session';
import { dashboardCanOpenDestination, DASHBOARD_DESTINATIONS } from './dashboard-destination-policy';
import { buildBatchWorkspaceNavigation, batchWorkspaceHref, type BatchWorkspaceView } from './batch-workspace-navigation';
import { canReadPilotReport } from './pilot-report-access';
import { parseBatchWorkRows, type BatchWorkRow } from './batch-workbench';
export type PilotAccess = Pick<DashboardSession, 'role' | 'permissions' | 'deniedPermissions' | 'tenantSlug' | 'isDemo'>;
export type PilotScope = { state: 'selected' | 'tenant_required' | 'forbidden' | 'demo' | 'invalid'; tenant: string; canSelect: boolean };
export type PilotSource = { state: 'ready'; rows: BatchWorkRow[]; checkedAt: string } | { state: 'unavailable' | 'forbidden' | 'invalid' | 'timeout'; rows: null; checkedAt: string };
export type PilotTask = { view: BatchWorkspaceView; title: string; description: string; href: string | null };
export type PilotBatch = Pick<BatchWorkRow, 'bid' | 'tenant' | 'name' | 'sku' | 'carrier' | 'quantity' | 'active' | 'inactive' | 'revoked'> & { tasks: PilotTask[] };
export type PilotLaunchpadModel = {
 state: PilotScope['state'] | PilotSource['state']; tenant: string; canSelect: boolean; checkedAt: string | null; batches: PilotBatch[];
 links: { settings: string | null; batches: string | null; editorial: string | null; reception: string | null; report: string | null; usage: string | null; tenants: string | null };
};
const slug = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(v);
export function resolvePilotScope(access: PilotAccess, requested?: unknown): PilotScope {
 const global = access.role === 'super-admin' && !access.tenantSlug;
 const result = (state: PilotScope['state'], tenant = ''): PilotScope => ({ state, tenant, canSelect: global });
 if (!dashboardCanOpenDestination('onboarding', access) || !dashboardCanOpenDestination('batches', access)) return result('forbidden');
 if (access.isDemo) return result('demo');
 if (requested !== undefined && typeof requested !== 'string') return result('invalid');
 const selected = typeof requested === 'string' ? requested.trim().toLowerCase() : '';
 if (selected && !slug(selected)) return result('invalid');
 if (!global) {
  if (!slug(access.tenantSlug)) return result('forbidden');
  if (selected && selected !== access.tenantSlug) return result('forbidden');
  return result('selected', access.tenantSlug);
 }
 return selected ? result('selected', selected) : result('tenant_required');
}
export function parsePilotBatches(value: unknown, tenant: string): BatchWorkRow[] {
 if (!slug(tenant) || !Array.isArray(value)) throw Error('pilot_scope');
 for (const row of value) if (!row || row.demo === true || row.demoMode === true || row.is_demo === true || ['demo', 'synthetic', 'fixture'].includes(row.dataSource)) throw Error('pilot_provenance');
 const rows = parseBatchWorkRows(value, tenant);
 if (new Set(rows.map(r => r.id)).size !== rows.length || rows.some(r => !batchWorkspaceHref(r.bid, r.tenant))) throw Error('pilot_identity');
 return rows;
}
const TASKS: { view: BatchWorkspaceView; title: string; description: string }[] = [
 { view: 'passport', title: 'Pasaporte digital', description: 'Consultar el contenido y continuar su edición, revisión o publicación según los permisos del expediente.' },
 { view: 'overview', title: 'Identidad y expediente', description: 'Consultar la ficha del producto, las unidades del lote y las lecturas disponibles.' },
 { view: 'production', title: 'Etiquetas y códigos', description: 'Abrir las herramientas de etiquetas, importación GS1 y códigos del lote.' },
 { view: 'traceability', title: 'Trazabilidad', description: 'Consultar eventos y referencias del lote, con la procedencia y el alcance de la evidencia.' },
 { view: 'recalls', title: 'Excepciones y retiros', description: 'Revisar casos, responsables y conciliación del lote. Las operaciones requieren confirmación en su módulo.' },
];
export function buildPilotLaunchpad(access: PilotAccess, scope: PilotScope, source?: PilotSource): PilotLaunchpadModel {
 const selected = scope.state === 'selected';
 const scoped = (url: string) => `${url}?${new URLSearchParams({ tenant: scope.tenant })}`;
 const destination = (key: keyof typeof DASHBOARD_DESTINATIONS) => selected && dashboardCanOpenDestination(key, access) ? scoped(DASHBOARD_DESTINATIONS[key].href) : null;
 const model: PilotLaunchpadModel = { state: selected ? source?.state || 'unavailable' : scope.state, tenant: scope.tenant, canSelect: scope.canSelect, checkedAt: selected ? source?.checkedAt || null : null, batches: [],
  links: { settings: dashboardCanOpenDestination('settings', access) ? '/settings' : null, batches: destination('batches'), editorial: destination('editorialQueue'), reception: destination('supplierBatches'), report: selected && canReadPilotReport(access) ? scoped('/analytics/pilot') : null, usage: destination('serviceLevels'), tenants: scope.canSelect && dashboardCanOpenDestination('tenants', access) ? '/tenants' : null } };
 if (!selected || source?.state !== 'ready') return model;
 for (const row of source.rows) {
  const nav = buildBatchWorkspaceNavigation(row.bid, row.tenant, 'overview', access);
  if (row.tenant !== scope.tenant || nav.reason !== 'ready') return { ...model, state: 'invalid', batches: [] };
  model.batches.push({ bid: row.bid, tenant: row.tenant, name: row.name, sku: row.sku, carrier: row.carrier, quantity: row.quantity, active: row.active, inactive: row.inactive, revoked: row.revoked,
   tasks: TASKS.map(task => ({ ...task, href: nav.items.find(item => item.view === task.view)?.href || null })) });
 }
 return model;
}
export function filterPilotBatches(rows: PilotBatch[], query: string): PilotBatch[] {
 const words = query.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().split(/\s+/).filter(Boolean);
 return rows.filter(row => { const text = [row.bid, row.name, row.sku, row.carrier].join(' ').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); return words.every(word => text.includes(word)); });
}
