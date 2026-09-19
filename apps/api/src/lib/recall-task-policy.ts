import {recallCapabilities} from './recall-authority';
import {recallCommand,recallId,RecallError} from './recall-policy';
export const TASK_PROTOCOL='nexid.recall-assigned-tasks.v1';
export function recallTaskCapabilities(role:string,has:(p:string)=>boolean,denied:(p:string)=>boolean){
 const base=recallCapabilities(role,has,denied,false);
 const human=role!=='api-integration';
 const canRead=human&&!denied('recall_tasks:read')&&(has('recall_tasks:read')||has('recall_tasks:respond')||base.canRead);
 const canRespond=canRead&&!denied('recall_tasks:respond')&&['super-admin','tenant-owner','tenant-admin','operations-manager','packaging-operator','security-operator'].includes(role)&&(has('recall_tasks:respond')||base.canWrite);
 return {canRead,canRespond};
}
export type TaskActor={id:string;label:string;tenantId:string|null;tenantSlug:string|null;canRead:boolean;canRespond:boolean};
export function taskCommand(action:string,caseId:string,destinationId:string,raw:unknown){
 if(!['acknowledge','account'].includes(action))throw new RecallError('recall_task_action_forbidden',403);
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new RecallError('recall_field_not_allowed',400);
 const {expectedNoticeVersion,...body}=raw as Record<string,unknown>;
 if(typeof expectedNoticeVersion!=='number'||!Number.isSafeInteger(expectedNoticeVersion)||expectedNoticeVersion<1)throw new RecallError('recall_task_notice_version_invalid',400);
 const parsed=recallCommand(action,body);
 if(parsed.caseId!==recallId(caseId)||parsed.destinationId!==recallId(destinationId))throw new RecallError('recall_task_scope_forbidden',403);
 return {...parsed,expectedNoticeVersion};
}
