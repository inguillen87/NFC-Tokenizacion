// Own disposable Chrome process and incognito CDP targets. No Playwright focus
// override, user's profile, fabricated visibility, business writes or GPS.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile, readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// Chrome writes this identity in the fresh profile when port 0 is bound.
export function parseNativeDevToolsActivePort(raw) {
  const text=typeof raw==='string'?raw:new TextDecoder('utf-8',{fatal:true}).decode(raw);
  if(Buffer.byteLength(text)>1024)throw Error('native_chrome_active_port_invalid');
  const match=/^([1-9][0-9]{0,4})\r?\n(\/devtools\/browser\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:\r?\n)?$/i.exec(text);
  if(!match||match[0]!==text||Number(match[1])>65535)throw Error('native_chrome_active_port_invalid');
  return {port:Number(match[1]),browserPath:match[2]};
}

export function validateNativeBrowserEndpoint(endpoint,active) {
  const expected='ws://127.0.0.1:'+active.port+active.browserPath;
  if(endpoint!==expected)throw Error('native_chrome_endpoint_identity_mismatch');
  return endpoint;
}

export async function readNativeVersion(active,timeoutMs,fetchVersion=fetch) {
  const response=await fetchVersion('http://127.0.0.1:'+active.port+'/json/version',{redirect:'manual',signal:AbortSignal.timeout(Math.max(1,Math.ceil(timeoutMs)))});
  if(response.status!==200){await response.body?.cancel().catch(()=>{});return {status:response.status};}
  const reader=response.body?.getReader();if(!reader)throw Error('native_chrome_version_invalid');
  const chunks=[];let bytes=0;
  try{for(;;){const row=await reader.read();if(row.done)break;bytes+=row.value.byteLength;if(bytes>4096)throw Error('native_chrome_version_invalid');chunks.push(Buffer.from(row.value));}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw Error('native_chrome_version_invalid');}
  return {status:200,webSocketDebuggerUrl:value?.webSocketDebuggerUrl};
}

export async function waitForNativeDevTools({readActivePort,readVersion,processState,now=()=>performance.now(),sleep=delay,timeoutMs=30000,diagnostics={}}) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>30000)throw Error('native_chrome_startup_budget_invalid');
  const begun=now(),deadline=begun+timeoutMs;
  Object.assign(diagnostics,{strategy:'owned-profile-port-zero',budgetMs:timeoutMs,elapsedMs:0,phase:'active-port',reason:'pending',fileReads:0,fileMissing:0,fileRejected:0,versionRequests:0,versionRejected:0,transportFailures:0,childState:'unknown'});
  const remaining=()=>deadline-now();
  const guard=()=>{diagnostics.elapsedMs=Math.max(0,Math.ceil(now()-begun));diagnostics.childState=processState();if(diagnostics.childState==='spawn-failed')throw Error('native_chrome_spawn_failed');if(diagnostics.childState!=='alive')throw Error('native_chrome_stopped');if(remaining()<=0)throw Error('native_chrome_startup_timeout');};
  for(;;){
    guard();diagnostics.phase='active-port';diagnostics.fileReads++;let active;
    try{const raw=await readActivePort(Math.min(500,remaining()));guard();active=parseNativeDevToolsActivePort(raw);}
    catch(error){guard();if(error.code==='ENOENT'){diagnostics.fileMissing++;diagnostics.reason='active-port-missing';}else if(error.message==='native_chrome_active_port_invalid'){diagnostics.fileRejected++;diagnostics.reason='active-port-incomplete-or-invalid';}else{diagnostics.reason='active-port-read-failed';throw Error('native_chrome_active_port_read_failed');}}
    if(active){
      guard();diagnostics.phase='version';diagnostics.versionRequests++;
      try{const version=await readVersion(active,Math.min(500,remaining()));guard();if(version.status!==200)throw Error('native_chrome_version_status');const endpoint=validateNativeBrowserEndpoint(version.webSocketDebuggerUrl,active);guard();diagnostics.phase='endpoint-verified';diagnostics.reason='identity-verified';return {port:active.port,endpoint,deadline,begun,diagnostics};}
      catch(error){guard();if(['native_chrome_version_status','native_chrome_version_invalid','native_chrome_endpoint_identity_mismatch'].includes(error.message)){diagnostics.versionRejected++;diagnostics.reason=error.message.slice('native_chrome_'.length);}else{diagnostics.transportFailures++;diagnostics.reason='version-transport-failed';}}
    }
    guard();await sleep(Math.min(100,remaining()));
  }
}

