import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as model from '../src/app/me/experiences/experience-model.ts';
const require=createRequire(import.meta.url);
const valid=()=>({ok:true,items:[],verifiedExperiences:[]});
test('experience sources distinguish empty from absent, failed, malformed or duplicate collections',()=>{
 for(const key of ['items','verifiedExperiences'])for(const bad of [undefined,null,{},[null],['item'],[{}],[{id:''}],[{id:'same'},{id:'same'}]]){
  const result=model.buildExperienceModel({...valid(),[key]:bad});
  assert.equal(result[key==='items'?'offers':'reviews'].status,'unavailable');
  assert.equal(result[key==='items'?'reviews':'offers'].status,'ready');
 }
 for(const payload of [null,{},[],{ok:false,items:[],verifiedExperiences:[]}])assert.deepEqual(model.buildExperienceModel(payload),{offers:{status:'unavailable',items:null},reviews:{status:'unavailable',items:null}});
 assert.deepEqual(model.buildExperienceModel(valid()),{offers:{status:'ready',items:[]},reviews:{status:'ready',items:[]}});
});
test('real proposals use only reported identity and a safe tenant benefits destination without inferring authorization',()=>{
 const offer=model.buildExperienceModel({...valid(),items:[{id:'proposal-1',title:'Cata de ensayo',tenant_slug:'qa-brand',can_claim:true,points_cost:5}]}).offers.items[0];
 assert.deepEqual(offer,{id:'proposal-1',title:'Cata de ensayo',tenant:'qa-brand',href:'/me/rewards?tenant=qa-brand'});
 for(const tenant of ['//foreign','x?tenant=foreign','../brand',['valid'],null])assert.equal(model.buildExperienceModel({...valid(),items:[{id:'proposal-1',tenant_slug:tenant}]}).offers.items[0].href,null);
});
test('review moderation, visibility, stars and confidence are never synthesized from absent or invalid evidence',()=>{
 for(const rating of [null,'5',0,6,NaN,2.5])assert.equal(model.buildExperienceModel({...valid(),verifiedExperiences:[{id:'review-1',rating}]}).reviews.items[0].rating,null);
 for(const rating of [1,3,5])assert.equal(model.buildExperienceModel({...valid(),verifiedExperiences:[{id:'review-1',rating}]}).reviews.items[0].rating,rating);
 const missing=model.buildExperienceModel({...valid(),verifiedExperiences:[{id:'review-1',trust_score:100}]}).reviews.items[0];
 assert.equal(missing.moderation,'Estado no informado');assert.equal(missing.visibility,'Visibilidad no informada');assert.equal(missing.trust,null);
 for(const score of [-1,101,Infinity,'99'])assert.equal(model.buildExperienceModel({...valid(),verifiedExperiences:[{id:'review-1',trust_score_status:'computed',trust_score:score}]}).reviews.items[0].trust,null);
 const reported=model.buildExperienceModel({...valid(),verifiedExperiences:[{id:'review-1',moderation_status:'approved',visibility:'public',trust_score_status:'computed',trust_score:0,brand_response:'Gracias por tu comentario',verification_badges:['nfc_event_linked',null,{},'consumer_supplied_photo']}]}).reviews.items[0];
 assert.equal(reported.trust,0);assert.equal(reported.response,'Gracias por tu comentario');assert.equal(reported.moderation,'Aprobada por la marca');assert.deepEqual(reported.badges,['Lectura digital asociada','Foto aportada']);
 assert.equal(model.experienceModeration('private'),'Se mantiene privada');
});
test('continuation IDs retain exact PostgreSQL bigint references and reject ambiguous query values',()=>{
 for(const value of ['1','900001','9223372036854775807'])assert.equal(model.experienceEventId(value),value);
 for(const value of ['0','01','-1','9223372036854775808','1/2',['1','2'],1,null,''])assert.equal(model.experienceEventId(value),'');
});
function loadPage(payload,denied=false){
 const calls=[];
 const source=readFileSync(new URL('../src/app/me/experiences/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const overrides={
  '../_components/consumer-api':{buildConsumerNextPath:(path,params)=>path+'?'+new URLSearchParams(params),requireConsumerSession:async next=>{calls.push(['session',next]);if(denied)throw Error('denied');},fetchConsumerPath:async path=>{calls.push(['read',path]);return payload;}},
  '../_components/portal-shell':{PortalShell:({children})=>React.createElement('main',null,children)},
  '../_components/me-portal-interactive-client':{ConsumerDataRetryButton:()=>React.createElement('button',null,'Reintentar carga')},
  './verified-experience-form':{VerifiedExperienceForm:props=>React.createElement('form',{'data-event':props.initialEventId},props.initialProductName)},
  './experience-model':model,
  './experiences.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})},
  'next/link':{__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)},
 };
 const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>Object.hasOwn(overrides,name)?overrides[name]:require(name),loaded,loaded.exports);
 return {page:loaded.exports.default,calls};
}
test('experiences authenticates before reading and keeps the TAP continuation in the safe login return',async()=>{
 const {page,calls}=loadPage(valid());await page({searchParams:Promise.resolve({eventId:'900001',product:'QA',tenant:'qa-brand'})});
 assert.deepEqual(calls,[['session','/me/experiences?eventId=900001&product=QA&tenant=qa-brand'],['read','experiences']]);
 const denied=loadPage(valid(),true);await assert.rejects(()=>denied.page({}),/denied/);assert.equal(denied.calls.length,1);
});
test('a comment composer appears only with a canonical reference; generic entry points guide product selection',async()=>{
 for(const eventId of [undefined,'0','01',['1','2'],'9223372036854775808']){
  const html=renderToStaticMarkup(await loadPage(valid()).page({searchParams:Promise.resolve({eventId})}));assert.match(html,/Elegir un producto/);assert.doesNotMatch(html,/<form/);
 }
 const html=renderToStaticMarkup(await loadPage(valid()).page({searchParams:Promise.resolve({eventId:'900001',product:'Mi producto'})}));assert.match(html,/<form data-event="900001">Mi producto/);
});
test('a failed source displays retry without hiding the other source, and brand replies are escaped plain text',async()=>{
 const html=renderToStaticMarkup(await loadPage({ok:true,items:[{id:'offer-1',tenant_slug:'qa-brand',title:'Visita de ensayo'}],verifiedExperiences:null}).page({}));
 assert.match(html,/No pudimos cargar tus comentarios/);assert.match(html,/Reintentar carga/);assert.match(html,/Visita de ensayo/);assert.doesNotMatch(html,/Todavía no hay comentarios|Reservas y visitas|Historial de visitas/);
 const reply=renderToStaticMarkup(await loadPage({...valid(),verifiedExperiences:[{id:'review-1',rating:4,body:'Comentario de ensayo',brand_response:'<script>bad()</script>',moderation_status:'approved',visibility:'private'}]}).page({}));
 assert.match(reply,/Respuesta de la marca/);assert.match(reply,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.doesNotMatch(reply,/<script>|Trust Score|Trust 0|Reserva confirmada/);
});
