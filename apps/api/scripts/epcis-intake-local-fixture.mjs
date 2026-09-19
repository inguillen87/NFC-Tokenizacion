import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {createProductionFixture} from './gs1-production-local-fixture.mjs';
import {registerGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import {handleEpcisIntake} from '../src/lib/epcis-intake-http.ts';
export async function createIntakeFixture(port=15761,variant='canonical'){
 const f=await createProductionFixture(port),key=randomUUID();
 await f.query(`ALTER TABLE users ADD COLUMN admin_status text DEFAULT 'active';CREATE TABLE memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES users(id),tenant_id uuid REFERENCES tenants(id),role text);CREATE TABLE tenant_api_keys(id uuid PRIMARY KEY,tenant_id uuid,status text,expires_at timestamptz);
 CREATE TYPE tag_status AS ENUM('active','inactive');CREATE TYPE scan_source AS ENUM('imported');CREATE TYPE event_type AS ENUM('EPCIS_EVENT_CAPTURED');
 CREATE TABLE events(id bigserial,created_at timestamptz DEFAULT clock_timestamp(),tenant_id uuid,batch_id uuid,uid_hex text,cmac_ok boolean,allowlisted boolean,tag_status tag_status,result text,reason text,source scan_source,meta jsonb,tenant_slug text,tag_id uuid,bid text,event_type event_type,verdict text,risk_level text,geo_precision text,PRIMARY KEY(id,created_at));
 CREATE TABLE canonical_event_operations(id uuid PRIMARY KEY,tenant_id uuid,operation_key text,request_fingerprint text,event_name text,event_mode text,event_id bigint,event_created_at timestamptz);
 CREATE TABLE webhook_endpoints(id uuid PRIMARY KEY,tenant_id uuid,url text,events jsonb,enabled boolean,deleted_at timestamptz,updated_at timestamptz);
 CREATE TABLE webhook_deliveries(endpoint_id uuid,endpoint_url text,event_id text,event_name text,payload jsonb,status text,attempt_count int,next_attempt_at timestamptz,UNIQUE(endpoint_id,event_id));`);
 await f.query("INSERT INTO memberships(user_id,tenant_id,role) VALUES($1,$2,'tenant_admin')",[f.actor,f.tenant]);
 await f.query("INSERT INTO tenant_api_keys VALUES($1,$2,'active',NULL)",[key,f.tenant]);
 const old=await readFile(new URL('../db/migrations/20260729110500_0069_gs1_epcis_foundation.sql',import.meta.url),'utf8');
 await f.query(old.slice(old.indexOf('CREATE TABLE IF NOT EXISTS epcis_capture_operations')));
 const upgrade=await readFile(new URL(variant==='verified-delta'?'./apply-0111-verified-delta.sql':'../db/migrations/20260919200000_0111_epcis_operator_intake.sql',import.meta.url),'utf8');await f.query(upgrade);await f.query(upgrade);
 const identities=[];for(const serial of ['UNIT-001','CASE-001','UNIT-002']){const r=await registerGs1Identity({tenantSlug:'channels-qa',bid:'GS1-LOCAL',gtin:'09506000134352',lot:'QA-L',serial,actorUserId:f.actor,reason:'Local fixture only'});identities.push(r.identity);}
 const urls=identities.map(i=>'https://nexid.lat/01/'+i.gtin+'/10/'+i.lot+'/21/'+i.serial);
 const before=JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows)+JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows);
 function doc(name='external-1',type='ObjectEvent'){return {'@context':'https://ref.gs1.org/standards/epcis/epcis-context.jsonld',type:'EPCISDocument',schemaVersion:'2.0',id:'urn:qa:document:'+name,epcisBody:{eventList:[{type,eventID:'urn:qa:event:'+name,eventTime:'2026-09-19T14:00:00-03:00',eventTimeZoneOffset:'-03:00',action:type==='ObjectEvent'?'OBSERVE':'ADD',bizStep:'receiving',...(type==='ObjectEvent'?{epcList:[urls[0]]}:{parentID:urls[1],childEPCs:[urls[0]]})}]}};}
 function session(token){const who=token.replace('qa-intake-','');if(!['editor','reader','nomfa','denied','foreign','global'].includes(who))return null;const s=f.session(who==='foreign'?'qa-production-foreign':who==='global'?'qa-production-global':'qa-production-editor');return {...s,permissions:who==='reader'?['batches:read','logistics:read']:['batches:read','logistics:read','logistics:write'],deniedPermissions:who==='denied'?['sdk:epcis:write']:[],mfaVerified:who!=='nomfa'};}
 async function request(action,body=null,who='editor',tenant='channels-qa',bid='GS1-LOCAL'){const req=new Request('http://127.0.0.1:4371/admin/batches/'+bid+'/epcis-intake'+(action==='read'?'':'/'+action)+'?tenant='+tenant,{method:action==='read'?'GET':'POST',headers:{authorization:'Bearer qa-intake-'+who,'content-type':'application/json'},body:action==='read'?undefined:JSON.stringify(body)});return handleEpcisIntake(req,bid,action,{sessionResolver:async token=>session(token),limit:async()=>null});}
 return {...f,key,identities,urls,doc,intakeSession:session,request,unchanged:async()=>before===JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows)+JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows)};
}
