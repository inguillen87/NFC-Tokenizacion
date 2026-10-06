// Synthetic actual-component QA. Local loopback only; no credentials, app sessions, providers or database.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

const root=resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const out=join(root,'artifacts/engagement-governance',`configuration-browser-${Date.now()}`);
const runtime=process.env.NEXID_QA_PLAYWRIGHT;
const chrome=process.env.NEXID_QA_CHROME;
const axePath=process.env.NEXID_QA_AXE;
const apiSource=process.env.NEXID_QA_CONFIGURATION_PARSER;
assert(runtime&&chrome&&axePath&&apiSource,'Explicit local QA dependencies and current API parser paths are required');
const {chromium}=await import(pathToFileURL(runtime).href);
const {parseConfigurationWrite}=await import(pathToFileURL(apiSource).href);
const require=createRequire(join(root,'package.json'));
const esbuild=require('esbuild');
const paths=['apps/dashboard/src/lib/loyalty-configuration.ts','apps/dashboard/src/components/loyalty-configuration-workspace.tsx','apps/dashboard/src/components/loyalty-configuration-workspace.module.css','apps/dashboard/src/app/(app)/loyalty/configuration/page.tsx','apps/dashboard/src/lib/permission-policy.ts','apps/dashboard/src/app/(app)/loyalty/page.tsx','apps/dashboard/src/app/(app)/loyalty/overview/page.tsx'];
const pins=async()=>Object.fromEntries(await Promise.all(paths.map(async path=>[path,createHash('sha256').update(await readFile(join(root,path))).digest('hex')])));
const sourceHashes=await pins();
const apiParserHash=createHash('sha256').update(await readFile(apiSource)).digest('hex');
await mkdir(out,{recursive:true});
const id='10000000-0000-4000-8000-000000000001',qid='20000000-0000-4000-8000-000000000001',legacyId='20000000-0000-4000-8000-000000000002';
const revision='2026-10-05 12:34:56.123456+00';
const base={ok:true,tenant:'qa-tenant',profile:{revision,lastOperationId:null,status:'draft',allowedActions:[]},programs:[{id,revision,lastOperationId:null,name:'Club sintético QA',vertical:'wine',status:'paused',pointsName:'Puntos QA',pointsPerValidTap:0,cooldownSeconds:0,startAt:'2026-01-01T12:34:56.123Z',endAt:null}],quizzes:[{id:qid,revision,lastOperationId:null,programId:id,title:'Trivia sintética QA',description:'Contenido exclusivo de QA.',vertical:'wine',status:'draft',startsAt:'2026-01-01T00:00:00.000Z',endsAt:null,questions:[{id:'qa-question',prompt:'¿Qué respuesta configuró la marca?',options:['Primera opción','Segunda opción'],correctIndex:1,explanation:'Explicación sintética.'}],pointsPerCorrect:0,completionBonus:0,passThreshold:0,managed:true},{id:legacyId,revision,lastOperationId:null,programId:id,title:'Trivia específica anterior QA',description:'Legacy QA',vertical:'wine',status:'active',startsAt:'2026-01-01T00:00:00.000Z',endsAt:null,questions:[],pointsPerCorrect:0,completionBonus:0,passThreshold:0,managed:false}]};
await writeFile(join(out,'fixture.tsx'),`import React from 'react';import{createRoot}from'react-dom/client';import Workspace from '../../../apps/dashboard/src/components/loyalty-configuration-workspace';const p=(window as any).qaProps;createRoot(document.getElementById('root')!).render(<div className="dashboard-shell-root" style={{padding:12,minHeight:'100vh'}}><p style={{marginBottom:16}}>QA sintética · componente real · sin escrituras de clientes</p><Workspace {...p}/></div>);`);
await esbuild.build({entryPoints:[join(out,'fixture.tsx')],outfile:join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
await promisify(execFile)(process.execPath,[join(root,'node_modules/tailwindcss/lib/cli.js'),'-i',join(root,'apps/dashboard/src/app/globals.css'),'-c',join(root,'apps/dashboard/tailwind.config.ts'),'-o',join(out,'base.css')],{cwd:join(root,'apps/dashboard'),env,windowsHide:true});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){
  const mode=url.searchParams.get('mode');
  const truncated={...base,limits:{programs:100,quizzes:300,programsTruncated:true,quizzesTruncated:true},quizzes:[{...base.quizzes[0],programId:'30000000-0000-4000-8000-000000000001'},{...base.quizzes[1],questions:Array.from({length:13},(_,i)=>({id:'legacy-'+i,prompt:'Pregunta anterior '+(i+1),options:Array.from({length:8},(_,j)=>'Opción '+(j+1)),correctIndex:1,explanation:''}))}]};
  const props={tenant:mode==='global'?'':'qa-tenant',canWrite:!['readonly','demo','global'].includes(mode),canSelectTenant:mode==='global',initialData:mode==='global'||mode==='unavailable'||mode==='demo'?null:mode==='truncated'?truncated:base,initialReason:mode==='unavailable'?'configuration_profile_required':'',isDemo:mode==='demo'};
  res.setHeader('content-type','text/html');res.end(`<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Configuración QA sintética</title><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script>window.qaProps=${JSON.stringify(props)}</script><script src="/bundle.js"></script></body></html>`);
 }else if(['/bundle.js','/bundle.css','/base.css'].includes(url.pathname)){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(join(out,url.pathname.slice(1))));}
 else{res.writeHead(404);res.end();}
}catch{res.writeHead(500);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:chrome});
const records=[],errors=[],consoleErrors=[],requests=[];let checks=0;
const check=(value,label)=>{assert(value,label);checks++;};
async function snapshot(page,width,theme,state){
 await page.addScriptTag({path:axePath});
 const axe=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}));
 const layout=await page.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,overflow:[...document.querySelectorAll('input,textarea,select,button,fieldset')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left < -1 || r.right>innerWidth+1);}).map(el=>({tag:el.tagName,text:el.textContent?.slice(0,100)}))}));
 const path=join(out,`${width}-${theme}-${state}.png`);await page.screenshot({path,fullPage:true});
 check(axe.violations.length===0,`${width}/${theme}/${state}: axe violations ${JSON.stringify(axe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))}`);
 check(layout.documentWidth<=width&&layout.overflow.length===0,`${width}/${theme}/${state}: overflow`);
 records.push({width,theme,state,screenshot:path,layout,axeViolations:axe.violations,incomplete:axe.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
}
try{
 for(const width of[320,390,768,1280])for(const theme of['light','dark']){
  const context=await browser.newContext({viewport:{width,height:920},colorScheme:theme,locale:'es-AR'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push({text:m.text(),url:m.location().url});});
  let data=structuredClone(base),sequence=0,abortAfterCommit=false,abortBeforeCommit=false,forcedConflict=false,delay=false;
  const history=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());check(url.origin===origin,'no external requests');
   if(url.pathname!=='/api/admin/loyalty/configuration') {check(request.method()==='GET','no unexpected mutation');return route.continue();}
   check(url.searchParams.get('tenant')==='qa-tenant','exact canonical fixture tenant');
   if(request.method()==='GET')return route.fulfill({json:data});
   check(request.method()==='POST','only supported write');
   const raw=request.postDataJSON();let parsed;try{parsed=parseConfigurationWrite(raw);}catch(e){throw new Error('Actual API parser rejected UI command: '+JSON.stringify({kind:raw.kind,action:raw.action,reason:e.message}));}
   history.push(structuredClone(raw));requests.push({width,theme,kind:raw.kind,action:raw.action,operationId:raw.operationId,id:raw.id||null});
   if(abortBeforeCommit){abortBeforeCommit=false;return route.abort('failed');}
   if(forcedConflict){forcedConflict=false;return route.fulfill({status:409,json:{ok:false,reason:'configuration_revision_conflict'}});}
   const key=raw.kind==='program'?'programs':'quizzes';
   const before=raw.kind==='profile'?data.profile:data[key].find(r=>r.id===raw.id);
   check((before?.revision||null)===raw.expectedRevision,'revision CAS');
   check(!before||!['active','published'].includes(before.status)||raw.action==='withdraw','no active content edits');
   check(before||raw.action==='save_draft','create draft first');
   sequence++;const revision=`2026-10-05 13:00:${String(sequence).padStart(2,'0')}.123456+00`;
   const resource={...before,...parsed.fields,revision,lastOperationId:raw.operationId,status:raw.action==='publish'?(raw.kind==='profile'?'published':'active'):raw.action==='withdraw'?'paused':'draft'};
   if(raw.kind!=='profile')resource.id=raw.id;
   if(raw.kind==='quiz')resource.managed=true;
   if(raw.kind==='profile')data.profile=resource;else data[key]=[...data[key].filter(r=>r.id!==raw.id),resource];
   if(abortAfterCommit){abortAfterCommit=false;return route.abort('failed');}
   if(delay)await new Promise(r=>setTimeout(r,100));
   return route.fulfill({json:{ok:true,tenant:'qa-tenant',resource,idempotentReplay:false}});
  });
  await page.goto(origin,{waitUntil:'networkidle'});await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.documentElement.className='theme-'+theme;},theme);
  for(const name of['Contactar a la marca','Dejar una opinión','Asesor de la marca','Consultar compra'])await page.getByRole('checkbox',{name:new RegExp(name)}).check();
  await page.getByRole('checkbox',{name:/Consultar compra/}).focus();await page.keyboard.press('Space');check(await page.getByRole('checkbox',{name:/Consultar compra/}).isChecked()===false,'keyboard service toggle');await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador guardado. Todavía no está publicado.').waitFor();
  check(history.at(-1).allowedActions.join(',')==='lead,feedback,sommelier,marketplace','all services saved');
  await page.getByRole('button',{name:'Publicar configuración guardada',exact:true}).click();await page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();await page.getByRole('button',{name:'Retirar publicación',exact:true}).waitFor();
  for(const box of await page.getByRole('checkbox').all())check(await box.isDisabled(),'published service locked');
  await snapshot(page,width,theme,'services-published');
  await page.getByRole('button',{name:'Retirar publicación',exact:true}).click();await page.getByRole('button',{name:'Confirmar retiro',exact:true}).click();await page.getByText('Retiro confirmado. Ahora podés editar; el historial se conserva.').waitFor();
  check(Object.keys(history.at(-1)).sort().join(',')==='action,expectedRevision,kind,operationId','profile withdrawal contains no edit fields');
  if(width===320&&theme==='light'){
   await page.getByRole('checkbox',{name:/Contactar a la marca/}).uncheck();abortBeforeCommit=true;
   await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'Se interrumpió'}).waitFor();
   const original=structuredClone(history.at(-1)),writes=history.length;
   await page.getByRole('button',{name:'Consultar estado guardado',exact:true}).click();await page.getByRole('button',{name:'Reintentar operación original',exact:true}).waitFor();check(history.length===writes,'no blind retry');
   await page.getByRole('button',{name:'Reintentar operación original',exact:true}).click();await page.getByText('Borrador guardado. Todavía no está publicado.').waitFor();check(JSON.stringify(history.at(-1))===JSON.stringify(original),'retry exact payload revision and operationId');
   await page.getByRole('checkbox',{name:/Contactar a la marca/}).check();abortBeforeCommit=true;
   await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'Se interrumpió'}).waitFor();
   data.profile={...data.profile,revision:'2026-10-05 14:00:00.123456+00',lastOperationId:'30000000-0000-4000-8000-000000000001'};
   await page.getByRole('button',{name:'Consultar estado guardado',exact:true}).click();await page.getByRole('heading',{name:'Estado guardado consultado',exact:true}).waitFor();
   check(await page.getByRole('button',{name:'Reintentar operación original',exact:true}).count()===0,'changed revision cannot retry');check(await page.getByRole('checkbox',{name:/Contactar a la marca/}).isChecked(),'changed revision preserves form');
   await page.getByRole('button',{name:'Descartar formulario y usar versión guardada',exact:true}).click();
  }
  await page.getByRole('button',{name:'Programa de puntos',exact:true}).click();await page.getByLabel('Programa guardado',{exact:true}).selectOption(id);
  check(await page.getByLabel('Puntos por lectura válida',{exact:true}).inputValue()==='0','saved zero points retained');
  await page.getByLabel('Nombre del programa',{exact:true}).fill('Club QA conservado');forcedConflict=true;
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'La configuración cambió'}).waitFor();
  check(await page.getByLabel('Nombre del programa',{exact:true}).inputValue()==='Club QA conservado','conflict retains form');
  check(await page.getByRole('alert').evaluate(el=>el===document.activeElement),'error focused');
  await snapshot(page,width,theme,'program-error');
  await page.getByRole('button',{name:'Consultar estado guardado',exact:true}).click();await page.getByRole('heading',{name:'Estado guardado consultado',exact:true}).waitFor();
  check(await page.getByLabel('Nombre del programa',{exact:true}).inputValue()==='Club QA conservado','GET preserves form');
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador guardado. Todavía no está publicado.').waitFor();
  check(history.at(-1).pointsPerValidTap===0&&history.at(-1).cooldownSeconds===0,'zero program semantics');
  check(history.at(-1).startAt===base.programs[0].startAt,'metadata edit retains timestamp precision');
  await page.getByRole('button',{name:'Publicar configuración guardada',exact:true}).click();await page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();await page.getByRole('button',{name:'Retirar publicación',exact:true}).waitFor();
  await page.getByRole('button',{name:'Retirar publicación',exact:true}).click();await page.getByRole('button',{name:'Confirmar retiro',exact:true}).click();await page.getByText('Retiro confirmado. Ahora podés editar; el historial se conserva.').waitFor();
  check(history.at(-1).id===id&&Object.keys(history.at(-1)).length===5,'program withdrawal stable ID only');
  await page.getByRole('button',{name:'Crear programa',exact:true}).click();
  check(await page.getByLabel('Puntos por lectura válida',{exact:true}).inputValue()==='','new program no points default');
  check(await page.getByRole('button',{name:'Publicar configuración guardada',exact:true}).isDisabled(),'new program publish disabled');
  await page.getByLabel('Nombre del programa',{exact:true}).fill('Programa nuevo QA');await page.getByLabel('Nombre de los puntos',{exact:true}).fill('Puntos nuevos QA');await page.getByLabel('Vertical',{exact:true}).selectOption('agro');await page.getByLabel('Inicio',{exact:true}).fill('2026-01-01T00:00');
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByText('Borrador guardado. Todavía no está publicado.').waitFor();
  check(history.at(-1).expectedRevision===null&&history.at(-1).pointsPerValidTap===null&&history.at(-1).cooldownSeconds===null,'null rules draft explicit non-awarding');
  await page.getByRole('button',{name:'Trivias',exact:true}).click();await page.getByLabel('Trivia guardada',{exact:true}).selectOption(qid);
  check(await page.getByLabel('Programa de la trivia',{exact:true}).isDisabled(),'persisted quiz program immutable');
  await page.getByLabel('Enunciado 1',{exact:true}).fill('Pregunta QA conservada');await page.getByRole('radio',{name:'Correcta 1',exact:true}).check();
  check(await page.getByRole('button',{name:'Quitar opción 1 de pregunta 1',exact:true}).isDisabled(),'cannot silently remove correct answer');
  await page.getByRole('button',{name:'Agregar opción a pregunta 1',exact:true}).click();await page.getByLabel('Opción 3',{exact:true}).fill('Tercera opción');await page.getByRole('button',{name:'Quitar opción 3 de pregunta 1',exact:true}).click();
  await page.getByRole('button',{name:'Agregar pregunta',exact:true}).click();await page.getByLabel('Enunciado 2',{exact:true}).fill('Pregunta temporal QA');await page.getByRole('button',{name:'Quitar pregunta 2',exact:true}).click();
  await snapshot(page,width,theme,'quiz-editor');
  abortAfterCommit=true;await page.getByRole('button',{name:'Guardar borrador',exact:true}).click();await page.getByRole('alert').filter({hasText:'Se interrumpió'}).waitFor();
  const uncertainCommand=structuredClone(history.at(-1)),writes=history.length;
  check(await page.getByLabel('Enunciado 1',{exact:true}).inputValue()==='Pregunta QA conservada','uncertain form preserved');
  check(await page.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),'uncertain writes locked');
  await page.getByRole('button',{name:'Consultar estado guardado',exact:true}).click();await page.getByText('Operación confirmada al consultar el estado guardado. No se volvió a enviar.').waitFor();
  check(history.length===writes&&data.quizzes.find(q=>q.id===qid).lastOperationId===uncertainCommand.operationId,'GET reconciles committed operation without resubmit');
  check(uncertainCommand.questions[0].correctIndex===0&&uncertainCommand.pointsPerCorrect===0&&uncertainCommand.completionBonus===0,'quiz saved exact answer and zero scoring');
  await page.getByRole('button',{name:'Publicar configuración guardada',exact:true}).click();await page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();await page.getByRole('button',{name:'Retirar publicación',exact:true}).waitFor();
  check(await page.getByLabel('Enunciado 1',{exact:true}).isDisabled(),'published quiz locked');
  await page.getByRole('button',{name:'Retirar publicación',exact:true}).click();await page.getByRole('button',{name:'Confirmar retiro',exact:true}).click();await page.getByText('Retiro confirmado. Ahora podés editar; el historial se conserva.').waitFor();
  await page.getByLabel('Trivia guardada',{exact:true}).selectOption(legacyId);check(await page.getByRole('button',{name:'Guardar borrador',exact:true}).count()===0,'legacy content readonly');
  await page.getByRole('button',{name:'Crear trivia',exact:true}).click();await page.getByLabel('Programa de la trivia',{exact:true}).selectOption(id);await page.getByLabel('Título de la trivia',{exact:true}).fill('Nueva trivia QA');await page.getByLabel('Vertical',{exact:true}).selectOption('wine');await page.getByLabel('Inicio',{exact:true}).fill('2026-01-01T00:00');
  delay=true;await page.getByRole('button',{name:'Guardar borrador',exact:true}).dblclick().catch(()=>{});delay=false;await page.getByText('Borrador guardado. Todavía no está publicado.').waitFor();
  const newId=history.at(-1).id;check(newId!==qid&&history.at(-1).questions.length===0,'new incomplete trivia draft distinct stable ID');check(history.filter(h=>h.id===newId).length===1,'double click creates once');
  await page.getByRole('button',{name:'Publicar configuración guardada',exact:true}).click();const beforeInvalid=history.length;await page.getByRole('button',{name:'Confirmar publicación',exact:true}).click();await page.getByRole('alert').filter({hasText:'Revisá los campos'}).waitFor();check(history.length===beforeInvalid,'incomplete publish refused before network');
  await context.close();
 }
 for(const mode of['readonly','demo','global','unavailable','truncated']){
  const context=await browser.newContext({viewport:{width:390,height:900},locale:'es-AR'});const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')consoleErrors.push({text:m.text(),url:m.location().url});});let calls=0;
  await context.route('**/*',route=>{check(new URL(route.request().url()).origin===origin,'extra fixture local only');if(new URL(route.request().url()).pathname.startsWith('/api/')){calls++;return route.fulfill({status:503,json:{ok:false,reason:'configuration_profile_required'}});}return route.continue();});
  await page.goto(origin+'/?mode='+mode,{waitUntil:'networkidle'});await page.evaluate(()=>{document.documentElement.dataset.theme='light';document.documentElement.className='theme-light';});
  if(mode==='readonly'){check(await page.getByRole('button',{name:'Guardar borrador',exact:true}).count()===0,'read-only no writes');for(const box of await page.getByRole('checkbox').all())check(await box.isDisabled(),'read-only service disabled');}
  if(mode==='demo'){check(await page.getByRole('button',{name:'Consultar estado guardado',exact:true}).count()===0,'demo not forwarded');check(calls===0,'demo no API reads');}
  if(mode==='global'){check(await page.getByLabel('Empresa',{exact:true}).count()===1,'superadmin choose scope');check(calls===0,'global no API reads');}
  if(mode==='unavailable'){check(await page.getByRole('alert').textContent().then(t=>t.includes('perfil de marca')),'missing setup actionable');check(await page.getByRole('checkbox').count()===0,'no unavailable defaults');}
  if(mode==='truncated'){
   check(await page.getByText(/Consulta limitada:/).count()===1,'truncation disclosed');
   await page.getByRole('button',{name:'Trivias',exact:true}).click();await page.getByLabel('Trivia guardada',{exact:true}).selectOption(qid);
   check(await page.getByLabel('Programa de la trivia',{exact:true}).inputValue()==='30000000-0000-4000-8000-000000000001','missing association retained');
   check(await page.getByLabel('Enunciado 1',{exact:true}).isDisabled(),'missing association read-only');check(await page.getByRole('button',{name:'Guardar borrador',exact:true}).count()===0,'missing association no writes');
  }
  await snapshot(page,390,'light',mode);await context.close();
 }
}catch(e){await writeFile(join(out,'failure.json'),JSON.stringify({accepted:false,error:String(e),stack:e.stack,records,sourceHashes},null,2));throw e;}
finally{await browser.close();await new Promise(r=>server.close(r));}
assert.deepEqual(await pins(),sourceHashes,'actual rendered source unchanged throughout QA');
check(errors.length===0,'no JavaScript errors');
const unexpectedConsoleErrors=consoleErrors.filter(e=>!(e.url.startsWith(origin+'/api/admin/loyalty/configuration')&&/Failed to load resource/.test(e.text)));
check(unexpectedConsoleErrors.length===0,'no unexpected console errors');
const report={accepted:true,evidence:'synthetic_actual_component_and_current_api_parser',checks,records,sourceHashes,apiParser:{path:apiSource,sha256:apiParserHash},pageErrors:errors,consoleErrors,unexpectedConsoleErrors,syntheticRequests:requests,liveAuthenticatedWrites:0,externalRequests:0,customerAcceptance:false};
await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({accepted:report.accepted,checks,views:records.length,report:join(out,'report.json')}));
