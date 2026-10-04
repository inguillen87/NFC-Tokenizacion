// Actual local Next production UI. No mocked motion, API writes, real NFC URLs
// or geolocation. Run via brand-hero-motion-next.browser.mjs after a build.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { verifyNativeBrandHeroHidden, validateAllowedClerkOrigins, readOnlyRequestDecision, blockedWriteCategory } from './native-brand-hero-hidden.mjs';

// Remote callers must supply provider-verified metadata and acquire protection
// cookies in memory. This module never discovers, stores or prints credentials.
export async function verifyBrandHeroMotion({ origin:originInput, output:outputInput, protectionCookies=[],
  expectedRelease, expectedSourceSha, expectedDeployment, providerMetadataVerifiedByCaller=false, allowRemote=false, allowedClerkOrigins=[] }={}) {
if (!originInput) throw Error('QA_ORIGIN_required');
const suppliedOrigin = new URL(originInput);
const local = suppliedOrigin.protocol === 'http:' && ['localhost','127.0.0.1'].includes(suppliedOrigin.hostname);
const remote = allowRemote && suppliedOrigin.protocol === 'https:'
  && (['nexid.lat','nexid.com.ar'].includes(suppliedOrigin.hostname)
    || /^nexid-[a-z0-9]+-marcelos-projects-c26aa499\.vercel\.app$/.test(suppliedOrigin.hostname));
if ((!local && !remote) || suppliedOrigin.username || suppliedOrigin.password || suppliedOrigin.search || suppliedOrigin.hash
  || suppliedOrigin.pathname !== '/') throw Error('acceptance_origin_not_allowed');
if (remote && (!expectedRelease || !/^[a-f0-9]{40}$/.test(expectedSourceSha || '')
  || !/^dpl_[A-Za-z0-9]+$/.test(expectedDeployment || '') || !providerMetadataVerifiedByCaller)) throw Error('remote_provider_verified_identity_required');
const origin = suppliedOrigin.origin;
allowedClerkOrigins=validateAllowedClerkOrigins(allowedClerkOrigins);
const output = resolve(outputInput || 'artifacts/brand-hero-motion-local');
await mkdir(output, { recursive:true });
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE || 'C:/Users/guill/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs').href);
const axe = await readFile(process.env.AXE_MODULE_PATH || process.env.AXE_PATH || 'artifacts/browser-tools/node_modules/axe-core/axe.min.js', 'utf8');
const report = {
  localOnly:local, actualNextStyles:true, serverModeExpected:'next start after production build',
  origin, fabricatedApiResponses:false, fabricatedVisibility:false, physicalTapMeasured:false,
  gpsMeasured:false, businessWritesAllowed:false, expectedRelease:expectedRelease || null,
  expectedSourceSha:expectedSourceSha || null, expectedDeployment:expectedDeployment || null,
  providerMetadataVerifiedByCaller, protectionCookieCount:protectionCookies.length, allowedClerkOrigins, releaseVerification:null,
  matrix:{ widths:[320,390,768,1440,1920], heightsByWidth:{320:844,390:844,768:960,1440:1080,1920:1080}, themes:['light','dark'], reducedMotion:['no-preference','reduce'],
    workflowRegression:{width:768,height:960,reducedMotion:'no-preference',headingBottomMargin:8} },
  contrastMethod:'Minimum sampled contrast across the actual element backdrop, with only its text ink temporarily transparent and its exact inline style restored. Normal screenshots remain unmodified. This is sampled rendered contrast, not certification of every possible animation frame.',
  checks:[], views:[], motionSamples:[], hiddenPageSamples:[], errors:[], blockedWrites:[], blockedSensitiveReads:[],
};
const check = (condition, name, details) => report.checks.push({ name, passed:Boolean(condition), ...(details === undefined ? {} : { details }) });
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const chromiumExecutable=process.env.CHROME_PATH || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : chromium.executablePath());
const browser = await chromium.launch({ executablePath:chromiumExecutable, headless:true });
const save = () => writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));

