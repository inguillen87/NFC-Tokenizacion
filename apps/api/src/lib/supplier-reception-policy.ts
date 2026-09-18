import { permissionMatches,permissionDenied } from "./permission-matcher.js";
import { roleMayUseEnterpriseCapability } from "./enterprise-capability-policy";
export const RECEPTION_READ_CAPABILITIES=['supplier_orders:read','supplier_order.create','manifest.import','packaging_lab.manage','qa.approve','qa.plan.approve','batch.activate'] as const;
export const RECEPTION_ACTIONS=['tenants:write','supplier_order.create','manifest.import','qa.approve','qa.plan.approve','batch.activate','batch.product.configure','users:manage'] as const;
export type ReceptionPrincipal={role:string;scope:string;tenantId?:string|null;tenantSlug?:string|null;permissions:string[];deniedPermissions?:string[]};
export function receptionCapability(p:ReceptionPrincipal,action:string){
 if(!roleMayUseEnterpriseCapability(p.role,action)||permissionDenied(p.deniedPermissions,action))return false;
 if(action==='tenants:write'&&p.role!=='super-admin')return false;
 return p.scope==='super_admin'&&!p.tenantId&&!p.tenantSlug||permissionMatches(p.permissions,action,p.deniedPermissions);
}
export function canReadReception(p:ReceptionPrincipal){
 if(p.role==='api-integration'||permissionDenied(p.deniedPermissions,'supplier_reception.read'))return false;
 return RECEPTION_READ_CAPABILITIES.some(action=>receptionCapability(p,action));
}
export function receptionTenant(p:ReceptionPrincipal,requested:unknown){
 const tenant=typeof requested==='string'?requested.trim().toLowerCase():'';
 if(tenant&&!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(tenant))throw new Error('reception_tenant_invalid');
 if(p.scope==='super_admin'){if(p.tenantId||p.tenantSlug)throw new Error('reception_scope_invalid');return tenant;}
 if(!p.tenantId||!p.tenantSlug)throw new Error('reception_scope_invalid');
 if(tenant&&tenant!==p.tenantSlug)throw new Error('reception_tenant_forbidden');return p.tenantSlug;
}
export function receptionActions(p:ReceptionPrincipal){return Object.fromEntries(RECEPTION_ACTIONS.map(action=>[action,receptionCapability(p,action)]));}
