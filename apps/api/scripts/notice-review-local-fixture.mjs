import {readFile} from 'node:fs/promises';
import {createRecallFixture,T,B,E,R,V} from './recall-local-fixture.mjs';
import {handleNoticeReview} from '../src/lib/recall-notice-http.ts';
import {publicNoticesV2} from '../src/lib/recall-notice-service.ts';
export {T,B,E,R,V};
export async function createNoticeFixture(port=15597){
 const f=await createRecallFixture(port);

 async function noticeRequest(caseId,action,body,who='editor',query='tenant=recall-qa',override){
  const req=new Request(`http://127.0.0.1:4297/admin/batches/LOT-RECALL-QA/notice-reviews/${caseId}${action?'/'+action:''}?${query}`,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-recall-'+who,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  return handleNoticeReview(req,'LOT-RECALL-QA',caseId,action,async token=>{const s=f.session(token);return s&&override?{...s,...override}:s;});
 }
 return {...f,noticeRequest,publicV2:()=>publicNoticesV2('recall-qa','LOT-RECALL-QA')};
}
