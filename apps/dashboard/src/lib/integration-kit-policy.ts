import {dashboardHighImpactPermissionMatches} from './permission-policy';
export function canDownloadIntegrationKit(session:{role:string;permissions:string[];deniedPermissions?:string[];isDemo?:boolean}|null){
 return Boolean(session && !session.isDemo && dashboardHighImpactPermissionMatches(session.role,session.permissions,'api_keys.read',session.deniedPermissions||[]));
}
export function integrationShellArgument(value:unknown,fallback:string){
 return typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) ? value : fallback;
}
