import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import * as availability from '../src/app/sun/tenant-action-availability.ts';
import { normalizeSafeReturnPath } from '@product/config/safe-return-path';
import { normalizeConsumerAuthReturnPath } from '../src/app/login/consumer-login-continuation.ts';
import { sendMarketplaceRequest } from '../src/app/me/marketplace/marketplace-request.ts';
import * as draft from '../src/app/me/marketplace/marketplace-session-draft.ts';
import * as lists from '../src/app/me/_components/consumer-list-availability.ts';

const require=createRequire(import.meta.url),css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
function compile(path,overrides){const source=readFileSync(new URL(path,import.meta.url),'utf8'),m={exports:{}};const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',js)(name=>name in overrides?overrides[name]:require(name),m,m.exports);return m.exports;}
const config={version:availability.TENANT_ACTIONS_VERSION,status:'published',allowedActions:['marketplace'],program:null,trivia:null,catalogAvailable:true,tenantSlug:'tenant-qa'};
const item={id:'synthetic-item',title:'Producto de ensayo',tenant_slug:'tenant-qa',stock_status:'active',request_to_buy_enabled:true};
const canonical=value=>typeof value==='string'&&/^[1-9]\d{0,15}$/.test(value)&&Number.isSafeInteger(Number(value));
function page(configuration=config,accountId,catalog={ok:true,items:[item]}){const calls=[],grids=[],notices=[];const Page=compile('../src/app/me/marketplace/page.tsx',{
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '../_components/consumer-api':{buildConsumerNextPath:()=>'/me/marketplace',readConsumerSession:async(_next,options)=>{assert.deepEqual(options,{includeAccountId:true});calls.push('auth');return{status:'ready',accountId};},fetchConsumerPath:async()=>{calls.push('products');return{ok:true,items:[]};},fetchMarketplacePath:async path=>{calls.push(path);return catalog;}},
  '../_components/consumer-list-availability':lists,
  '../_components/consumer-portal-recovery':{ConsumerPortalUnavailable:()=>{throw new Error('authenticated context must not become unavailable');}},
  '../_components/me-portal-interactive-client':{ConsumerDataRetryButton:()=>React.createElement('button',null,'Reintentar carga')},
  '../_components/consumer-list-recovery.module.css':css,
  '../_components/consumer-portal-model':{resolveMarketplaceTenant:({tenantFromQuery})=>tenantFromQuery},
  '../_components/portal-shell':{PortalShell:({children})=>React.createElement('main',null,children)},
  './marketplace-grid-client':{MarketplaceGridClient:props=>{grids.push(props);return React.createElement('div',null,'Synthetic catalog');},MarketplaceEmptyDraftNotice:({scope})=>{notices.push(scope);return null;}},
  './marketplace.module.css':css,
  '../../../lib/public-tenant-configuration':{configurationEventId:canonical,readPublicTenantConfiguration:async eventId=>{calls.push(['configuration',eventId]);return configuration;}},
  '../../sun/tenant-action-availability':availability,
}).default;return{calls,grids,notices,render:async params=>renderToStaticMarkup(await Page({searchParams:Promise.resolve(params)}))};}
const context={fromTap:'1',action:'marketplace',eventId:'715',tenant:'tenant-qa'};
test('SUN builders use the exact contextual discriminators preserved through portal login',()=>{
  const sun=readFileSync(new URL('../src/app/sun/page.tsx',import.meta.url),'utf8');assert.match(sun,/new URLSearchParams\(\{ fromTap: "1" \}\)/);assert.match(sun,/tapParams\.set\("eventId", eventId\)/);assert.match(sun,/withTapQuery\(marketplaceHref, "marketplace"\)/);
});
test('a validated contextual catalog forwards its event after authentication and uses server identity',async()=>{const subject=page();await subject.render({...context,tenant:'untrusted-url-brand'});assert.deepEqual(subject.calls,['auth',['configuration','715'],'products?tenant=tenant-qa']);assert.equal(subject.grids[0].postTapEventId,'715');});
test('independent browsing has no invented tap context and no public event lookup',async()=>{const subject=page();await subject.render({tenant:'tenant-qa'});assert.deepEqual(subject.calls,['auth','products','products?tenant=tenant-qa']);assert.equal(Object.hasOwn(subject.grids[0],'postTapEventId'),false);});
test('malformed contextual URLs never downgrade silently to a global inquiry',async()=>{for(const changes of[{fromTap:'0'},{fromTap:['1','1']},{action:'claim'},{eventId:'0'},{eventId:'01'},{eventId:'715\n'},{eventId:'9007199254740993'},{eventId:undefined},{action:undefined}]){const subject=page(),html=await subject.render({...context,...changes});assert.deepEqual(subject.calls,['auth']);assert.equal(subject.grids.length,0);assert.match(html,/Las consultas desde esta lectura no están disponibles/);assert.match(html,/href="\/me\/marketplace"/);}});
test('withdrawn or missing canonical company configuration hides only contextual inquiries',async()=>{for(const configuration of[null,{...config,tenantSlug:null},{...config,tenantSlug:undefined},{...config,status:'unpublished'},{...config,status:'unavailable'},{...config,catalogAvailable:false},{...config,allowedActions:[]}]){const subject=page(configuration),html=await subject.render(context);assert.deepEqual(subject.calls,['auth',['configuration','715']]);assert.equal(subject.grids.length,0);assert.match(html,/Volver al catálogo/);assert.match(html,/Ver mi wallet/);}});
test('a draft binding comes from the authenticated account and canonical catalog only', async () => {
  const accountA = '96a0d192-6ef5-490c-a38e-f7823035a321';
  const accountB = '96a0d192-6ef5-490c-a38e-f7823035a322';
  const scope = async (params, configuration, account = accountA) => {
    const subject = page(configuration, account);
    const html = await subject.render(params);
    assert.ok(!html.includes(account));
    return subject.grids[0]?.draftScope;
  };
  const contextual = await scope(context, config);
  assert.match(contextual, /^[a-z0-9_-]{43}$/i);
  assert.equal(await scope({...context, tenant:'another-query'}, config), contextual);
  assert.notEqual(await scope({...context, eventId:'716'}, config), contextual);
  assert.notEqual(await scope(context, config, accountB), contextual);
  assert.notEqual(await scope(context, {...config, tenantSlug:'other.qa'}), contextual);
  assert.notEqual(await scope({tenant:'tenant-qa'}, config), contextual);
  assert.equal(await scope(context, {...config, allowedActions:[]}), undefined);
});
test('only confirmed empty catalogs consume an unavailable selection', async () => {
  const account = '96a0d192-6ef5-490c-a38e-f7823035a321';
  const empty = page(config, account, {ok:true,items:[]});
  assert.match(await empty.render(context), /Todavía no hay productos publicados/);
  assert.match(empty.notices[0], /^[a-z0-9_-]{43}$/i);
  const unavailable = page(config, account, null);
  assert.match(await unavailable.render(context), /No pudimos cargar el catálogo/);
  assert.deepEqual(unavailable.notices, []);
});
const Grid=compile('../src/app/me/marketplace/marketplace-grid-client.tsx',{'./marketplace.module.css':css,'./marketplace-request':{sendMarketplaceRequest},'./marketplace-session-draft':draft,'@product/config/safe-return-path':{normalizeSafeReturnPath},'../../login/consumer-login-continuation':{normalizeConsumerAuthReturnPath}}).MarketplaceGridClient;
test('invalid direct client props deny handlers and never fabricate a purchase',()=>{const html=renderToStaticMarkup(React.createElement(Grid,{items:[item],postTapEventId:'../715'}));assert.match(html,/Las consultas desde esta lectura ya no están disponibles/);assert.match(html,/<button[^>]+disabled=""[^>]*>Solicitar contacto/);assert.doesNotMatch(html,/Compra confirmada|Pago realizado|Sumaste puntos/);});