export function waitForNativeSocketOpen(socket,{timeoutMs=10000,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0||timeoutMs>10000){socket.close();return Promise.reject(Error('native_cdp_connect_budget_invalid'));}
  return new Promise((resolve,reject)=>{
    let settled=false,timer;
    const cleanup=()=>{clearTimer(timer);socket.removeEventListener('open',opened);socket.removeEventListener('error',failed);socket.removeEventListener('close',closed);};
    const finish=error=>{if(settled)return;settled=true;cleanup();if(error){if(socket.readyState!==3){const ignored=()=>{},afterClose=()=>{socket.removeEventListener('error',ignored);socket.removeEventListener('close',afterClose);};socket.addEventListener('error',ignored,{once:true});socket.addEventListener('close',afterClose,{once:true});try{socket.close();}catch{socket.removeEventListener('error',ignored);socket.removeEventListener('close',afterClose);}}reject(error);}else resolve();};
    const opened=()=>finish(),failed=()=>finish(Error('native_cdp_connect_failed')),closed=()=>finish(Error('native_cdp_closed_before_open'));
    socket.addEventListener('open',opened);socket.addEventListener('error',failed);socket.addEventListener('close',closed);
    timer=setTimer(()=>finish(Error('native_cdp_connect_timeout')),Math.ceil(timeoutMs));
    if(socket.readyState===1)opened();else if(socket.readyState===3)closed();
  });
}
async function connect(url,{timeoutMs=10000}={}) {
  const socket=new WebSocket(url), pending=new Map();let id=0;
  await waitForNativeSocketOpen(socket,{timeoutMs});
  const listeners=new Map();
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.id){const item=pending.get(message.id);if(!item)return;clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(Error(message.error.message)):item.resolve(message.result);}
    else for(const listener of listeners.get(message.method)||[])Promise.resolve(listener(message.params)).catch(()=>{});
  });
  return {on(method,callback){const list=listeners.get(method)||[];list.push(callback);listeners.set(method,list);},
    send(method,params={}){const next=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(next);reject(Error('native_cdp_timeout_'+method));},10000);pending.set(next,{resolve,reject,timer});socket.send(JSON.stringify({id:next,method,params}));});},
    close(){for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('native_cdp_closed'));}pending.clear();socket.close();}};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function state() {
  const roots={logo:document.querySelector('header [data-brand-home-link][data-brand-motion]'),hero:document.querySelector('.hero-immersive-media')};
  const inspect=root=>{
    if(!root)return null;
    const rect=root.getBoundingClientRect(),styles=[root,...root.querySelectorAll('*')].map(element=>{const cs=getComputedStyle(element);let svgMatrix=null;if(element instanceof SVGGraphicsElement&&element.querySelector(':scope > animateTransform')){const matrix=element.getCTM();if(matrix)svgMatrix=['a','b','c','d','e','f'].map(key=>Number(matrix[key].toFixed(4)));}return{class:element.getAttribute('class'),transform:cs.transform,opacity:cs.opacity,boxShadow:cs.boxShadow,strokeDashoffset:cs.strokeDashoffset,svgMatrix};});
    return{visible:rect.bottom>0&&rect.top<innerHeight&&rect.width>0&&rect.height>0,
      active:root.getAttribute('data-brand-motion-active'),signalActive:root.querySelector('.hero-immersive-signal')?.getAttribute('data-motion-active'),
      visualSignature:JSON.stringify(styles),loops:root.getAnimations({subtree:true}).filter(animation=>animation.playState==='running'&&animation.effect?.getTiming().iterations===Infinity).map(animation=>({name:animation.animationName||'web-animation'})),
      smil:[...root.querySelectorAll('svg')].map(svg=>({paused:svg.animationsPaused(),indefinite:svg.querySelectorAll('animate[repeatCount="indefinite"],animateTransform[repeatCount="indefinite"],animateMotion[repeatCount="indefinite"]').length}))};
  };
  return{hidden:document.hidden,visibilityState:document.visibilityState,events:window.__nativeVisibilityEvents||[],geoRequests:window.__nativeGeoRequests||0,
    logo:inspect(roots.logo),hero:inspect(roots.hero)};
}

function productReady() {
  const image=document.querySelector('.hero-immersive-media img');
  return Boolean(document.readyState==='complete'&&image?.complete&&image.naturalWidth>0
    &&document.querySelector('header [data-brand-motion-active="true"]'));
}

