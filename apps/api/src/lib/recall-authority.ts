/** Reuse delegated incident/lifecycle authority; never grant account roles or replace explicit denies. */
export function recallCapabilities(role:string,has:(p:string)=>boolean,denied:(p:string)=>boolean,mfa:boolean){
 const readRoles=['super-admin','tenant-owner','tenant-admin','operations-manager','security-operator','security-analyst'];
 const writerRoles=['super-admin','tenant-owner','tenant-admin','operations-manager','security-operator'];
 const blocked=(...names:string[])=>names.some(denied);
 const lifecycle=has('batch.lifecycle');
 const canRead=readRoles.includes(role)&&!blocked('recalls.read','incidents:read')&&(has('incidents:read')||has('incidents:write')||lifecycle);
 const canWrite=canRead&&writerRoles.includes(role)&&!blocked('recalls.write','incidents:write')&&(has('incidents:write')||lifecycle);
 const canPublish=canWrite&&mfa&&['super-admin','tenant-owner','tenant-admin'].includes(role)&&!blocked('recalls.publish','batch.product.publish')&&(has('batch.product.publish')||(lifecycle&&has('qa.plan.approve')));
 return {canRead,canWrite,canPublish,canExport:canRead&&has('reports.export')};
}
