import {dashboardPermissionMatches} from './permission-policy';
export function canUseEpcisIntake(session:{role:string;permissions:string[];deniedPermissions?:string[];isDemo?:boolean}){
 return !session.isDemo&&['super-admin','tenant-owner','tenant-admin','operations-manager'].includes(session.role)
 &&dashboardPermissionMatches(session.permissions,'batches:read',session.deniedPermissions)
 &&dashboardPermissionMatches(session.permissions,'logistics:read',session.deniedPermissions)
 &&dashboardPermissionMatches(['epcis.import'],'epcis.import',session.deniedPermissions);
}
