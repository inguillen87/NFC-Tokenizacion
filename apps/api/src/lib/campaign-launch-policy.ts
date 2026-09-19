export const LAUNCH_PROTOCOL='nexid.campaign-launch.v1';
export const LAUNCH_ACTIONS=['configure','submit','request_changes','approve','simulate'] as const;
export type LaunchAction=typeof LAUNCH_ACTIONS[number];
export type LaunchActor={id:string;label:string;canRead:boolean;canWrite:boolean;canApprove:boolean;canExport:boolean};
export class LaunchError extends Error{constructor(public code:string,public status=409){super(code);}}
export function launchId(v:unknown){if(typeof v!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v))throw new LaunchError('launch_id_invalid',400);return v.toLowerCase();}
export function launchSettings(raw:unknown){const r=raw as Record<string,unknown>;
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).sort().join(',')!=='budgetMinor,currency,maxRecipients,unitCostMinor'||(typeof r.currency!=='string'||!['ARS','USD','EUR'].includes(r.currency)))throw new LaunchError('launch_settings_invalid',400);
 for(const [key,min,max] of [['unitCostMinor',1,10000000],['budgetMinor',0,100000000],['maxRecipients',1,10000]] as const)if(!Number.isSafeInteger(r[key])||Number(r[key])<min||Number(r[key])>max)throw new LaunchError('launch_settings_invalid',400);
 return {currency:r.currency as string,unitCostMinor:r.unitCostMinor as number,budgetMinor:r.budgetMinor as number,maxRecipients:r.maxRecipients as number};
}
export function launchCommand(action:string,input:unknown){if(!(LAUNCH_ACTIONS as readonly string[]).includes(action))throw new LaunchError('launch_action_invalid',400);
 const r=input as Record<string,unknown>,allowed=['operationId','expectedVersion','expectedDraftRevision',...(action==='configure'?['settings']:[]),...(action==='request_changes'?['note']:[])];
 if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!allowed.includes(k)))throw new LaunchError('launch_fields_invalid',400);
 for(const [key,min] of [['expectedVersion',0],['expectedDraftRevision',1]] as const)if(!Number.isSafeInteger(r[key])||Number(r[key])<min||Number(r[key])>1000000)throw new LaunchError('launch_revision_invalid',400);
 const cmd:Record<string,any>={action,operationId:launchId(r.operationId),expectedVersion:r.expectedVersion,expectedDraftRevision:r.expectedDraftRevision};
 if(action==='configure')cmd.settings=launchSettings(r.settings);
 if(action==='request_changes'){if(typeof r.note!=='string'||r.note.trim().length<10||r.note.length>500||/[\u0000-\u0008\u000b-\u001f]/.test(r.note))throw new LaunchError('launch_note_required',400);cmd.note=r.note.trim();}
 return cmd;
}
export function launchCapabilities(role:string,has:(s:string)=>boolean,denied:(s:string)=>boolean,mfa:boolean){
 const canRead=['super-admin','tenant-owner','tenant-admin','marketing-manager'].includes(role)&&has('campaigns:read')&&!denied('campaigns:read');
 const canWrite=canRead&&has('campaigns:write')&&!denied('campaigns:write');
 const canApprove=canWrite&&mfa&&['super-admin','tenant-owner','tenant-admin'].includes(role)&&!denied('campaigns:approve');
 return {canRead,canWrite,canApprove,canExport:canRead&&has('reports.export')};
}
export function launchFailure(e:unknown){if(e instanceof LaunchError)return {reason:e.code,status:e.status};if(e instanceof SyntaxError)return {reason:'launch_json_invalid',status:400};if(e instanceof Error&&e.name==='RequestBodyTooLargeError')return {reason:'launch_body_too_large',status:413};const message=e instanceof Error?e.message:'';if(/^launch_[a-z_]+$/.test(message))return {reason:message,status:/not_found/.test(message)?404:/forbidden|independent/.test(message)?403:409};return {reason:'launch_source_unavailable',status:503};}
