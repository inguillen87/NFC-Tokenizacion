import { dashboardPermissionDenied } from "./permission-policy";

export const SUPPLIER_OPERATOR_HOME = "/supplier-orders/requests";
export const SUPPLIER_OPERATOR_CAPABILITIES = ["supplier_request.assigned.read", "supplier_request.assigned.review"] as const;
export const isSupplierOperator = (role: unknown) => String(role || "").replaceAll("_", "-") === "supplier-operator";
export function supplierOperatorPermissions(value: unknown): string[] {
  return Array.isArray(value) ? SUPPLIER_OPERATOR_CAPABILITIES.filter(permission => value.includes(permission)) : [];
}
export function supplierOperatorCan(access: { role: unknown; userId?: string; tenantId?: string | null; tenantSlug?: string | null; permissions?: unknown; deniedPermissions?: unknown; isDemo?: boolean }, capability: typeof SUPPLIER_OPERATOR_CAPABILITIES[number]) {
  return isSupplierOperator(access.role) && !access.isDemo && !access.tenantId && !access.tenantSlug && typeof access.userId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(access.userId)
    && supplierOperatorPermissions(access.permissions).includes(capability) && !dashboardPermissionDenied(access.deniedPermissions, capability);
}
export function supplierOperatorPageAllowed(path: string) {
  try { const url = new URL(path, "https://dashboard.invalid"); return url.origin === "https://dashboard.invalid" && url.pathname === SUPPLIER_OPERATOR_HOME; } catch { return false; }
}