export function validateNativeExpressions() {
  const expressions={snapshot:'('+state.toString()+')()',productReady:'('+productReady.toString()+')()',blankReady:'document.readyState==="complete"'};
  // Compile owned expressions before any browser process or network request;
  // DOM references are deliberately not executed in Node.
  for(const expression of Object.values(expressions))new Function('return ('+expression+')');
  return expressions;
}

export function validateAllowedClerkOrigins(origins=[]) {
  if(!Array.isArray(origins))throw Error('explicit_clerk_origin_array_required');
  const observedOrigins=new Set(['https://advanced-kodiak-20.clerk.accounts.dev']);
  for(const origin of origins){
    if(typeof origin!=='string'||!observedOrigins.has(origin))throw Error('unverified_clerk_origin');
    const url=new URL(origin);
    if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password||url.search||url.hash)throw Error('invalid_clerk_origin');
  }
  return [...new Set(origins)];
}

export function readOnlyRequestDecision({method,url,origin,allowedClerkOrigins=[]}) {
  if(method!=='GET')return 'blocked-write';
  if(/^\/(?:sun|api)(?:\/|$)/.test(url.pathname)||url.searchParams.has('snapshot')||url.searchParams.has('access'))return 'blocked-sensitive';
  return url.origin===origin||allowedClerkOrigins.includes(url.origin)?'allow-read':'blocked-external';
}

export function blockedWriteCategory({method,url,allowedClerkOrigins=[]}) {
  if(['OPTIONS','POST'].includes(method)&&url.origin==='https://clerk-telemetry.com'&&url.pathname==='/v1/event')return 'sdk-telemetry';
  return method==='POST'&&url.pathname==='/v1/environment'&&allowedClerkOrigins.includes(url.origin)
    ?'automatic-clerk-initialization':'business-write';
}

