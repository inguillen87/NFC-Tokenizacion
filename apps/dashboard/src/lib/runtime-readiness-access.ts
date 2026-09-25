import { dashboardPermissionDenied } from './permission-policy';
export type RuntimeConsoleAccess = {
  id?: string; role: string; tenantId?: string | null; tenantSlug?: string | null;
  isDemo?: boolean; deniedPermissions?: readonly string[];
};
export function canReadRuntimeConsole(access: RuntimeConsoleAccess | null | undefined): boolean {
  return Boolean(access && access.role === 'super-admin' && !access.tenantId && !access.tenantSlug && access.isDemo !== true
    && !dashboardPermissionDenied([...(access.deniedPermissions || [])], 'audit.read')
    && !dashboardPermissionDenied([...(access.deniedPermissions || [])], 'audit:read'));
}
export function runtimeConsoleScopeKey(access: RuntimeConsoleAccess): string {
  return JSON.stringify([access.id || '', access.role, access.tenantId || '', access.tenantSlug || '', access.isDemo === true,
    [...(access.deniedPermissions || [])].sort()]);
}
