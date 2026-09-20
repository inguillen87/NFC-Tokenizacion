import {randomUUID} from 'node:crypto';
import {createEditorialQueueFixture} from './editorial-queue-local-fixture.mjs';
import {publishedLibraryRequest} from '../src/lib/passport-library.ts';
export async function createLibraryFixture(port=16371){
 const f=await createEditorialQueueFixture(port);await f.query("ALTER TABLE batches ADD COLUMN status text NOT NULL DEFAULT 'active'");
 async function agro(bid,company='queue-qa',locale='es-AR'){
  const data={product_name:'Agro '+bid,public_lot_label:'LOT-'+bid,sku:'SKU-'+bid,winery:'Fábrica QA',region:'Mendoza QA',meta_setting:'TECHNICAL_SENTINEL',sun:{security:{sentinel:true}},agro_product_profile:{schemaVersion:'agro-dpp-v1',crop:'Maíz',productName:'Agro '+bid,brand:'Fábrica QA',sku:'SKU-'+bid,batchLot:'LOT-'+bid,gtin:'09506000134352',productionDate:'2026-01-02',expirationDate:'2027-01-02',technicalSheetUrl:'https://example.invalid/'+bid+'.pdf',distributor:'Distribuidor '+bid,authorizedChannel:'Canal '+bid,recallStatusUrl:'https://example.invalid/recall/'+bid,support:{email:'qa@example.invalid'}}};
  await f.query('INSERT INTO batches(id,tenant_id,bid,sdm_config) VALUES($1,$2,$3,$4)',[randomUUID(),company==='queue-qa'?f.tenant:f.foreign,bid,data]);
  await f.apply(bid,'start',f.actors.editor,{template:'agro',locale},company);
 }
 async function publish(bid,company='queue-qa') {await f.apply(bid,'submit',f.actors.editor,{},company);await f.apply(bid,'approve',f.actors.reviewer,{},company);await f.apply(bid,'publish',f.actors.publisher,{},company);}
 await agro('AGRO-TARGET');await agro('AGRO-SOURCE');await publish('AGRO-SOURCE');
 await agro('AGRO-EN','queue-qa','en');await publish('AGRO-EN');await agro('AGRO-FOREIGN','other-queue');await publish('AGRO-FOREIGN','other-queue');
 const request=(bid='AGRO-TARGET',params={},role='editor',method='GET')=>publishedLibraryRequest(new Request('http://127.0.0.1:4631/admin/batches/'+bid+'/passport-library?'+new URLSearchParams(params),{method,headers:{authorization:'Bearer queue-'+role}}),bid,async token=>f.session(token));
 return {...f,agro,publish,request};
}
