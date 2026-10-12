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
function loadPage(payload,denied=false,brandsPayload={ok:true,items:[]},sessionStatus='ready',readingPayload=null){
 const calls=[];
 const source=readFileSync(new URL('../src/app/me/experiences/page.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const overrides={
  '../_components/consumer-api':{buildConsumerNextPath:(path,params)=>path+'?'+new URLSearchParams(params),readConsumerSession:async next=>{calls.push(['session',next]);if(denied)throw Error('denied');return {status:sessionStatus};},fetchConsumerPath:async path=>{calls.push(['read',path]);return path==='brands'?brandsPayload:path.startsWith('taps/')?readingPayload:payload;}},
  '../_components/consumer-portal-recovery':{ConsumerPortalUnavailable:()=>React.createElement('section',{role:'status'},'Cuenta no disponible')},
  '../_components/portal-shell':{PortalShell:({children})=>React.createElement('main',null,children)},
  '../_components/me-portal-interactive-client':{ConsumerDataRetryButton:()=>React.createElement('button',null,'Reintentar carga')},
  './verified-experience-form':{VerifiedExperienceForm:props=>React.createElement('form',{'data-event':props.initialEventId},props.initialProductName||'Producto por confirmar',React.createElement('span',null,props.brandName?'Marca: '+props.brandName:'Marca por confirmar'))},
  './experience-model':model,
  './experiences.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})},
  'next/link':{__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)},
 };
 const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>Object.hasOwn(overrides,name)?overrides[name]:require(name),loaded,loaded.exports);
 return {page:loaded.exports.default,calls};
}
test('experiences authenticates before reading and keeps the TAP continuation in the safe login return',async()=>{
 const {page,calls}=loadPage(valid());await page({searchParams:Promise.resolve({eventId:'900001',product:'QA',tenant:'qa-brand'})});
 assert.deepEqual(calls,[['session','/me/experiences?eventId=900001&product=QA&tenant=qa-brand'],['read','experiences'],['read','brands'],['read','taps/900001']]);
 const denied=loadPage(valid(),true);await assert.rejects(()=>denied.page({}),/denied/);assert.equal(denied.calls.length,1);
});
test('a comment composer appears only with a canonical reference; generic entry points guide product selection',async()=>{
 for(const eventId of [undefined,'0','01',['1','2'],'9223372036854775808']){
  const html=renderToStaticMarkup(await loadPage(valid()).page({searchParams:Promise.resolve({eventId})}));assert.match(html,/Elegir un producto/);assert.doesNotMatch(html,/<form/);
 }
 const html=renderToStaticMarkup(await loadPage(valid()).page({searchParams:Promise.resolve({eventId:'900001',product:'Mi producto'})}));assert.match(html,/<form data-event="900001">Producto por confirmar/);assert.doesNotMatch(html,/Mi producto/);
});
test('a failed source displays retry without hiding the other source, and brand replies are escaped plain text',async()=>{
 const html=renderToStaticMarkup(await loadPage({ok:true,items:[{id:'offer-1',tenant_slug:'qa-brand',title:'Visita de ensayo'}],verifiedExperiences:null}).page({}));
 assert.match(html,/No pudimos cargar tus comentarios/);assert.match(html,/Reintentar carga/);assert.match(html,/Visita de ensayo/);assert.doesNotMatch(html,/Todavía no hay comentarios|Reservas y visitas|Historial de visitas/);
 const reply=renderToStaticMarkup(await loadPage({...valid(),verifiedExperiences:[{id:'review-1',rating:4,body:'Comentario de ensayo',brand_response:'<script>bad()</script>',moderation_status:'approved',visibility:'private'}]}).page({}));
 assert.match(reply,/Respuesta de la marca/);assert.match(reply,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);assert.doesNotMatch(reply,/<script>|Trust Score|Trust 0|Reserva confirmada/);
});

