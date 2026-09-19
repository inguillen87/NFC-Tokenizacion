import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createProductionFixture} from './gs1-production-local-fixture.mjs';
import {registerGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import {handleBatchTrace} from '../src/lib/batch-trace-http.ts';
export async function createTraceFixture(port=15721){
 const f=await createProductionFixture(port),tenant=f.tenant,other='10000000-0000-4000-8000-000000000002';
 await f.query('CREATE TABLE tenant_api_keys(id uuid PRIMARY KEY,tenant_id uuid);CREATE TABLE canonical_event_operations(id uuid PRIMARY KEY);CREATE TABLE events(id bigint,created_at timestamptz,PRIMARY KEY(id,created_at));');
 const migration=await readFile(new URL('../db/migrations/20260729110500_0069_gs1_epcis_foundation.sql',import.meta.url),'utf8');
 await f.query(migration.slice(migration.indexOf('CREATE TABLE IF NOT EXISTS epcis_capture_operations'),migration.indexOf('-- The following trigger checks')));
 await f.query('CREATE TABLE shipments(id uuid PRIMARY KEY,tenant_id uuid,shipment_code text,status text,created_at timestamptz,updated_at timestamptz);CREATE TABLE seal_inventory(id uuid PRIMARY KEY,tenant_id uuid,batch_id uuid,uid_hex text,status text);CREATE TABLE package_seals(id uuid PRIMARY KEY,shipment_id uuid,seal_id uuid,status text);');
 const main=(await f.query("SELECT id FROM batches WHERE bid='GS1-LOCAL'")).rows[0].id;
 const box=randomUUID(),pallet=randomUUID();
 await f.query("INSERT INTO batches(id,bid,tenant_id,status,carrier_profile_code,sdm_config) VALUES($1,'BOX-LOCAL',$3,'active','gs1_digital_link',$4),($2,'PALLET-LOCAL',$3,'active','gs1_digital_link',$4)",[box,pallet,tenant,{product_name:'Agrupación de prueba'}]);
 const definitions=[['unit','GS1-LOCAL','UNIT-001'],['box','BOX-LOCAL','BOX-001'],['pallet','PALLET-LOCAL','PALLET-001'],['output','GS1-LOCAL','UNIT-002']];const ids={},uris={};
 for(const [name,bid,serial] of definitions){const result=await registerGs1Identity({tenantSlug:'channels-qa',bid,gtin:'09506000134352',lot:'TRACE-QA',serial,actorUserId:f.actor,reason:'Synthetic trace fixture',metadata:{notForExport:'PRIVATE_METADATA_SENTINEL'}});ids[name]=result.identity.id;uris[name]='https://nexid.lat/01/09506000134352/10/TRACE-QA/21/'+serial;}
 const apiKey=randomUUID(),capture=randomUUID(),document=randomUUID();
 await f.query('INSERT INTO tenant_api_keys VALUES($1,$2)',[apiKey,tenant]);
 await f.query("INSERT INTO epcis_capture_operations(id,tenant_id,api_key_id,idempotency_key,request_fingerprint,event_count,canonical_projection_count) VALUES($1,$2,$3,'QA-TRACE',repeat('a',64),1,1)",[capture,tenant,apiKey]);
 await f.query("INSERT INTO epcis_documents(id,capture_operation_id,tenant_id,schema_version,document_type,document_json,captured_at) VALUES($1,$2,$3,'2.0','EPCISDocument','{}',now())",[document,capture,tenant]);
 let ordinal=0;const eventIds={};
 async function addEvent(name,type,action,fields,links,time='2026-09-18T12:00:00Z'){
  const id=randomUUID();eventIds[name]=id;ordinal++;
  const payload={type,eventTime:time,eventTimeZoneOffset:'-03:00',...fields,privateExtension:{value:'PRIVATE_EXTENSION_SENTINEL'},sensorElementList:[{private:'NOT_PROJECTED'}]};
  await f.query('INSERT INTO epcis_events(id,document_id,tenant_id,event_type,event_time,record_time,event_time_zone_offset,action,biz_step,disposition,read_point,biz_location,event_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[id,document,tenant,type,time,'2026-09-19T01:00:00Z','-03:00',action,'https://ref.gs1.org/cbv/BizStep-packing','https://ref.gs1.org/cbv/Disp-in_progress','urn:example:readpoint:qa','urn:example:warehouse:qa',JSON.stringify(payload)]);
  for(const key of links){const op=randomUUID(),number=ordinal*100+links.indexOf(key)+1;await f.query('INSERT INTO canonical_event_operations VALUES($1)',[op]);await f.query('INSERT INTO events VALUES($1,$2)',[number,time]);await f.query('INSERT INTO epcis_event_identifiers(epcis_event_id,tenant_id,gs1_identity_id,canonical_operation_id,canonical_event_id,canonical_event_created_at) VALUES($1,$2,$3,$4,$5,$6)',[id,tenant,ids[key],op,number,time]);}
  return id;
 }
 await addEvent('object','ObjectEvent','OBSERVE',{epcList:[uris.unit]},['unit'],'2026-09-18T09:00:00Z');
 await addEvent('aggregate','AggregationEvent','ADD',{parentID:uris.box,childEPCs:[uris.unit]},['box','unit'],'2026-09-18T10:00:00Z');
 await addEvent('pallet','AggregationEvent','ADD',{parentID:uris.pallet,childEPCs:[uris.box]},['pallet','box'],'2026-09-18T10:30:00Z');
 await addEvent('remove','AggregationEvent','DELETE',{parentID:uris.box,childEPCs:[uris.unit]},['box','unit'],'2026-09-18T11:00:00Z');
 await addEvent('transform','TransformationEvent',null,{inputEPCList:[uris.unit],outputEPCList:[uris.output]},['unit','output'],'2026-09-18T12:00:00Z');
 await addEvent('error','ObjectEvent','OBSERVE',{epcList:[uris.unit],errorDeclaration:{declarationTime:'2026-09-19T02:00:00Z',reason:'urn:example:error'}},['unit'],'2026-09-18T12:30:00Z');
 await addEvent('quantities','ObjectEvent','OBSERVE',{quantityList:[{epcClass:uris.unit,quantity:12,uom:'KGM'}]},['unit'],'2026-09-18T12:40:00Z');
 const shipment=randomUUID(),seal=randomUUID();
 await f.query("INSERT INTO shipments VALUES($1,$2,'SHIP-TRACE-QA','IN_TRANSIT',now(),now())",[shipment,tenant]);
 await f.query("INSERT INTO seal_inventory VALUES($1,$2,$3,'SYNTHETIC_UID_NEVER_EXPORT','ASSIGNED')",[seal,tenant,main]);
 await f.query("INSERT INTO package_seals VALUES($1,$2,$3,'ASSIGNED')",[randomUUID(),shipment,seal]);
 await f.query("INSERT INTO shipments VALUES($1,$2,'OTHER_TENANT_SHIPMENT','DRAFT',now(),now())",[randomUUID(),other]);
 const initial=JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows);
 function session(token){const role=token.replace('qa-trace-','');if(!['reader','viewer','denied','foreign','global'].includes(role))return null;const s=f.session(role==='global'?'qa-production-global':role==='foreign'?'qa-production-foreign':'qa-production-editor');return {...s,permissions:role==='global'?['*']:role==='viewer'?['batches:read']:['batches:read','logistics:read'],deniedPermissions:role==='denied'?['logistics:read']:[]};}
 async function request(bid='GS1-LOCAL',eventId='',role='reader',query='from=2026-09-18&to=2026-09-20',method='GET'){
  return handleBatchTrace(new Request('http://127.0.0.1:4311/admin/batches/'+bid+'/traceability'+(eventId?'/events/'+eventId:'')+'?'+query,{method,headers:{authorization:'Bearer qa-trace-'+role}}),bid,eventId||undefined,async token=>session(token));
 }
 return {...f,main,box,pallet,ids,uris,eventIds,shipment,addEvent,traceSession:session,request,unchanged:async()=>initial===JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows)};
}