function motionSnapshot(roots) {
 return roots.map(root => {
  const visible = element => {
    const rect = element.getBoundingClientRect(), cs = getComputedStyle(element);
    return Boolean(element.getClientRects().length && cs.visibility !== 'hidden' && cs.display !== 'none'
      && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth);
  };
  const nodes = [root, ...root.querySelectorAll('*')];
  const styles = nodes.filter(visible).map(element => {
    const cs = getComputedStyle(element);
    let svgMatrix = null;
    if (element instanceof SVGGraphicsElement && element.querySelector(':scope > animateTransform, :scope > animate')) {
      const matrix = element.getCTM();
      if (matrix) svgMatrix = ['a','b','c','d','e','f'].map(key => Number(matrix[key].toFixed(4)));
    }
    return { tag:element.tagName, class:element.getAttribute('class'), transform:cs.transform,
      opacity:cs.opacity, boxShadow:cs.boxShadow, strokeDashoffset:cs.strokeDashoffset, svgMatrix };
  });
  const loops = root.getAnimations({ subtree:true }).filter(animation => animation.playState === 'running'
    && animation.effect?.getTiming().iterations === Infinity).map(animation => ({
      name:animation.animationName || 'web-animation', class:animation.effect?.target?.getAttribute?.('class') || null,
      currentTime:animation.currentTime, duration:animation.effect.getTiming().duration,
    }));
  const smil = nodes.filter(element => element instanceof SVGSVGElement).map(svg => ({
    class:svg.getAttribute('class'), visible:visible(svg), paused:svg.animationsPaused(),
    currentTime:svg.getCurrentTime(), indefiniteNodes:svg.querySelectorAll('animate[repeatCount="indefinite"], animateTransform[repeatCount="indefinite"], animateMotion[repeatCount="indefinite"]').length,
  }));
  return { visible:visible(root), active:root.getAttribute('data-brand-motion-active') ?? root.getAttribute('data-motion-active'),
    mode:root.getAttribute('data-brand-motion') ?? root.getAttribute('data-motion-mode'),
    styles, loops, smil, visualSignature:JSON.stringify(styles) };
 });
}
const snapshots = locator => locator.evaluateAll(motionSnapshot);
const idle = snapshot => snapshot.loops.length === 0 && snapshot.smil.every(svg => svg.indefiniteNodes === 0 || svg.paused);

async function phaseSamples(page, locator) {
  const samples = [];
  for (const delay of [0, 350, 450]) {
    if (delay) await page.waitForTimeout(delay);
    samples.push(await snapshots(locator));
  }
  return samples;
}
function phaseChanged(samples, index = 0) {
  return samples.some(sample => sample[index]?.visualSignature !== samples[0][index]?.visualSignature);
}

// Read actual rendered pixels under text rather than treating an ancestor's
// paper color as the backdrop when an absolute hero image lies behind it.
async function backdropContrast(page, locator, name) {
  const metadata = await locator.evaluate(element => {
    const cs = getComputedStyle(element), rect = element.getBoundingClientRect();
    const foreground = cs.color.match(/[\d.]+/g)?.map(Number);
    return { text:element.textContent.trim().slice(0,100), foreground, cssColor:cs.color,
      textFill:cs.webkitTextFillColor, fontSize:parseFloat(cs.fontSize), fontWeight:parseInt(cs.fontWeight),
      visible:rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight,
      clip:{ x:Math.max(0, Math.floor(rect.x)), y:Math.max(0, Math.floor(rect.y)),
        width:Math.min(innerWidth, Math.ceil(rect.right)) - Math.max(0, Math.floor(rect.x)),
        height:Math.min(innerHeight, Math.ceil(rect.bottom)) - Math.max(0, Math.floor(rect.y)) },
      originalStyles:[element,...element.querySelectorAll('*')].map(node=>node.getAttribute('style')) };
  });
  if (!metadata.visible || !metadata.foreground || metadata.textFill === 'rgba(0, 0, 0, 0)') return { ...metadata, supported:false };
  let pixels;
  try {
    await locator.evaluate(element => {
      for(const node of [element,...element.querySelectorAll('*')]){
        node.style.setProperty('color','transparent','important');
        node.style.setProperty('-webkit-text-fill-color','transparent','important');
        node.style.setProperty('text-shadow','none','important');
      }
    });
    await settle(page);
    const screenshot = await page.screenshot({ clip:metadata.clip });
    const image = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject:true });
    pixels = image.data;
    await writeFile(join(output, name + '-backdrop.png'), screenshot);
  } finally {
    await locator.evaluate((element, originals) => {
      [element,...element.querySelectorAll('*')].forEach((node,index)=>{
        if(originals[index]===null)node.removeAttribute('style');else node.setAttribute('style',originals[index]);
      });
    }, metadata.originalStyles);
  }
  const luminance = color => color.slice(0,3).map(value => {
    value /= 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((total,value,index) => total + value * [.2126,.7152,.0722][index],0);
  const alpha = metadata.foreground[3] ?? 1;
  let minimumRatio = Infinity, worstBackdrop = null;
  for (let index=0; index<pixels.length; index+=3) {
    const back = [...pixels.subarray(index,index+3)], ink = back.map((value, channel) => metadata.foreground[channel] * alpha + value * (1-alpha));
    const a=luminance(ink), b=luminance(back), ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    if (ratio < minimumRatio) { minimumRatio=ratio; worstBackdrop=back; }
  }
  const minimumRequired = metadata.fontSize >= 24 || metadata.fontSize >= 18.66 && metadata.fontWeight >= 700 ? 3 : 4.5;
  return { text:metadata.text, cssColor:metadata.cssColor, visible:metadata.visible, supported:true,
    minimumRatio, minimumRequired, worstBackdrop, sampledPixels:pixels.length/3, clip:metadata.clip, inlineStyleRestored:true };
}

async function audit(page, name) {
  await page.addScriptTag({ content:axe });
  const result = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly:{ type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa'] } });
    return { violations:result.violations.map(item => ({ id:item.id, impact:item.impact, targets:item.nodes.map(node => node.target).slice(0,8) })),
      incomplete:result.incomplete.map(item => ({ id:item.id, nodes:item.nodes.length })) };
  });
  check(result.violations.length === 0, 'Axe AA ' + name, result);
  return result;
}

