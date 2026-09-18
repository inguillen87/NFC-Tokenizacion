import {sql} from './db';
import {enterpriseCarrierContract} from './carrier-profiles';
import {normalizeGs1Identity,registerGs1Identity,Gs1RegistryError} from './gs1-digital-link-registry';
export const CHANNEL_VERSION='nexid.batch-channels.v1';
export class ChannelError extends Error{constructor(public code:string,public status=409){super(code);}}
export function gs1Path(v:{gtin:string;lot?:string;serial?:string}){const i=normalizeGs1Identity(v);return `/01/${i.gtin}${i.lot?`/10/${encodeURIComponent(i.lot)}`:''}${i.serial?`/21/${encodeURIComponent(i.serial)}`:''}`;}
export function channelProjection(row:Record<string,any>){
 const carrier=enterpriseCarrierContract(row.carrier);const mode=carrier?.supportsTamper?'tagtamper':carrier?.cryptographicAuthentication?'secure_nfc':row.carrier==='gs1_digital_link'?'gs1':row.carrier==='qr_basic'?'qr':'other';
 const ready=row.status==='active'&&row.tenant_status==='active'&&row.policy_enabled===true&&row.catalog_code===row.carrier;
 const url=mode==='qr'&&ready?'https://nexid.lat/sun?'+new URLSearchParams({qr:'1',channel:'qr',carrier:'qr_basic',tenant:row.tenant_slug,bid:row.bid}):null;
 return {contract:CHANNEL_VERSION,source:'database',observedAt:new Date().toISOString(),scope:{tenant:row.tenant_slug,bid:row.bid,batchId:row.id},product:String(row.product_name||''),batchStatus:row.status,carrier:{code:row.carrier||null,name:carrier?.displayName||'Perfil sin confirmar',mode,cryptographic:carrier?.cryptographicAuthentication===true,tamper:carrier?.supportsTamper===true},policyEnabled:row.policy_enabled===true,publicReady:ready,publicUrl:url,
 tt:mode==='tagtamper'?{enabled:row.tt_enabled===true||row.tamper_enabled===true,source:row.tt_source||row.tamper_source||null,length:row.tt_length??row.tamper_length??null,encoding:row.tt_encoding||null,closed:row.tt_closed||row.tamper_closed||[],opened:row.tt_opened||row.tamper_opened||[],invalid:row.tt_invalid||row.tamper_invalid||[],physicalState:'NOT_READ_BY_CONFIGURATION'}:null};
}
export async function readChannelBase(tenant:string,bid:string){
 const rows=await sql`SELECT b.id::text,b.bid,b.status::text,t.slug tenant_slug,t.status::text tenant_status,
 COALESCE(NULLIF(b.carrier_profile_code,''),b.sdm_config->>'carrier_profile_code') carrier,
 cp.code catalog_code,COALESCE(b.sdm_config->>'product_name',b.sdm_config#>>'{sun,product,name}') product_name,
 EXISTS(SELECT 1 FROM tenant_carrier_policies p WHERE p.tenant_id=b.tenant_id AND p.carrier_profile_code=cp.code AND p.enabled=true) policy_enabled,
 b.sdm_config->'ttstatus_enabled' tt_enabled,b.sdm_config->'tamper_status_enabled' tamper_enabled,
 b.sdm_config->>'ttstatus_source' tt_source,b.sdm_config->>'tamper_status_source' tamper_source,
 b.sdm_config->'ttstatus_length' tt_length,b.sdm_config->'tamper_status_length' tamper_length,
 b.sdm_config->>'ttstatus_plain_or_encrypted' tt_encoding,
 b.sdm_config->'ttstatus_closed_values' tt_closed,b.sdm_config->'tamper_closed_values' tamper_closed,
 b.sdm_config->'ttstatus_opened_values' tt_opened,b.sdm_config->'tamper_open_values' tamper_opened,
 b.sdm_config->'ttstatus_invalid_values' tt_invalid,b.sdm_config->'tamper_invalid_values' tamper_invalid
 FROM batches b JOIN tenants t ON t.id=b.tenant_id
 LEFT JOIN carrier_profiles cp ON cp.code=COALESCE(NULLIF(b.carrier_profile_code,''),b.sdm_config->>'carrier_profile_code')
 WHERE b.bid=${bid} AND (${tenant}='' OR t.slug=${tenant}) ORDER BY b.id LIMIT 2`;
 if(rows.length!==1)throw new ChannelError(rows.length?'channel_ambiguous_batch':'channel_batch_not_found',rows.length?409:404);
 return channelProjection(rows[0]);
}
export async function readBatchChannels(tenant:string,bid:string){
 const base=await readChannelBase(tenant,bid);let identities:any[]=[],prefixes:any[]=[];
 if(base.carrier.mode==='gs1'){
  identities=await sql`SELECT i.id::text,i.gtin,i.lot,i.serial,i.status,e.status entitlement_status,
   (i.tag_id IS NULL OR (tag.status='active' AND COALESCE(tag.lifecycle_state,'active')='active')) unit_active
   FROM gs1_digital_link_identities i LEFT JOIN gs1_gtin_prefix_entitlements e ON e.id=i.entitlement_id AND e.tenant_id=i.tenant_id
   LEFT JOIN tags tag ON tag.id=i.tag_id AND tag.batch_id=i.batch_id
   WHERE i.batch_id=${base.scope.batchId}::uuid ORDER BY i.created_at DESC,i.id LIMIT 101`;
  prefixes=await sql`SELECT e.canonical_gtin_prefix prefix FROM gs1_gtin_prefix_entitlements e JOIN tenants t ON t.id=e.tenant_id WHERE t.slug=${base.scope.tenant} AND e.status='active' ORDER BY e.canonical_gtin_prefix LIMIT 100`;
 }
 return {...base,identities:identities.slice(0,100).map(i=>({id:i.id,gtin:i.gtin,lot:i.lot,serial:i.serial,status:i.status,entitlementStatus:i.entitlement_status,ready:base.publicReady&&i.status==='active'&&i.entitlement_status==='active'&&i.unit_active===true,url:'https://nexid.lat'+gs1Path(i)})),moreIdentities:identities.length>100,prefixes:prefixes.map(p=>p.prefix)};
}
export async function registerBatchGs1(tenant:string,bid:string,actorId:string,raw:unknown){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ChannelError('channel_input_invalid',400);
 const body=raw as Record<string,unknown>;
 if(Object.keys(body).some(k=>!['gtin','lot','serial','displayName','reason'].includes(k)))throw new ChannelError('channel_field_not_allowed',400);
 const base=await readChannelBase(tenant,bid);
 if(base.carrier.mode!=='gs1')throw new ChannelError('channel_profile_mismatch',409);
 let result;try{result=await registerGs1Identity({tenantSlug:base.scope.tenant,bid:base.scope.bid,gtin:body.gtin,lot:body.lot,serial:body.serial,displayName:body.displayName,reason:body.reason,actorUserId:actorId});}catch(e){if(e instanceof Gs1RegistryError&&e.code==='gs1_batch_or_tag_not_found')throw new ChannelError('channel_registration_unconfirmed',503);throw e;}
 return {ok:true,scope:base.scope,identity:{id:result.identity.id,gtin:result.identity.gtin,lot:result.identity.lot,serial:result.identity.serial,status:result.identity.status},replayed:result.replayed,url:'https://nexid.lat'+gs1Path(result.identity)};
}
export async function batchQrDestination(tenant:string,bid:string,identityId:string){
 const source=await readBatchChannels(tenant,bid);
 if(source.carrier.mode==='qr'&&source.publicUrl&&!identityId)return {url:source.publicUrl,scope:source.scope};
 if(source.carrier.mode==='gs1'){const item=source.identities.find(i=>i.id===identityId);if(item?.ready)return {url:item.url,scope:source.scope};}
 throw new ChannelError('channel_qr_not_ready',409);
}
export function channelFailure(error:unknown){if(error instanceof ChannelError||error instanceof Gs1RegistryError)return {reason:error.code,status:error.status};if(error instanceof SyntaxError)return {reason:'channel_invalid_json',status:400};if(error instanceof Error&&error.name==='RequestBodyTooLargeError')return {reason:'channel_request_too_large',status:413};return {reason:'channel_source_unavailable',status:503};}
