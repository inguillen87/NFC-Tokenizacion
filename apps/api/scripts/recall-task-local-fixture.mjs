import {readFile} from 'node:fs/promises';
import {createRecallFixture,T,B,E,R,V} from './recall-local-fixture.mjs';
import {handleAssignedRecall} from '../src/lib/recall-task-http.ts';
export {T,B,E,R,V};
export async function createTaskFixture(port=15623){
 const f=await createRecallFixture(port);
 await f.query(await readFile(new URL('../db/migrations/20260919000000_0109_recall_assignee_tasks.sql',import.meta.url),'utf8'));
 function session(token){
  const kind=String(token).replace('qa-task-','');
  if(kind==='manager')return f.session('qa-recall-editor');
  if(!['agent','viewer','unassigned','wrongtenant','denied'].includes(kind))return null;
  return {id:'task-session-'+kind,userId:kind==='unassigned'?E:V,email:'agent@example.invalid',label:'Responsable asignado QA',role:kind==='viewer'?'viewer':'packaging-operator',tenantId:kind==='wrongtenant'?'10000000-0000-4000-8000-000000000099':T,tenantSlug:kind==='wrongtenant'?'foreign-company':'recall-qa',permissions:kind==='viewer'?['recall_tasks:read']:['recall_tasks:read','recall_tasks:respond'],deniedPermissions:kind==='denied'?['recall_tasks:respond']:[],mfaVerified:false,isDemo:false,setupCompleted:true,expiresAt:new Date(Date.now()+3600000).toISOString(),rotatedCookieValue:null};
 }
 async function taskRequest(path='/admin/recall-tasks',who='agent',body=null){
  const u=new URL(path,'http://127.0.0.1:4263');const parts=u.pathname.split('/').filter(Boolean);const req=new Request(u,{method:body?'POST':'GET',headers:{authorization:'Bearer qa-task-'+who,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
  return handleAssignedRecall(req,parts[2],parts[3],parts[4],async token=>session(token));
 }
 return {...f,taskSession:session,taskRequest};
}
