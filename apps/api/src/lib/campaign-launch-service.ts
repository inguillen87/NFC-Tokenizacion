import {sql} from './db';
import {LAUNCH_PROTOCOL,launchId,launchCommand,LaunchError,type LaunchActor} from './campaign-launch-policy';
export async function launchTenant(slug:string){if(!/^[a-z0-9][a-z0-9_-]{0,119}$/.test(slug))throw new LaunchError('launch_tenant_required',400);const rows=await sql`SELECT id::text,slug,name FROM public.tenants WHERE slug=${slug} LIMIT 1`;if(!rows[0])throw new LaunchError('launch_tenant_not_found',404);return rows[0] as {id:string;slug:string;name:string};}
export async function launchBoard(tenant:string,actor:LaunchActor,global:boolean){
 if(!actor.canRead)throw new LaunchError('launch_read_forbidden',403);
 const options=await sql`SELECT slug,name FROM public.tenants WHERE (${global} OR slug=${tenant}) ORDER BY name,id LIMIT 100`;
 const scope=tenant?await launchTenant(tenant):null;
 const drafts=scope?await sql`SELECT d.id::text,d.title,d.channel,d.status,d.revision,d.updated_at,w.state AS review_state,w.version AS review_version,w.draft_revision AS reviewed_revision FROM public.campaign_drafts d LEFT JOIN public.campaign_launch_plans w ON w.draft_id=d.id AND w.tenant_id=d.tenant_id WHERE d.tenant_id=${scope.id}::uuid ORDER BY d.updated_at DESC,d.id LIMIT 51`:[];
 return {ok:true,protocol:LAUNCH_PROTOCOL,source:'database',observedAt:new Date().toISOString(),scope,actor,tenantOptions:options,drafts:drafts.slice(0,50),truncated:drafts.length>50,dispatchEnabled:false};
}
export async function launchDetail(tenant:string,id:string,actor:LaunchActor,exporting=false){
 if(!actor.canRead||(exporting&&!actor.canExport))throw new LaunchError('launch_read_forbidden',403);
 const scope=await launchTenant(tenant);launchId(id);
 const rows=await sql`SELECT jsonb_build_object('id',d.id,'revision',d.revision,'title',d.title,'message',d.message,'channel',d.channel,'purpose',d.purpose,'status',d.status,'createdBy',d.created_by,'updatedBy',d.updated_by) AS draft,
 to_jsonb(w) AS plan,
 (SELECT coalesce(jsonb_agg(h.data ORDER BY h.version DESC),'[]'::jsonb) FROM (SELECT (o.result->>'version')::int AS version,jsonb_build_object('id',o.id,'version',(o.result->>'version')::int,'action',o.action,'actorId',o.actor_id,'actorLabel',o.actor_label,'at',o.created_at,'note',o.command->>'note','simulation',CASE WHEN o.action='simulate' THEN o.result->'latest_simulation' ELSE NULL END) AS data FROM public.campaign_launch_operations o WHERE o.draft_id=d.id AND o.tenant_id=d.tenant_id ORDER BY (o.result->>'version')::int DESC LIMIT 30) h) AS history
 FROM public.campaign_drafts d LEFT JOIN public.campaign_launch_plans w ON w.draft_id=d.id AND w.tenant_id=d.tenant_id WHERE d.id=${id}::uuid AND d.tenant_id=${scope.id}::uuid LIMIT 1`;
 if(!rows[0])throw new LaunchError('launch_draft_not_found',404);const {draft,plan,history}=rows[0];
 const sourceChanged=Boolean(plan&&(plan.draft_revision!==draft.revision||plan.draft_snapshot.title!==draft.title||plan.draft_snapshot.message!==draft.message||plan.draft_snapshot.channel!==draft.channel||plan.draft_snapshot.purpose!==draft.purpose||plan.draft_snapshot.createdBy!==draft.createdBy||plan.draft_snapshot.updatedBy!==draft.updatedBy));
 return {ok:true,protocol:LAUNCH_PROTOCOL,source:'database',observedAt:new Date().toISOString(),scope,actor,draft,plan,history,sourceChanged,dispatchEnabled:false};
}
export async function mutateLaunch(tenant:string,id:string,actor:LaunchActor,action:string,body:unknown){
 if(!actor.canWrite||(action==='approve'&&!actor.canApprove))throw new LaunchError('launch_action_forbidden',403);
 launchId(actor.id);launchId(id);const command=launchCommand(action,body),scope=await launchTenant(tenant);
 const rows=await sql`SELECT public.nexid_campaign_launch_v1(${scope.id}::uuid,${id}::uuid,${actor.id}::uuid,${actor.label},${JSON.stringify(command)}::jsonb) AS result`;
 const r=rows[0]?.result;if(!r?.receipt?.committed)throw new LaunchError('launch_receipt_unconfirmed',503);
 return {ok:true,protocol:LAUNCH_PROTOCOL,scope,...r,dispatchEnabled:false};
}
