import {randomUUID} from 'node:crypto';
import {createIntakeFixture} from './epcis-intake-local-fixture.mjs';
import {registerGs1Identity} from '../src/lib/gs1-digital-link-registry.ts';
import {handleEpcisIntake} from '../src/lib/epcis-intake-http.ts';
export async function createRelationFixture(port=15821){
 const f=await createIntakeFixture(port),boxBatch=randomUUID(),palletBatch=randomUUID();
 await f.query("INSERT INTO batches(id,bid,tenant_id,status,carrier_profile_code,sdm_config) VALUES($1,'BOXES-LOCAL',$3,'active','gs1_digital_link',$4),($2,'PALLETS-LOCAL',$3,'active','gs1_digital_link',$4)",[boxBatch,palletBatch,f.tenant,{product_name:'Contenedor de prueba local',technicalSentinel:'MUST_REMAIN_UNCHANGED'}]);
 const one=async(bid,serial)=>{
  const r=await registerGs1Identity({tenantSlug:'channels-qa',bid,gtin:'09506000134352',lot:'QA-L',serial,actorUserId:f.actor,reason:'Local integration fixture'});
  return {...r.identity,batchId:bid==='GS1-LOCAL'?f.batchId:bid==='BOXES-LOCAL'?boxBatch:palletBatch,product:bid};
 };
 const mainBatch=(await f.query("SELECT id FROM batches WHERE bid='GS1-LOCAL'")).rows[0].id;
 const unit={...f.identities[0],bid:'GS1-LOCAL',batchId:mainBatch,product:'Unidad QA'},unit2={...f.identities[2],bid:'GS1-LOCAL',batchId:mainBatch,product:'Unidad QA'};
 const box=await one('BOXES-LOCAL','BOX-001'),pallet=await one('PALLETS-LOCAL','PALLET-001');
 const noSerial=await one('GS1-LOCAL','');
 // Enough declared serialized identities to prove continuation. These are not production labels.
 for(let i=0;i<52;i++)await one('GS1-LOCAL','SEARCH-'+String(i).padStart(3,'0'));
 const scope={tenant:'channels-qa',tenantId:f.tenant,batchId:mainBatch,bid:'GS1-LOCAL',product:'QA',carrier:'gs1_digital_link'};
 const original=JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows)+JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows);
 async function search(params={},who='editor',bid='GS1-LOCAL',method='GET'){
  const q=new URLSearchParams({tenant:'channels-qa',...params});
  return handleEpcisIntake(new Request('http://127.0.0.1:4421/admin/batches/'+bid+'/epcis-intake/identities?'+q,{method,headers:{authorization:'Bearer qa-intake-'+who}}),bid,'identities',{sessionResolver:async t=>f.intakeSession(t),limit:async()=>null});
 }
 return {...f,unit,unit2,box,pallet,noSerial,scope,search,unchanged:async()=>original===JSON.stringify((await f.query('SELECT bid,sdm_config,status FROM batches ORDER BY bid')).rows)+JSON.stringify((await f.query('SELECT * FROM tags ORDER BY id')).rows)};
}