export async function verifyNativeBrandHeroHidden({chromiumExecutable,origin,output,protectionCookies=[],probeOnly=false,allowedClerkOrigins=[]}) {
  const expressions=validateNativeExpressions();
  allowedClerkOrigins=validateAllowedClerkOrigins(allowedClerkOrigins);
  const ownOrigin=new URL(origin).origin, checks=[],observations=[],errors=[],blockedWrites=[],blockedSensitiveReads=[];
  const check=(passed,name,details)=>checks.push({passed:Boolean(passed),name,...(details===undefined?{}:{details})});
  const prefix=resolve(output,'native-chrome-profile-'),profile=await mkdtemp(prefix);
  const position=process.platform==='win32'?{left:-10000,top:-10000}:{left:0,top:0};
  const linuxLaunchFlags=process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[];
  let child,browser,closed=false,started=false,startupStderr='',spawnError,port,startupBegun;
  const startupReadiness={};
  const processExited=()=>Boolean(child)&&(child.exitCode!==null||child.signalCode!==null);
  const processState=()=>spawnError?'spawn-failed':!child?'not-spawned':processExited()?'exited':'alive';
  const waitForExit=async()=>{if(child&&!processExited()&&!spawnError)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);};
  try{
    child=spawn(chromiumExecutable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,
    '--window-position='+position.left+','+position.top,'--window-size=1440,1080',
    ...(process.platform==='win32'?['--disable-features=CalculateNativeWinOcclusion','--disable-backgrounding-occluded-windows']:[]),
    ...linuxLaunchFlags,
    '--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--disable-component-update','--disable-sync','--disable-extensions','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
    child.on('error',error=>{spawnError=error;});
    child.stderr.on('data',data=>{if(!started)startupStderr=(startupStderr+String(data)).slice(-16384);});
    const ready=await waitForNativeDevTools({processState,diagnostics:startupReadiness,
      readActivePort:async timeoutMs=>{const file=join(profile,'DevToolsActivePort'),info=await lstat(file);if(!info.isFile()||info.isSymbolicLink()||info.size>1024)throw Error('native_chrome_active_port_unsafe');return readFile(file,{signal:AbortSignal.timeout(Math.max(1,Math.ceil(timeoutMs)))});},
      readVersion:readNativeVersion});
    startupBegun=ready.begun;port=ready.port;startupReadiness.phase='websocket';
    const remaining=ready.deadline-performance.now();if(remaining<=0)throw Error('native_chrome_startup_timeout');
    browser=await connect(ready.endpoint,{timeoutMs:Math.min(10000,remaining)});
    startupReadiness.elapsedMs=Math.max(0,Math.ceil(performance.now()-ready.begun));startupReadiness.childState=processState();
    if(processState()!=='alive')throw Error(spawnError?'native_chrome_spawn_failed':'native_chrome_stopped');
    if(performance.now()>=ready.deadline)throw Error('native_chrome_startup_timeout');
    started=true;startupStderr='';startupReadiness.phase='ready';startupReadiness.reason='socket-open-and-child-alive';
    for(const theme of probeOnly?['light']:['light','dark']){
      const context=await browser.send('Target.createBrowserContext',{disposeOnDetach:true});
      let page;
      try{
        const target=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId,newWindow:true});
        const list=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
        const entry=list.find(item=>item.id===target.targetId);if(!entry)throw Error('owned_native_target_missing');page=await connect(entry.webSocketDebuggerUrl);
        const evaluate=async expression=>{const result=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails){const description=String(result.exceptionDetails.exception?.description||result.exceptionDetails.text).split('\n')[0].replace(/https?:\/\/\S+/g,'[url]').slice(0,140);throw Error('native_evaluation_failed: '+description);}return result.result.value;};
        const sample=()=>evaluate(expressions.snapshot);
        await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Network.enable');
        page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push({theme,message:String(exceptionDetails.exception?.description||exceptionDetails.text).replace(/https?:\/\/\S+/g,'[url]').slice(0,180)}));
        await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__nativeVisibilityEvents=[];window.__nativeGeoRequests=0;document.addEventListener("visibilitychange",()=>window.__nativeVisibilityEvents.push(document.visibilityState));Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition(){window.__nativeGeoRequests++;},watchPosition(){window.__nativeGeoRequests++;},clearWatch(){}}});'});
        page.on('Fetch.requestPaused',async({requestId,request})=>{
          const url=new URL(request.url);
          if(request.method!=='GET'){blockedWrites.push({theme,method:request.method,origin:url.origin,path:url.pathname,category:blockedWriteCategory({method:request.method,url,allowedClerkOrigins}),aborted:true});return page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
          if(url.protocol==='about:'||probeOnly&&url.protocol==='data:')return page.send('Fetch.continueRequest',{requestId});
          const decision=readOnlyRequestDecision({method:request.method,url,origin:ownOrigin,allowedClerkOrigins});
          if(decision!=='allow-read'){
            blockedSensitiveReads.push({theme,origin:url.origin,path:url.pathname,reason:decision});return page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
          }
          return page.send('Fetch.continueRequest',{requestId});
        });
        await page.send('Fetch.enable',{patterns:[{urlPattern:'*'}]});
        await page.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1080,deviceScaleFactor:1,mobile:false});
        await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
        await page.send('Network.setCookies',{cookies:[...protectionCookies,{name:'theme',value:theme,url:ownOrigin},{name:'nexid_theme_version',value:'white-first-v2',url:ownOrigin}]});
        const window=await browser.send('Browser.getWindowForTarget',{targetId:target.targetId});
        await browser.send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{...position,width:1456,height:1160,windowState:'normal'}});
        await browser.send('Target.activateTarget',{targetId:target.targetId});
        await page.send('Page.navigate',{url:probeOnly?'data:text/html,<p>Native visibility capability probe without network</p>':ownOrigin+'/'});
        let ready=false;
        for(let attempt=0;attempt<100;attempt++){
          if(await evaluate(probeOnly?expressions.blankReady:expressions.productReady)){ready=true;break;}await delay(100);
        }
        if(!ready)throw Error('native_product_render_timeout');await delay(600);
        const before=await sample();await delay(500);const moving=await sample();
        check(!before.hidden&&before.visibilityState==='visible','Native page initially visible '+theme,{state:before.visibilityState});
        if(!probeOnly){check(before.logo?.visible&&before.logo.visualSignature!==moving.logo?.visualSignature,'Native logo moves before hiding '+theme);check(before.hero?.visible&&before.hero.visualSignature!==moving.hero?.visualSignature,'Native hero moves before hiding '+theme);}
        // Native tab selection works in Xvfb without a window manager and does
        // not introduce a focus/visibility emulation override.
        const covering=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId,newWindow:false,background:false});
        const coveringWindow=await browser.send('Browser.getWindowForTarget',{targetId:covering.targetId});
        check(coveringWindow.windowId===window.windowId,'Native covering tab belongs to the same owned window '+theme);
        await browser.send('Target.activateTarget',{targetId:covering.targetId});
        let hidden;
        for(let attempt=0;attempt<20;attempt++){hidden=await sample();if(hidden.hidden&&hidden.visibilityState==='hidden')break;await delay(100);}
        await delay(400);hidden=await sample();
        check(hidden.hidden&&hidden.visibilityState==='hidden'&&hidden.events.includes('hidden'),'Native tab selection produces real hidden event '+theme,hidden);
        if(!probeOnly){
          const idle=item=>item&&item.loops.length===0&&item.smil.every(svg=>!svg.indefinite||svg.paused);
          check(idle(hidden.logo),'Native hidden page pauses logo CSS and SMIL '+theme,hidden.logo);
          check(idle(hidden.hero),'Native hidden page pauses hero CSS loops '+theme,hidden.hero);
        }
        const stillHidden=await sample();
        if(!probeOnly){check(hidden.logo?.visualSignature===stillHidden.logo?.visualSignature,'Hidden logo rendered phase remains still '+theme);check(hidden.hero?.visualSignature===stillHidden.hero?.visualSignature,'Hidden hero rendered phase remains still '+theme);}
        await browser.send('Target.activateTarget',{targetId:target.targetId});await browser.send('Target.closeTarget',{targetId:covering.targetId});await delay(400);
        const returned=await sample();await delay(500);const resumed=await sample();
        check(!returned.hidden&&returned.visibilityState==='visible'&&returned.events.includes('visible'),'Native restored window produces real visible event '+theme,{state:returned.visibilityState,events:returned.events});
        if(!probeOnly){check(returned.logo?.visualSignature!==resumed.logo?.visualSignature,'Native logo resumes after return '+theme);check(returned.hero?.visualSignature!==resumed.hero?.visualSignature,'Native hero resumes after return '+theme);}
        check(resumed.geoRequests===0,'Native probe does not request GPS '+theme);
        observations.push({theme,width:1440,hideMethod:'native tab activation in the same incognito window',before,moving,hidden,stillHidden,returned,resumed});
      }finally{page?.close();await browser.send('Target.disposeBrowserContext',{browserContextId:context.browserContextId});}
    }
  }catch(error){if(!started){if(Number.isFinite(startupBegun))startupReadiness.elapsedMs=Math.max(0,Math.ceil(performance.now()-startupBegun));startupReadiness.failure=String(error.message).startsWith('native_')?String(error.message):'native_chrome_startup_failed';}check(false,'Native hidden proof completed',{message:String(error.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,180)});}
  finally{
    if(!started)startupReadiness.childStateBeforeCleanup=processState();
    if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}
    await waitForExit();
    if(child&&!processExited()&&!spawnError){child.kill();await waitForExit();}
    if(child&&!processExited()&&!spawnError){child.kill('SIGKILL');await waitForExit();}
    closed=!child||Boolean(spawnError)||processExited();
    // The computed recursive-delete target is verified inside this owned QA
    // output directory before removing the disposable, non-user profile.
    if(!resolve(profile).startsWith(prefix))throw Error('native_profile_cleanup_target_invalid');
    if(closed)await rm(profile,{recursive:true,force:true});
  }
  const blockedAutomaticClerkInitialization=blockedWrites.filter(row=>row.category==='automatic-clerk-initialization');
  const blockedSdkTelemetry=blockedWrites.filter(row=>row.category==='sdk-telemetry');
  check(closed,'Owned native browser closed');check(errors.length===0,'Native page has no exceptions',errors);check(blockedWrites.every(row=>['automatic-clerk-initialization','sdk-telemetry'].includes(row.category)),'Native attempted no business writes; automatic Clerk initialization and SDK telemetry were aborted',blockedWrites);
  const startupDiagnostics=started?null:{platform:process.platform,virtualDisplayPresent:Boolean(process.env.DISPLAY),linuxLaunchFlags,exitCode:child?.exitCode??null,signalCode:child?.signalCode??null,stderr:startupStderr.split('\n').map(line=>/cookie|token|authorization|secret|password/i.test(line)?'[redacted startup line]':line.replace(/https?:\/\/\S+|wss?:\/\/\S+/g,'[url]')).join('\n').slice(-4096)};
  const report={ownedDisposableBrowser:true,offscreenWindow:process.platform==='win32',virtualDisplayExpected:process.platform!=='win32',incognitoContexts:true,profileRemoved:closed,realDocumentVisibility:true,
    fabricatedVisibility:false,probeOnly,allowedClerkOrigins,startupDiagnostics,startupReadiness,checks,observations,errors,blockedWrites,blockedAutomaticClerkInitialization,blockedSdkTelemetry,blockedSensitiveReads,browserClosed:closed};
  await writeFile(join(output,'native-hidden-report.json'),JSON.stringify(report,null,2));return report;
}