async function logoLegibility(locator) {
  return locator.evaluate(link => {
    const rgb=value=>{const numbers=value.match(/[\d.]+/g)?.map(Number);return numbers?.length>=3?[...numbers.slice(0,3),numbers[3]??1]:null;};
    const luminance=color=>color.slice(0,3).map(value=>{value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
    const lineage=[];for(let node=link;node instanceof HTMLElement;node=node.parentElement)lineage.unshift(node);
    let background=[255,255,255,1],supported=true;
    for(const node of lineage){
      const cs=getComputedStyle(node),color=rgb(cs.backgroundColor);
      if(color?.[3]===1){background=color;supported=cs.backgroundImage==='none';}
      else if(color){background=background.slice(0,3).map((value,index)=>color[index]*color[3]+value*(1-color[3])).concat(1);if(cs.backgroundImage!=='none')supported=false;}
      else supported=false;
      if(cs.opacity!=='1'||cs.mixBlendMode!=='normal')supported=false;
    }
    const svg=link.querySelector('.brand-wordmark-svg'),samples=[],bounds=[];
    for(const text of svg?.querySelectorAll('.brand-wordmark-text')||[]){
      const fill=getComputedStyle(text).fill,match=/url\(["']?([^"')]+)["']?\)/.exec(fill),gradientId=match?.[1].split('#').at(-1);
      const gradient=gradientId?[...svg.querySelectorAll('linearGradient')].find(element=>element.id===gradientId):null;
      const paints=gradient?[...gradient.querySelectorAll('stop')].map(stop=>({color:rgb(getComputedStyle(stop).stopColor),opacity:parseFloat(getComputedStyle(stop).stopOpacity)})):[{color:rgb(fill),opacity:1}];
      const valid=paints.filter(paint=>paint.color&&paint.color[3]===1&&paint.opacity===1);
      for(const paint of paints){
        if(!paint.color||paint.color[3]!==1||paint.opacity!==1){supported=false;continue;}
        const ink=luminance(paint.color),back=luminance(background),ratio=(Math.max(ink,back)+.05)/(Math.min(ink,back)+.05);
        samples.push({class:text.getAttribute('class'),color:paint.color.slice(0,3),ratio});
      }
      if(valid.length){
        const low=[0,1,2].map(channel=>Math.min(...valid.map(paint=>paint.color[channel]))),high=[0,1,2].map(channel=>Math.max(...valid.map(paint=>paint.color[channel])));
        const a=luminance(low),b=luminance(high),back=luminance(background);
        const ratio=value=>(Math.max(value,back)+.05)/(Math.min(value,back)+.05);
        bounds.push({class:text.getAttribute('class'),low,high,minimumRatio:back>=a&&back<=b?1:Math.min(ratio(a),ratio(b))});
      }
    }
    return{supported:supported&&samples.length>0,background:background.slice(0,3),minimumRatio:Math.min(...bounds.map(bound=>bound.minimumRatio)),samples,bounds,
      method:'Computed opaque header backdrop and conservative per-channel RGB bounds over SVG wordmark gradient endpoints. Unknown images, blends or translucent ink remain unsupported.'};
  });
}

async function keyboardNavigation(page, name) {
  const trigger = page.getByRole('button', { name:'Abrir navegación', exact:true });
  if (await trigger.isVisible()) {
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name:'Abrir navegación', exact:true });
    await dialog.waitFor(); await settle(page);
    check(await dialog.evaluate(element => element.contains(document.activeElement)), 'Menu takes keyboard focus ' + name);
    check(await trigger.getAttribute('aria-expanded') === 'true', 'Menu announces open state ' + name);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state:'detached' });
    check(await trigger.evaluate(element => element === document.activeElement), 'Menu restores focus ' + name);
    check(await page.locator('[data-nav-inert]').evaluateAll(nodes => nodes.every(element => !element.inert)), 'Menu releases page ' + name);
  } else {
    const trigger = page.locator('[data-mega-nav-group="solutions"] > button');
    await trigger.focus(); await page.keyboard.press('ArrowDown'); await settle(page);
    check(await page.locator('#mega-menu-solutions').evaluate(element => element.contains(document.activeElement)), 'Desktop menu takes keyboard focus ' + name);
    await page.keyboard.press('Escape'); await settle(page);
    check(await trigger.evaluate(element => element === document.activeElement), 'Desktop menu restores focus ' + name);
  }
}

