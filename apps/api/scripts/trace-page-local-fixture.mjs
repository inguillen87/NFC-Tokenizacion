import {randomUUID} from 'node:crypto';
import {createTraceFixture} from './batch-traceability-local-fixture.mjs';
import {handleTracePage} from '../src/lib/trace-page-http.ts';
export async function createTracePageFixture(port=15775){
 const f=await createTraceFixture(port);
 // Record time belongs to the local repository clock; event times are declared fixture values.
 await f.query("UPDATE epcis_events SET record_time=clock_timestamp()-interval '1 hour'");
 await f.query(`INSERT INTO epcis_events(tenant_id,event_type,event_time,record_time,action,biz_step,disposition,event_json)
 SELECT $1,'ObjectEvent','2026-09-18T12:00:00Z'::timestamptz + n*interval '1 microsecond',clock_timestamp()-interval '1 hour','OBSERVE','https://ref.gs1.org/cbv/BizStep-storing','https://ref.gs1.org/cbv/Disp-in_progress',$2::jsonb
 FROM generate_series(1,125) n`,[f.tenant,JSON.stringify({epcList:[f.url(f.unit)],private_payload:'DO_NOT_EXPORT'})]);
 await f.query('INSERT INTO epcis_event_identifiers(epcis_event_id,tenant_id,gs1_identity_id) SELECT id,tenant_id,$1 FROM epcis_events WHERE event_time>=$2 AND NOT EXISTS(SELECT 1 FROM epcis_event_identifiers x WHERE x.epcis_event_id=epcis_events.id)',[f.unit.id,'2026-09-18T12:00:00Z']);
 await f.query(`INSERT INTO custody_events(id,tenant_id,shipment_id,seal_id,event_type,created_at,notes)
 SELECT gen_random_uuid(),$1,$2,$3,'scanned','2026-09-18T12:00:00Z'::timestamptz+n*interval '1 microsecond','PRIVATE_NOTES' FROM generate_series(1,75) n`,[f.tenant,f.shipment,f.seal]);
 const sameId=randomUUID();
 await f.query("INSERT INTO epcis_events(id,tenant_id,event_type,event_time,record_time,action,event_json) VALUES($1,$2,'ObjectEvent','2026-09-18T12:00:01Z',clock_timestamp()-interval '1 hour','OBSERVE',$3)",[sameId,f.tenant,{epcList:[f.url(f.unit)]}]);
 await f.query('INSERT INTO epcis_event_identifiers VALUES($1,$2,$3)',[sameId,f.tenant,f.unit.id]);
 await f.query("INSERT INTO custody_events(id,tenant_id,shipment_id,seal_id,event_type,created_at) VALUES($1,$2,$3,$4,'scanned','2026-09-18T12:00:01Z')",[sameId,f.tenant,f.shipment,f.seal]);
 async function page(params={},who='editor',bid='GS1-LOCAL'){
  const q=new URLSearchParams({from:'2026-09-01',to:'2026-09-19',tenant:'channels-qa',...params});
  return handleTracePage(new Request('http://127.0.0.1:4375/admin/batches/'+bid+'/traceability/page?'+q,{headers:{authorization:'Bearer qa-trace-'+who}}),bid,async token=>f.session(token));
 }
 return {...f,page,sameId};
}
