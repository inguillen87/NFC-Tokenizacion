import {dashboardPermissionMatches} from './permission-policy';
import {normalizeDashboardEnterpriseRole} from './enterprise-runtime-rbac';
const ROLES=['super-admin','tenant-owner','tenant-admin','security-analyst','operations-manager','packaging-operator','marketing-manager','reseller-admin','security-operator'];
export function canReadPilotReport(s:{role:unknown;permissions?:readonly string[];deniedPermissions?:readonly string[];isDemo?:boolean}){
 const role=normalizeDashboardEnterpriseRole(s.role);
 return !s.isDemo&&!!role&&ROLES.includes(role)&&dashboardPermissionMatches(s.permissions,'reports.export',s.deniedPermissions)&&dashboardPermissionMatches(s.permissions,'analytics:read',s.deniedPermissions);
}

export function pilotRequestScopeAllowed(s:{role:unknown;tenantSlug?:string|null;isDemo?:boolean},requested:unknown){
 if(s.isDemo)return false;const selected=typeof requested==='string'?requested.trim().toLowerCase():'';
 if(normalizeDashboardEnterpriseRole(s.role)==='super-admin')return !s.tenantSlug;
 return !!s.tenantSlug&&(!selected||selected===s.tenantSlug);
}