try {
  if (expectedRelease) {
    const releaseContext = await browser.newContext({ serviceWorkers:'block' });
    try {
      if (protectionCookies.length) await releaseContext.addCookies(protectionCookies);
      const response=await releaseContext.request.get(origin+'/release.json', { timeout:15000 });
      const manifest=response.ok() ? await response.json() : null;
      report.releaseVerification={ status:response.status(), application:manifest?.application,
        version:manifest?.version, release:manifest?.release, physicalTapCertification:manifest?.physicalTapCertification };
      assert(response.status()===200 && manifest?.application==='nexid-web'
        && (manifest.version===expectedRelease || manifest.release===expectedRelease)
        && manifest.physicalTapCertification==='not-included','served_release_identity_mismatch');
    } finally { await releaseContext.close(); }
  }
  for (const width of report.matrix.widths) for (const theme of report.matrix.themes) for (const reducedMotion of report.matrix.reducedMotion) {
    const viewport={width,height:report.matrix.heightsByWidth[width]};
    const name = `${width}-${theme}-${reducedMotion}`, context = await browser.newContext({
      viewport, deviceScaleFactor:1, locale:'es-AR',
      isMobile:width < 768, hasTouch:width < 768, reducedMotion, serviceWorkers:'block',
    });
    await context.addCookies([...protectionCookies, { name:'theme', value:theme, url:origin }, { name:'nexid_theme_version', value:'white-first-v2', url:origin }]);
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push({ name, message:error.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,180) }));
    await context.route('**/*', route => {
      const request=route.request(), url=new URL(request.url());
      if (request.method() !== 'GET') { report.blockedWrites.push({ name, method:request.method(), origin:url.origin, path:url.pathname, category:blockedWriteCategory({method:request.method(),url,allowedClerkOrigins}), aborted:true }); return route.abort(); }
      const decision=readOnlyRequestDecision({method:request.method(),url,origin,allowedClerkOrigins});
      if (decision!=='allow-read') {
        report.blockedSensitiveReads.push({ name, origin:url.origin, path:url.pathname, reason:decision }); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      window.__geoRequests=0;
      Object.defineProperty(navigator,'geolocation',{ value:{ getCurrentPosition(){window.__geoRequests++;}, watchPosition(){window.__geoRequests++;}, clearWatch(){} } });
    });
    try {
      const response=await page.goto(origin+'/', { waitUntil:'networkidle', timeout:45000 });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.hero-immersive-media img').waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.hero-immersive-media img')].every(image => image.complete && image.naturalWidth > 0));
      await page.waitForTimeout(500); await settle(page);
      const logo=page.locator('header [data-brand-home-link][data-brand-motion]').first(), media=page.locator('.hero-immersive-media');
      check(response?.status() === 200, 'Landing HTTP200 ' + name);
      check(await page.locator('html').getAttribute('data-theme') === theme, 'Theme retained ' + name);
      check(await page.locator('h1').count() === 1 && await page.locator('h1').innerText() === 'La historia de tu producto, a un tap.', 'Published heading retained ' + name);
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), 'No horizontal overflow ' + name);
      check(await logo.getAttribute('href') === '/' && /nexID/i.test(await logo.getAttribute('aria-label') || ''), 'Logo has named home destination ' + name);
      check(await logo.locator('.brand-mark, .brand-wordmark-svg').count() === 2, 'Original public logo is visible ' + name);
      const dimensions=await logo.evaluate(element => { const link=element.getBoundingClientRect(), mark=element.querySelector('.brand-mark')?.getBoundingClientRect(), word=element.querySelector('.brand-wordmark-svg')?.getBoundingClientRect(); return { link:{ width:link.width, height:link.height }, mark:mark?{ width:mark.width,height:mark.height }:null, word:word?{ width:word.width,height:word.height }:null }; });
      check(dimensions.link.width >= 44 && dimensions.link.height >= 44 && dimensions.mark?.width > 0 && dimensions.word?.width > 0, 'Logo and home touch target fit ' + name, dimensions);
      const legibility=await logoLegibility(logo);
      check(legibility.supported && legibility.minimumRatio >= 4.5, 'Wordmark has readable theme colors ' + name, legibility);
      const actions=page.getByRole('group', { name:'Acciones principales' }), primary=actions.locator('a').first();
      check(await primary.getAttribute('href') === '/demo-lab?profile=wine' && await primary.innerText() === 'Probar un pasaporte', 'Direct illustrative primary CTA retained ' + name);
      check(await actions.locator('a[href*="contact=demo"]').innerText() === 'Agendar una demo', 'Contact CTA retained ' + name);
      check(/Tu marca publica/.test(await page.locator('h1 + p').innerText()) && /NFC o QR/.test(await page.locator('h1 + p').innerText()), 'Published information copy retained ' + name);
      check(await media.getAttribute('aria-hidden') === 'true', 'Animated hero remains decorative ' + name);
      check((await page.locator('main').innerText()).includes('Experiencia NFC ilustrativa'), 'Illustrative evidence boundary visible ' + name);
      const targets=await page.locator('header button, header [data-brand-home-link], [role="group"][aria-label="Acciones principales"] a').evaluateAll(nodes => nodes.filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden').map(element => { const rect=element.getBoundingClientRect(); return { label:element.getAttribute('aria-label') || element.textContent.trim().slice(0,50),width:rect.width,height:rect.height }; }));
      check(targets.length >= 3 && targets.every(target => target.width >= 44 && target.height >= 44), 'Primary targets at least44 ' + name, targets);
      const logoSamples=await phaseSamples(page,logo),initialHero=await snapshots(media);
      const initialLogos=await snapshots(page.locator('[data-brand-home-link][data-brand-motion]'));
      check(initialLogos.filter(item => !item.visible).every(idle), 'Initially offscreen logos have no active loops ' + name, initialLogos);
      if(initialHero[0]&&!initialHero[0].visible)check(idle(initialHero[0]),'Initially offscreen hero is idle '+name,initialHero[0]);
      // Mobile copy may place the artwork below the first viewport. In that
      // state it must pause; sample visible motion only after actual scrolling.
      await media.scrollIntoViewIfNeeded(); await page.waitForTimeout(350);
      const heroSamples=await phaseSamples(page,media);
      check(heroSamples.every(sample=>sample[0]?.visible),'Hero is actually visible while phase is sampled '+name);
      if (reducedMotion === 'no-preference') {
        check(phaseChanged(logoSamples), 'Logo changes rendered phase ' + name, logoSamples.map(sample => ({ loops:sample[0]?.loops,smil:sample[0]?.smil })));
        check(phaseChanged(heroSamples), 'Hero changes rendered phase ' + name, heroSamples.map(sample => ({ loops:sample[0]?.loops })));
      } else {
        check(!phaseChanged(logoSamples) && logoSamples.every(sample => sample.every(idle)), 'Reduced motion leaves logo still and idle ' + name, logoSamples);
        check(!phaseChanged(heroSamples) && heroSamples.every(sample => sample.every(idle)), 'Reduced motion leaves hero still and idle ' + name, heroSamples);
        const loops=await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getTiming().iterations === Infinity).map(animation => ({ name:animation.animationName, target:animation.effect?.target?.getAttribute?.('class') })));
        check(loops.length === 0, 'Reduced page has no running infinite animations ' + name, loops);
      }
      report.motionSamples.push({ name,logoSamples,initialHero,heroSamples });
      await page.evaluate(()=>scrollTo(0,0));await settle(page);
      const heading=await backdropContrast(page,page.locator('h1'),name+'-heading'), lede=await backdropContrast(page,page.locator('h1 + p'),name+'-lede');
      check(heading.supported && heading.minimumRatio >= heading.minimumRequired, 'Rendered heading contrast ' + name, heading);
      check(lede.supported && lede.minimumRatio >= lede.minimumRequired, 'Rendered introduction contrast ' + name, lede);
      await logo.focus(); await page.keyboard.press('Tab');
      const focus=await page.evaluate(() => { const cs=getComputedStyle(document.activeElement); return { tag:document.activeElement.tagName,outlineStyle:cs.outlineStyle,outlineWidth:parseFloat(cs.outlineWidth),boxShadow:cs.boxShadow }; });
      check(focus.outlineStyle !== 'none' && focus.outlineWidth >= 2 || focus.boxShadow !== 'none', 'Header keyboard focus visible ' + name, focus);
      await keyboardNavigation(page,name);
      await primary.focus(); await page.keyboard.press('Tab');
      check(await actions.evaluate(element => element.contains(document.activeElement)), 'Hero actions reachable by keyboard ' + name);
      const axeResult=await audit(page,name);
      await page.evaluate(() => scrollTo(0,0)); await settle(page);
      const file='landing-'+name+'.png'; await page.screenshot({ path:join(output,file),fullPage:true });
      const workflowHeading=page.locator('.simple-trust-flow-intro h2');
      let workflowViewportEdge=null,workflowEdgePlacement=null;
      if(width===768&&reducedMotion==='no-preference'){
        // Enter at the demonstrated viewport edge directly. Centering first
        // could already complete the observer's entry animation and hide a bug.
        workflowEdgePlacement=await workflowHeading.evaluate(element=>{
          const rect=element.getBoundingClientRect(),documentBottom=scrollY+rect.bottom;
          const requestedScrollY=documentBottom-innerHeight+8;
          const maximumScrollY=Math.max(0,document.documentElement.scrollHeight-innerHeight);
          // A compact layout can already place this heading above the edge at
          // scrollY0. The browser clamps negative scroll requests to zero.
          const reachableScrollY=Math.min(maximumScrollY,Math.max(0,requestedScrollY));
          const expectedBottomMargin=innerHeight-documentBottom+reachableScrollY;
          scrollTo({top:requestedScrollY,behavior:'instant'});
          return{documentBottom,requestedScrollY,maximumScrollY,reachableScrollY,expectedBottomMargin};
        });
      }else await workflowHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1100);
      if(width===768&&reducedMotion==='no-preference'){
        workflowViewportEdge=await workflowHeading.evaluate(element=>{const rect=element.getBoundingClientRect();return{top:rect.top,right:rect.right,bottom:rect.bottom,left:rect.left,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight,scrollY,bottomMargin:innerHeight-rect.bottom};});
        const edge=workflowViewportEdge;
        check(edge.width>0&&edge.height>0&&edge.top>=0&&edge.left>=0&&edge.right<=edge.viewportWidth&&edge.bottom<=edge.viewportHeight
          &&Math.abs(edge.scrollY-workflowEdgePlacement.reachableScrollY)<=1
          &&Math.abs(edge.bottomMargin-workflowEdgePlacement.expectedBottomMargin)<=1,
          'Workflow heading fully inside viewport at reachable8px edge '+name,{...edge,placement:workflowEdgePlacement});
      }
      const workflowInk=await workflowHeading.evaluate(element=>[element,...element.querySelectorAll('.simple-trust-flow-title-line__inner')].map(node=>{
        const cs=getComputedStyle(node),rect=node.getBoundingClientRect();return{text:node.textContent.trim(),visible:rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight,
          color:cs.color,textFill:cs.webkitTextFillColor,backgroundImage:cs.backgroundImage,opacity:cs.opacity};
      }));
      check(workflowInk.length>1&&workflowInk.every(item=>item.visible&&item.text&&item.color!=='rgba(0, 0, 0, 0)'&&item.textFill!=='rgba(0, 0, 0, 0)'&&item.backgroundImage==='none'&&parseFloat(item.opacity)>0),
        'Workflow heading and animated lines have visible solid ink '+name,workflowInk);
      const workflowContrast=await backdropContrast(page,workflowHeading,name+'-workflow-heading');
      check(workflowContrast.supported&&workflowContrast.minimumRatio>=workflowContrast.minimumRequired,'Rendered workflow heading contrast '+name,workflowContrast);
      await workflowHeading.screenshot({path:join(output,'workflow-heading-'+name+'.png')});
      await page.evaluate(() => scrollTo(0,document.documentElement.scrollHeight-innerHeight)); await page.waitForTimeout(500);
      const offscreenSamples=await phaseSamples(page,media);
      check(offscreenSamples.every(sample => sample.every(item => !item.visible && idle(item))), 'Offscreen hero pauses its CSS loops ' + name, offscreenSamples);
      const offscreenLogos=await snapshots(page.locator('[data-brand-home-link][data-brand-motion]'));
      check(offscreenLogos.filter(item => !item.visible).every(idle), 'Offscreen logos pause CSS and SMIL ' + name, offscreenLogos);
      await page.evaluate(() => scrollTo(0,0)); await page.waitForTimeout(400);
      if (reducedMotion === 'no-preference') {
        await media.scrollIntoViewIfNeeded();await page.waitForTimeout(350);
        const returned=await phaseSamples(page,media);
        check(phaseChanged(returned), 'Hero resumes after viewport return ' + name, returned.map(sample => ({ loops:sample[0]?.loops })));
      }
      check(await page.evaluate(() => window.__geoRequests === 0), 'No geolocation request ' + name);
      report.views.push({ width,height:viewport.height,theme,reducedMotion,file,heading,lede,workflowEdgePlacement,workflowViewportEdge,workflowInk,workflowContrast,axe:axeResult,dimensions });
    } catch (error) {
      check(false,'View completed ' + name,{ message:String(error.message).replace(/https?:\/\/\S+/g,'[url]').slice(0,220) });
    } finally { await context.close(); await save(); }
  }
  check(report.views.length === 20, 'Complete20view matrix');
  check(report.errors.length === 0, 'No browser exceptions',report.errors);
  report.blockedAutomaticClerkInitialization=report.blockedWrites.filter(row=>row.category==='automatic-clerk-initialization');
  report.blockedSdkTelemetry=report.blockedWrites.filter(row=>row.category==='sdk-telemetry');
  check(report.blockedWrites.every(row=>['automatic-clerk-initialization','sdk-telemetry'].includes(row.category)), 'No attempted business writes; automatic Clerk initialization and SDK telemetry were aborted',report.blockedWrites);
} finally { await browser.close(); report.browserClosed=true; await save(); }
const native=await verifyNativeBrandHeroHidden({chromiumExecutable,origin,output,protectionCookies,allowedClerkOrigins});
report.nativeHidden=native;report.hiddenPageSamples=native.observations;
report.checks.push(...native.checks);await save();
const failed=report.checks.filter(item => !item.passed);
console.log(JSON.stringify({ output,checks:report.checks.length,passed:report.checks.length-failed.length,failed,views:report.views.length,
  hiddenPageSamples:report.hiddenPageSamples.length,errors:report.errors.length,blockedWrites:report.blockedWrites.length,browserClosed:report.browserClosed },null,2));
assert.equal(failed.length,0,'brand_hero_motion_acceptance_failed');
return report;
}

// Direct CLI stays local-only. Preview/Stage/public use an ignored owner helper
// importing the same core with explicit identity and in-memory cookies.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyBrandHeroMotion({ origin:process.env.QA_ORIGIN, output:process.env.QA_OUTPUT });
}
