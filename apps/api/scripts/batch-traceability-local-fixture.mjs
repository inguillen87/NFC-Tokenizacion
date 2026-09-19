// Real PostgreSQL and real read handler; event/session content is synthetic, never customer hardware evidence.
import {randomUUID} from 'node:crypto';
import {createProductionFixture} from './gs1-production-local-fixture.mjs';
import {registerGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import {gs1Path} from '../src/lib/batch-channel-service.ts';
import {handleBatchTraceability} from '../src/lib/batch-traceability-http.ts';
export async function createTraceFixture(port=15715){
 const f=await createProductionFixture(port);
 await f.query("ALTER TABLE tenants ADD COLUMN name text; UPDATE tenants SET name=slug");
 await f.query(`CREATE TABLE epcis_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id uuid NOT NULL,event_type text NOT NULL,event_time timestamptz NOT NULL,record_time timestamptz NOT NULL,action text,biz_step text,disposition text,read_point text,biz_location text,event_json jsonb NOT NULL);
 CREATE TABLE epcis_event_identifiers(epcis_event_id uuid,tenant_id uuid,gs1_identity_id uuid,PRIMARY KEY(epcis_event_id,gs1_identity_id));
 CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid,shipment_code text,status text,created_at timestamptz,updated_at timestamptz,origin_address text,destination_address text);
 CREATE TABLE seal_inventory(id uuid PRIMARY KEY,tenant_id uuid,batch_id uuid,uid_hex text,status text);
 CREATE TABLE package_seals(id uuid PRIMARY KEY,shipment_id uuid,seal_id uuid);
 CREATE TABLE custody_events(id uuid PRIMARY KEY,tenant_id uuid,shipment_id uuid,seal_id uuid,event_type text,location text,scanned_by text,notes text,created_at timestamptz);`);
 const batch=(await f.query("SELECT id::text FROM batches WHERE bid='GS1-LOCAL'")).rows[0].id;
 const pack=randomUUID();await f.query("INSERT INTO batches(id,bid,tenant_id,status,carrier_profile_code,sdm_config) VALUES($1,'PACK-LOCAL',$2,'active','gs1_digital_link',$3)",[pack,f.tenant,{product_name:'Agrupador de prueba',sku:'BOX-QA'}]);
 async function identity(bid,serial){return (await registerGs1Identity({tenantSlug:'channels-qa',bid,gtin:'09506000134352',lot:'QA-L1',serial,displayName:'Producto de prueba',actorUserId:f.actor,reason:'Registro local controlado para trazabilidad'})).identity;}
 const unit=await identity('GS1-LOCAL','UNIT-01'),unit2=await identity('GS1-LOCAL','UNIT-02'),parent=await identity('PACK-LOCAL','PACK-01'),output=await identity('PACK-LOCAL','OUT-01');
 const url=i=>'https://nexid.lat'+gs1Path(i);
 async function event(type,action,at,refs,extra={}){
  const id=randomUUID(),document={type,action,...extra};const tenantId=extra.__tenant||f.tenant;delete document.__tenant;
  await f.query('INSERT INTO epcis_events(id,tenant_id,event_type,event_time,record_time,action,biz_step,disposition,read_point,biz_location,event_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,tenantId,type,at,'2026-09-19T12:00:00Z',action,extra.bizStep||'https://ref.gs1.org/cbv/BizStep-packing','https://ref.gs1.org/cbv/Disp-in_progress','urn:epc:id:sgln:0614141.00001.0','urn:epc:id:sgln:0614141.00002.0',JSON.stringify(document)]);
  for(const ref of refs)await f.query('INSERT INTO epcis_event_identifiers VALUES($1,$2,$3)',[id,tenantId,ref.id]);return id;
 }
 const original=(await f.query('SELECT id::text,bid,carrier_profile_code,sdm_config FROM batches ORDER BY id')).rows;
 const ids=[];
 ids.push(await event('ObjectEvent','ADD','2026-09-01T08:00:00Z',[unit],{epcList:[url(unit)],bizStep:'https://ref.gs1.org/cbv/BizStep-commissioning',private_api_key:'SYNTHETIC_SHOULD_NOT_APPEAR'}));
 ids.push(await event('AggregationEvent','ADD','2026-09-02T08:00:00Z',[unit,parent],{parentID:url(parent),childEPCs:[url(unit)]}));
 ids.push(await event('AggregationEvent','OBSERVE','2026-09-03T08:00:00Z',[unit,parent],{parentID:url(parent),childEPCs:[url(unit)]}));
 ids.push(await event('AggregationEvent','DELETE','2026-09-04T08:00:00Z',[unit,parent],{parentID:url(parent),childEPCs:[url(unit)],errorDeclaration:{reason:'QA_ERROR'}}));
 ids.push(await event('TransformationEvent',null,'2026-09-05T08:00:00Z',[unit,output],{inputEPCList:[url(unit)],outputEPCList:[url(output)]}));
 ids.push(await event('ObjectEvent','OBSERVE','2026-09-06T08:00:00Z',[unit2],{quantityList:[{epcClass:url(unit2),quantity:2.5,uom:'KGM'}],bizStep:'https://ref.gs1.org/cbv/BizStep-shipping'}));
 ids.push(await event('ObjectEvent','OBSERVE','2026-09-07T08:00:00Z',[unit],{epcList:[url(unit)],bizStep:'https://ref.gs1.org/cbv/BizStep-receiving'}));
 const seal=randomUUID(),shipment=randomUUID(),custodyId=randomUUID();
 await f.query("INSERT INTO seal_inventory VALUES($1,$2,$3,'SYNTHETIC_UID_NOT_EXPORTABLE','SEALED')",[seal,f.tenant,batch]);
 await f.query("INSERT INTO shipments VALUES($1,$2,'SHIP-LOCAL-01','IN_TRANSIT','2026-08-01T12:00:00Z','2026-09-19T12:00:00Z','PRIVATE_ADDRESS_A','PRIVATE_ADDRESS_B')",[shipment,f.tenant]);
 await f.query('INSERT INTO package_seals VALUES($1,$2,$3)',[randomUUID(),shipment,seal]);
 await f.query("INSERT INTO custody_events VALUES($1,$2,$3,$4,'seal_applied','PRIVATE_POSITION','PRIVATE_OPERATOR','PRIVATE_NOTES','2026-09-08T08:00:00Z')",[custodyId,f.tenant,shipment,seal]);
 function session(token){const who=String(token).replace('qa-trace-','');const s=f.session('qa-production-'+(who==='reader'?'viewer':who==='operator'?'operator':who==='global'?'global':who==='foreign'?'foreign':'editor'));if(!s||!['editor','reader','operator','global','foreign','denied'].includes(who))return null;return {...s,permissions:who==='reader'?['batches:read']:[...s.permissions,'logistics:read'],deniedPermissions:who==='denied'?['batches:read']:[]};}
 async function request(params={},who='editor',bid='GS1-LOCAL'){
  const q=new URLSearchParams({from:'2026-09-01',to:'2026-09-19',tenant:'channels-qa',...params});
  return handleBatchTraceability(new Request('http://127.0.0.1:4315/admin/batches/'+bid+'/traceability?'+q,{headers:{authorization:'Bearer qa-trace-'+who}}),bid,async token=>session(token));
 }
 return {...f,batch,pack,unit,unit2,parent,output,url,ids,seal,shipment,custodyId,original,event,session,request};
}
