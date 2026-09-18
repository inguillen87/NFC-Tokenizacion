import {permissionMatches,permissionDenied} from './permission-matcher.js';
import {roleMayUseEnterpriseCapability} from './enterprise-capability-policy';
/** A permitted batch task needs its read-only workbench. Never infer mutation/approval/tenant authority. */
const TASKS=['supplier_order.create','manifest.import','qa.approve','batch.activate','batch.lifecycle','batch.product.configure','batch.product.review','batch.product.publish'] as const;
export function batchWorkbenchPermissions(input:{role:string;permissions:string[];deniedPermissions?:string[]}):string[]{
 const permissions=[...new Set(input.permissions)];
 // Preserve the original administrative dossier role boundary.
 if(!['super-admin','tenant-owner','tenant-admin'].includes(input.role.replaceAll('_','-')))return permissions;
 if(permissionDenied(input.deniedPermissions,'batches:read')||permissionMatches(permissions,'batches:read',input.deniedPermissions))return permissions;
 const hasTask=TASKS.some(task=>roleMayUseEnterpriseCapability(input.role,task)&&permissionMatches(permissions,task,input.deniedPermissions));
 return hasTask?[...permissions,'batches:read']:permissions;
}
