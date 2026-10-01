// Own disposable Chrome process and incognito CDP targets. No Playwright focus
// override, user's profile, fabricated visibility, business writes or GPS.
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function connect(url) {
  const socket=new WebSocket(url), pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
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

export async function verifyNativeBrandHeroHidden({chromiumExecutable,origin,output,protectionCookies=[],probeOnly=false}) {
  const ownOrigin=new URL(origin).origin, checks=[],observations=[],errors=[],blockedWrites=[],blockedSensitiveReads=[];
  const check=(passed,name,details)=>checks.push({passed:Boolean(passed),name,...(details===undefined?{}:{details})});
  const prefix=resolve(output,'native-chrome-profile-'),profile=await mkdtemp(prefix);
  const reserve=createServer();await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const position=process.platform==='win32'?{left:-10000,top:-10000}:{left:0,top:0};
  const child=spawn(chromiumExecutable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port='+port,'--user-data-dir='+profile,
    '--window-position='+position.left+','+position.top,'--window-size=1440,1080',
    ...(process.platform==='win32'?['--disable-features=CalculateNativeWinOcclusion','--disable-backgrounding-occluded-windows']:[]),
    '--no-first-run','--no-default-browser-check','--disable-background-networking',
    '--disable-component-update','--disable-sync','--disable-extensions','about:blank'],{windowsHide:true,stdio:'ignore'});
  let browser,closed=false;
  try{
    let endpoint;
    for(let attempt=0;attempt<80;attempt++){if(child.exitCode!==null)throw Error('native_chrome_stopped');try{const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(500)});endpoint=(await response.json()).webSocketDebuggerUrl;if(endpoint)break;}catch{}await delay(100);}
    if(!endpoint)throw Error('native_chrome_startup_timeout');browser=await connect(endpoint);
    for(const theme of probeOnly?['light']:['light','dark']){
      const context=await browser.send('Target.createBrowserContext',{disposeOnDetach:true});
      let page;
      try{
        const target=await browser.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId,newWindow:true});
        const list=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
        const entry=list.find(item=>item.id===target.targetId);if(!entry)throw Error('owned_native_target_missing');page=await connect(entry.webSocketDebuggerUrl);
        const evaluate=async expression=>{const result=await page.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error('native_evaluation_failed');return result.result.value;};
        const sample=()=>evaluate('('+state.toString()+')()');
        await page.send('Runtime.enable');await page.send('Page.enable');await page.send('Network.enable');
        page.on('Runtime.exceptionThrown',({exceptionDetails})=>errors.push({theme,message:String(exceptionDetails.exception?.description||exceptionDetails.text).replace(/https?:\/\/\S+/g,'[url]').slice(0,180)}));
        await page.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__nativeVisibilityEvents=[];window.__nativeGeoRequests=0;document.addEventListener("visibilitychange",()=>window.__nativeVisibilityEvents.push(document.visibilityState));Object.defineProperty(navigator,"geolocation",{value:{getCurrentPosition(){window.__nativeGeoRequests++;},watchPosition(){window.__nativeGeoRequests++;},clearWatch(){}}});'});
        page.on('Fetch.requestPaused',async({requestId,request})=>{
          const url=new URL(request.url);
          if(request.method!=='GET'){blockedWrites.push({theme,method:request.method,path:url.pathname});return page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});}
          if(url.protocol==='about:'||probeOnly&&url.protocol==='data:')return page.send('Fetch.continueRequest',{requestId});
          if(url.origin!==ownOrigin||/^\/(?:sun|api)(?:\/|$)/.test(url.pathname)||url.searchParams.has('snapshot')||url.searchParams.has('access')){
            blockedSensitiveReads.push({theme,path:url.pathname});return page.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
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
          if(await evaluate(probeOnly?'document.readyState==="complete"':'Boolean(document.readyState==="complete"&&document.querySelector(".hero-immersive-media img")?.complete&&document.querySelector(".hero-immersive-media img")?.naturalWidth>0&&document.querySelector("header [data-brand-motion-active=\"true\"]"))')){ready=true;break;}await delay(100);
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
  }catch(error){check(false,'Native hidden proof completed',{message:String(error.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,180)});}
  finally{
    if(browser){await browser.send('Browser.close').catch(()=>{});browser.close();}
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);
    if(child.exitCode===null){child.kill();await delay(300);}closed=child.exitCode!==null;
    // The computed recursive-delete target is verified inside this owned QA
    // output directory before removing the disposable, non-user profile.
    if(!resolve(profile).startsWith(prefix))throw Error('native_profile_cleanup_target_invalid');
    await rm(profile,{recursive:true,force:true});
  }
  check(closed,'Owned native browser closed');check(errors.length===0,'Native page has no exceptions',errors);check(blockedWrites.length===0,'Native page attempted no business writes',blockedWrites);
  const report={ownedDisposableBrowser:true,offscreenWindow:process.platform==='win32',virtualDisplayExpected:process.platform!=='win32',incognitoContexts:true,profileRemoved:true,realDocumentVisibility:true,
    fabricatedVisibility:false,probeOnly,checks,observations,errors,blockedWrites,blockedSensitiveReads,browserClosed:closed};
  await writeFile(join(output,'native-hidden-report.json'),JSON.stringify(report,null,2));return report;
}
