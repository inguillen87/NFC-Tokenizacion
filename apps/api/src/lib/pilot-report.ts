import {createHash,randomUUID} from 'node:crypto';
import {sql} from './db';
import {isVerifiedAuthenticationEvent} from '@product/core';
import {SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE} from './sun-automated-fetch';
export const PILOT_REPORT_VERSION='nexid.pilot-evidence.v1';
export const PILOT_ROW_LIMIT=100000;
export class PilotReportError extends Error{constructor(public code:string,public status=400){super(code);}}
const DAY=86400000;
export function pilotScope(principal:{scope:string;tenantSlug?:string|null;tenantId?:string|null},requested:unknown){
 const value=typeof requested==='string'?requested.trim().toLowerCase():'';
 if(value&&!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(value))throw new PilotReportError('pilot_tenant_invalid');
 if(principal.scope==='super_admin'){if(principal.tenantId||principal.tenantSlug)throw new PilotReportError('pilot_scope_invalid',403);if(!value)throw new PilotReportError('pilot_tenant_required');return value;}
 if(!principal.tenantId||!principal.tenantSlug)throw new PilotReportError('pilot_scope_invalid',403);
 if(value&&value!==principal.tenantSlug)throw new PilotReportError('pilot_tenant_forbidden',403);
 return principal.tenantSlug;
}
function day(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new PilotReportError('pilot_date_invalid');const ms=Date.parse(value+'T00:00:00Z');if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value)throw new PilotReportError('pilot_date_invalid');return ms;}
export function pilotWindow(from:string,to:string,now=Date.now()){
 const start=day(from),last=day(to),today=day(new Date(now).toISOString().slice(0,10));
 if(last<start||last-start>=93*DAY)throw new PilotReportError('pilot_window_1_to_93_days');
 if(last>today)throw new PilotReportError('pilot_future_window');
 return {from,to,start:new Date(start).toISOString(),endExclusive:new Date(last+DAY).toISOString(),days:1+(last-start)/DAY,timeZone:'UTC' as const};
}
export function pilotBid(value:unknown){if(value==null||value==='')return '';if(typeof value!=='string'||! /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value))throw new PilotReportError('pilot_bid_invalid');return value;}
export function canonicalReport(value:unknown):string{if(Array.isArray(value))return '['+value.map(canonicalReport).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalReport((value as any)[k])).join(',')+'}';return JSON.stringify(value);}
// Closed result candidates are filtered through the existing canonical authentication policy.
export const VERIFIED_RESULTS=['VALID','TAP_VALID','VALID_AUTHENTIC','VALID_CLOSED','OPENED','OPENED_PREVIOUSLY','VALID_OPENED','VALID_OPENED_PREVIOUSLY','VALID_UNKNOWN_TAMPER'].filter(result=>isVerifiedAuthenticationEvent({eventType:'TAP_VALID',verdict:'valid',result,cmacOk:true,allowlisted:true}));
export async function pilotOptions(tenant:string,isGlobal:boolean){
 const tenants=await sql`SELECT id::text,slug,name FROM tenants WHERE (${isGlobal} OR slug=${tenant}) ORDER BY name,id LIMIT 100`;
 const batches=tenant?await sql`SELECT b.id::text,b.bid,COALESCE(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}','') product FROM batches b JOIN tenants t ON t.id=b.tenant_id WHERE t.slug=${tenant} ORDER BY b.created_at DESC,b.id LIMIT 100`:[];
 return {ok:true,contract:PILOT_REPORT_VERSION,source:'database',tenantOptions:tenants,batchOptions:batches,limit:100};
}
export async function readPilotReport(tenant:string,bid:string,from:string,to:string){
 const window=pilotWindow(from,to);bid=pilotBid(bid);
 const rows=await sql`
 WITH target AS MATERIALIZED(SELECT id,slug,name FROM tenants WHERE slug=${tenant}),
 scoped_batches AS MATERIALIZED(SELECT b.id,b.bid,b.status FROM batches b JOIN target t ON t.id=b.tenant_id WHERE (${bid}='' OR b.bid=${bid}) LIMIT 10001),
 inventory AS MATERIALIZED(SELECT tag.id,tag.status,tag.batch_id FROM tags tag JOIN scoped_batches b ON b.id=tag.batch_id LIMIT 100001),
 candidates AS MATERIALIZED(SELECT e.id,e.batch_id,e.tag_id,e.created_at,e.event_type,e.verdict,e.result,e.cmac_ok,e.allowlisted,e.source,e.user_agent,e.meta#>>'{assurance,identity_registered}' identity_registered
 FROM events e JOIN target t ON t.id=e.tenant_id WHERE e.created_at>=${window.start}::timestamptz AND e.created_at<LEAST(${window.endExclusive}::timestamptz,statement_timestamp())
 AND (${bid}='' OR e.batch_id IN(SELECT id FROM scoped_batches)) LIMIT 100001),
 excluded AS (SELECT count(*)::int total,count(*) FILTER(WHERE source IS DISTINCT FROM 'real')::int non_real,
 count(*) FILTER(WHERE source='real' AND COALESCE(user_agent,'') ~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE})::int automated,
 count(*) FILTER(WHERE source='real' AND COALESCE(user_agent,'') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE} AND batch_id NOT IN(SELECT id FROM scoped_batches) OR source='real' AND batch_id IS NULL AND COALESCE(user_agent,'') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE})::int unbound FROM candidates),
 classified AS MATERIALIZED(SELECT e.created_at,e.batch_id,e.tag_id,upper(btrim(COALESCE(e.result,''))) result,
 upper(btrim(COALESCE(e.event_type,''))) IN('TAP_VALID','TAP_INVALID','REPLAY_SUSPECT') nfc,
 lower(btrim(COALESCE(e.verdict,'')))='valid' AND upper(btrim(COALESCE(e.event_type,'')))='TAP_VALID' AND upper(btrim(COALESCE(e.result,'')))=ANY(${VERIFIED_RESULTS}::text[]) AND e.cmac_ok IS TRUE AND e.allowlisted IS TRUE verified,
 upper(btrim(COALESCE(e.event_type,'')))='PROVENANCE_VIEWED' AND e.identity_registered='true' identity_view,
 lower(btrim(COALESCE(e.verdict,''))) IN('blocked_replay','replay_suspect') OR upper(btrim(COALESCE(e.result,''))) IN('DUPLICATE','REPLAY_SUSPECT','BLOCKED_REPLAY') replay
 FROM candidates e JOIN scoped_batches b ON b.id=e.batch_id WHERE e.source='real' AND COALESCE(e.user_agent,'') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE}),
 evidence AS(SELECT count(*)::int events,count(*) FILTER(WHERE nfc)::int nfc_attempts,count(*) FILTER(WHERE verified)::int verified,
 count(*) FILTER(WHERE identity_view)::int identity_views,count(*) FILTER(WHERE nfc AND replay)::int replay_signals,
 count(*) FILTER(WHERE verified AND result='VALID_CLOSED')::int seal_closed,
 count(*) FILTER(WHERE verified AND result IN('OPENED','OPENED_PREVIOUSLY','VALID_OPENED','VALID_OPENED_PREVIOUSLY'))::int seal_opened,
 count(*) FILTER(WHERE verified AND EXISTS(SELECT 1 FROM inventory i WHERE i.id::text=c.tag_id AND i.batch_id=c.batch_id))::int verified_linked,
 count(DISTINCT tag_id) FILTER(WHERE verified AND EXISTS(SELECT 1 FROM inventory i WHERE i.id::text=c.tag_id AND i.batch_id=c.batch_id))::int verified_units
 FROM classified c),
 daily AS(SELECT to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD') AS "day",count(*)::int events,count(*) FILTER(WHERE verified)::int verified,count(*) FILTER(WHERE identity_view)::int identity_views FROM classified GROUP BY 1 ORDER BY 1),
 incident_cohort AS MATERIALIZED(SELECT i.status,i.created_at,i.resolved_at FROM event_incidents i JOIN target t ON t.id=i.tenant_id
 JOIN events e ON e.id=i.event_id AND e.created_at=i.event_created_at AND e.tenant_id=i.tenant_id JOIN scoped_batches b ON b.id=e.batch_id
 WHERE i.created_at>=${window.start}::timestamptz AND i.created_at<LEAST(${window.endExclusive}::timestamptz,statement_timestamp()) AND e.source='real' AND COALESCE(e.user_agent,'') !~* ${SUN_AUTOMATED_FETCH_USER_AGENT_PATTERN_SOURCE} LIMIT 100001),
 incident_summary AS(SELECT count(*)::int total,count(*) FILTER(WHERE status='resolved')::int resolved,count(*) FILTER(WHERE status='dismissed')::int dismissed,
 count(*) FILTER(WHERE status IN('open','investigating','contained'))::int pending,
 count(*) FILTER(WHERE status='resolved' AND resolved_at>=created_at AND resolved_at<=statement_timestamp())::int timed_resolved,
 percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(resolved_at-created_at))) FILTER(WHERE status='resolved' AND resolved_at>=created_at AND resolved_at<=statement_timestamp()) median_seconds FROM incident_cohort),
 sdk AS MATERIALIZED(SELECT u.status_code,u.latency_ms FROM sdk_usage_logs u JOIN target t ON t.id=u.tenant_id WHERE ${bid}='' AND u.created_at>=${window.start}::timestamptz AND u.created_at<LEAST(${window.endExclusive}::timestamptz,statement_timestamp()) LIMIT 100001),
 sdk_summary AS(SELECT count(*)::int requests,count(*) FILTER(WHERE status_code BETWEEN 200 AND 299)::int success,count(*) FILTER(WHERE status_code BETWEEN 400 AND 499)::int client_errors,count(*) FILTER(WHERE status_code BETWEEN 500 AND 599)::int server_errors,
 count(*) FILTER(WHERE latency_ms>=0)::int latency_samples,percentile_cont(0.95) WITHIN GROUP(ORDER BY latency_ms) FILTER(WHERE latency_ms>=0) p95_ms FROM sdk)
 SELECT (SELECT id::text FROM target) tenant_id,(SELECT name FROM target) tenant_name,statement_timestamp() observed_at,LEAST(${window.endExclusive}::timestamptz,statement_timestamp()) effective_end,
 (SELECT count(*)::int FROM scoped_batches) batch_count,(SELECT count(*)::int FROM inventory) tag_count,
 (SELECT count(*)::int FROM inventory WHERE status::text='active') active_tags,(SELECT count(*)::int FROM inventory WHERE status::text='inactive') inactive_tags,
 (SELECT row_to_json(evidence) FROM evidence) evidence,(SELECT row_to_json(excluded) FROM excluded) excluded,(SELECT coalesce(jsonb_agg(daily),'[]'::jsonb) FROM daily) daily,
 (SELECT row_to_json(incident_summary) FROM incident_summary) incidents,(SELECT row_to_json(sdk_summary) FROM sdk_summary) sdk`;
 const r=rows[0] as any;if(!r?.tenant_id)throw new PilotReportError('pilot_tenant_not_found',404);
 if(bid&&r.batch_count!==1)throw new PilotReportError(r.batch_count?'pilot_batch_ambiguous':'pilot_batch_not_found',r.batch_count?409:404);
 if(r.batch_count>10000||r.tag_count>PILOT_ROW_LIMIT||r.excluded.total>PILOT_ROW_LIMIT||r.incidents.total>PILOT_ROW_LIMIT||r.sdk.requests>PILOT_ROW_LIMIT)throw new PilotReportError('pilot_range_exceeds_limit',422);
 const e=r.evidence,i=r.incidents,s=r.sdk;
 const days=[];for(let d=Date.parse(window.start);d<Date.parse(window.endExclusive);d+=DAY){const date=new Date(d).toISOString().slice(0,10);days.push(r.daily.find((x:any)=>x.day===date)||{day:date,events:0,verified:0,identity_views:0});}
 const report={schemaVersion:PILOT_REPORT_VERSION,reportId:randomUUID(),generatedAt:new Date(r.observed_at).toISOString(),source:'persisted_database_snapshot',scope:{tenantId:r.tenant_id,tenantSlug:tenant,tenantName:String(r.tenant_name),bid:bid||null},window:{...window,effectiveEnd:new Date(r.effective_end).toISOString()},
 inventory:{basis:'current_snapshot',batches:r.batch_count,registered:r.tag_count,active:r.active_tags,inactive:r.inactive_tags,other:r.tag_count-r.active_tags-r.inactive_tags},
 interactions:{basis:'period_persisted_real',events:e.events,nfcAttempts:e.nfc_attempts,verifiedNfc:e.verified,nfcUnconfirmed:e.nfc_attempts-e.verified,identityViews:e.identity_views,other:e.events-e.nfc_attempts-e.identity_views,replaySignals:e.replay_signals,sealClosed:e.seal_closed,sealOpened:e.seal_opened,sealUnknown:e.verified-e.seal_closed-e.seal_opened,verifiedLinked:e.verified_linked,verifiedUnits:e.verified_units},
 incidents:{basis:'created_in_period_current_state',created:i.total,resolved:i.resolved,dismissed:i.dismissed,pending:i.pending,other:i.total-i.resolved-i.dismissed-i.pending,timedResolved:i.timed_resolved,medianResolutionSeconds:i.median_seconds},
 sdk:bid?{basis:'not_attributed_to_batch',requests:null,success:null,clientErrors:null,serverErrors:null,other:null,latencySamples:null,p95Ms:null}:{basis:'period_logged_requests',requests:s.requests,success:s.success,clientErrors:s.client_errors,serverErrors:s.server_errors,other:s.requests-s.success-s.client_errors-s.server_errors,latencySamples:s.latency_samples,p95Ms:s.p95_ms},
 exclusions:{candidates:r.excluded.total,nonReal:r.excluded.non_real,automated:r.excluded.automated,unbound:r.excluded.unbound},daily:days,
 unavailable:['tap_uptime_before_persistence','historical_activation_count','sales_and_roi','person_identity_and_marketing_consent','document_usage_conversion','provider_invoice','completed_recall_workflow'],rowLimit:PILOT_ROW_LIMIT};
 return {ok:true,report,integrity:{algorithm:'SHA-256',digest:createHash('sha256').update(canonicalReport(report)).digest('hex'),meaning:'content_integrity_not_digital_signature'}};
}