test('experience cards and the composer use only a uniquely reported name for each exact brand scope',async()=>{
 const payload={...valid(),items:[{id:'offer-1',tenant_slug:'demobodega',title:'Visita de ensayo'}],verifiedExperiences:[{id:'review-1',tenant_slug:'other-brand',product_name:'Otro producto',body:'Comentario de ensayo'}]};
 const brands={ok:true,items:[{slug:'demobodega',name:'Empresa informada de ensayo'},{slug:'other-brand',name:'Otra empresa <strong>de ensayo</strong>'}]};
 const {page,calls}=loadPage(payload,false,brands,'ready',{ok:true,item:{tap_event_id:'900001',tenant_slug:'demobodega',product_name:'Mi producto'}});
 const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({eventId:'900001',tenant:'demobodega',product:'Mi producto'})}));
 assert.match(html,/<span class="brand">Empresa informada de ensayo<\/span>/);
 assert.match(html,/<span class="brand">Otra empresa &lt;strong&gt;de ensayo&lt;\/strong&gt;<\/span>/);
 assert.match(html,/Marca: Empresa informada de ensayo/);assert.match(html,/href="\/me\/rewards\?tenant=demobodega"/);assert.match(html,/href="\/me\/marketplace\?tenant=demobodega"/);
 assert.doesNotMatch(html,/<span class="brand">(?:demobodega|other-brand)<\/span>|<strong>de ensayo<\/strong>/);
 assert.deepEqual(calls.map(call=>call[0]),['session','read','read','read']);assert.deepEqual(calls.slice(1),[['read','experiences'],['read','brands'],['read','taps/900001']]);
});
test('unavailable, malformed, unmatched or duplicate brand names keep experience content and scoped destinations visible',async()=>{
 const payload={...valid(),items:[{id:'offer-1',tenant_slug:'demobodega',title:'Visita conservada'}],verifiedExperiences:[{id:'review-1',tenant_slug:'demobodega',body:'Comentario conservado'}]};
 const unavailable=[null,[],{ok:false,items:[]},{ok:true,items:null},{ok:true,items:[null]},{ok:true,items:[{}]},{ok:true,items:[{slug:'other-brand',name:'Nombre de otra marca'}]}];
 const invalidNames=[undefined,null,'',' ',{},['Empresa']].map(name=>({ok:true,items:[{slug:'demobodega',name}]}));
 const ambiguous=[{ok:true,items:[{slug:'demobodega',name:'Primera'},{slug:'demobodega',name:'Segunda'}]},{ok:true,items:[{slug:'demobodega',name:'Igual'},{slug:'demobodega',name:'Igual'}]},{ok:true,items:[{slug:'DemoBodega',name:'Otra capitalización'}]}];
 for(const brands of [...unavailable,...invalidNames,...ambiguous]){
  const html=renderToStaticMarkup(await loadPage(payload,false,brands,'ready',{ok:true,item:{tap_event_id:'900001',tenant_slug:'demobodega'}}).page({searchParams:Promise.resolve({eventId:'900001',tenant:'demobodega'})}));
  assert.equal((html.match(/<span class="brand">Marca no informada<\/span>/g)||[]).length,2);
  assert.match(html,/Visita conservada/);assert.match(html,/Comentario conservado/);assert.match(html,/href="\/me\/rewards\?tenant=demobodega"/);
  assert.doesNotMatch(html,/Marca: demobodega|<span class="brand">demobodega<\/span>|Nombre de otra marca|Primera|Segunda|Otra capitalización/);
 }
});
test('a recoverable session lookup does not start either private brand or experience read',async()=>{
 const {page,calls}=loadPage(valid(),false,{ok:true,items:[{slug:'demobodega',name:'Empresa de ensayo'}]},'unavailable');
 const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({tenant:'demobodega'})}));
 assert.match(html,/Cuenta no disponible/);assert.deepEqual(calls,[['session','/me/experiences?tenant=demobodega']]);
});
function loadComposer(){
 const source=readFileSync(new URL('../src/app/me/experiences/verified-experience-form.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const calls=[];const overrides={
  '../../../lib/consumer-request':{requestConsumerJson:async()=>{calls.push('request');throw Error('SSR must not submit');}},
  './verified-experience-form.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})},
 };
 const loaded={exports:{}};new Function('require','module','exports',compiled)(name=>Object.hasOwn(overrides,name)?overrides[name]:require(name),loaded,loaded.exports);
 return {Component:loaded.exports.VerifiedExperienceForm,calls};
}
test('the actual composer renders the reported name as text and never turns a tenant slug into a name or submits on SSR',()=>{
 const {Component,calls}=loadComposer();
 const named=renderToStaticMarkup(React.createElement(Component,{initialEventId:'900001',initialProductName:'Mi producto',tenant:'demobodega',brandName:'Empresa <strong>de ensayo</strong>'}));
 assert.match(named,/Marca: Empresa &lt;strong&gt;de ensayo&lt;\/strong&gt;/);assert.doesNotMatch(named,/<strong>de ensayo<\/strong>|Marca: demobodega/);
 const missing=renderToStaticMarkup(React.createElement(Component,{initialEventId:'900001',initialProductName:'Mi producto',tenant:'demobodega'}));
 assert.match(missing,/Marca por confirmar/);assert.doesNotMatch(missing,/demobodega|Club de marca/);assert.deepEqual(calls,[]);
});

function composerContext(html){const match=html.match(/<form data-event="900001">([\s\S]*?)<\/form>/);assert.ok(match);return match[1];}
function explorationLinks(html){const match=html.match(/<nav[^>]*aria-label="Seguir explorando"[^>]*>([\s\S]*?)<\/nav>/);assert.ok(match);return match[1];}
test('a composer for event A ignores URL brand B and product B without hiding independent B cards',async()=>{
 const payload={...valid(),items:[{id:'offer-b',tenant_slug:'brand-b',title:'Propuesta B'}]};
 const brands={ok:true,items:[{slug:'brand-a',name:'Empresa A de Marcas'},{slug:'brand-b',name:'Empresa B'}]};
 for(const tenantName of ['Empresa A de la lectura',undefined]){
  const detail={ok:true,item:{tap_event_id:'900001',tenant_slug:'brand-a',tenant_name:tenantName,product_name:'Producto A guardado'}};
  const {page,calls}=loadPage(payload,false,brands,'ready',detail);
  const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({eventId:'900001',tenant:'brand-b',product:'Producto B de URL'})}));
  const form=composerContext(html),links=explorationLinks(html);
  assert.match(form,/Producto A guardado/);assert.match(form,tenantName?/Marca: Empresa A de la lectura/:/Marca: Empresa A de Marcas/);
  assert.doesNotMatch(form,/Empresa B|Producto B de URL/);assert.match(html,/Propuesta B/);assert.match(html,/<span class="brand">Empresa B<\/span>/);
  assert.match(links,/href="\/me\/marketplace\?tenant=brand-a"/);assert.match(links,/href="\/me\/rewards\?tenant=brand-a"/);assert.doesNotMatch(links,/tenant=brand-b/);
  assert.equal(calls.filter(call=>call[0]==='read'&&call[1]==='taps/900001').length,1);
 }
});
test('an unavailable or mismatched private reading never turns URL identity into composer context',async()=>{
 const brands={ok:true,items:[{slug:'brand-b',name:'Empresa B'}]};
 const unavailable=[null,{ok:false,error:'tap_not_found'},{ok:false,error:'unauthorized'},{ok:false,error:'unavailable'},{ok:true,item:null},{ok:true,item:[]},{ok:true,item:'reading'},{ok:true,item:{tap_event_id:'900002',tenant_slug:'brand-a',tenant_name:'Otra lectura',product_name:'Otro producto'}}];
 const invalidScope=[undefined,null,'',{},['brand-a']].map(tenant_slug=>({ok:true,item:{tap_event_id:'900001',tenant_slug,tenant_name:'Empresa inválida',product_name:'Producto inválido'}}));
 for(const detail of [...unavailable,...invalidScope]){
  const html=renderToStaticMarkup(await loadPage(valid(),false,brands,'ready',detail).page({searchParams:Promise.resolve({eventId:'900001',tenant:'brand-b',product:'Producto B de URL'})}));
  const form=composerContext(html),links=explorationLinks(html);
  assert.match(form,/Producto por confirmar/);assert.match(form,/Marca por confirmar/);assert.doesNotMatch(form,/Empresa B|Producto B de URL|Otra lectura|Otro producto|Empresa inválida|Producto inválido/);
  assert.match(html,/role="status">No pudimos consultar esta lectura en tu cuenta/);assert.doesNotMatch(html,/lectura no guardada|TAP no guardado/);
  assert.match(links,/href="\/me\/marketplace"/);assert.match(links,/href="\/me\/rewards"/);assert.doesNotMatch(links,/tenant=/);
 }
});
test('missing reading names remain unreported instead of falling back to URL product or another company',async()=>{
 for(const invalidName of [undefined,null,{},['name'],'']){
  const detail={ok:true,item:{tap_event_id:'900001',tenant_slug:'brand-a',tenant_name:invalidName,product_name:invalidName}};
  const html=renderToStaticMarkup(await loadPage(valid(),false,{ok:true,items:[{slug:'brand-b',name:'Empresa B'}]},'ready',detail).page({searchParams:Promise.resolve({eventId:'900001',tenant:'brand-b',product:'Producto B de URL'})}));
  const form=composerContext(html);assert.match(form,/Producto no informado en esta lectura/);assert.match(form,/Marca por confirmar/);assert.doesNotMatch(form,/Empresa B|Producto B de URL|\[object Object\]/);
  assert.doesNotMatch(html,/No pudimos consultar esta lectura en tu cuenta/);
 }
});
test('private reading lookup requires a ready session and canonical event, while generic entry keeps the requested filter',async()=>{
 for(const eventId of [undefined,'0','01',['900001'],'9223372036854775808']){
  const {page,calls}=loadPage(valid());const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({eventId,tenant:'brand-b'})}));
  assert.equal(calls.filter(call=>call[0]==='read'&&call[1].startsWith('taps/')).length,0);assert.doesNotMatch(html,/<form/);assert.match(explorationLinks(html),/tenant=brand-b/);
 }
 const unavailable=loadPage(valid(),false,{ok:true,items:[]},'unavailable');await unavailable.page({searchParams:Promise.resolve({eventId:'900001'})});assert.equal(unavailable.calls.length,1);
 const denied=loadPage(valid(),true);await assert.rejects(()=>denied.page({searchParams:Promise.resolve({eventId:'900001'})}),/denied/);assert.equal(denied.calls.length,1);
});
