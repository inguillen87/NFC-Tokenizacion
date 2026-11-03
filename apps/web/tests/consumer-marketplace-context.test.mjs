import * as bounded from "../src/app/me/_components/consumer-bounded-fetch.ts";
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
import * as lists from '../src/app/me/_components/consumer-list-availability.ts';

const require=createRequire(import.meta.url),css={__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})};
function compile(path,overrides){const source=readFileSync(new URL(path,import.meta.url),'utf8'),m={exports:{}};const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;new Function('require','module','exports',js)(name=>name in overrides?overrides[name]:require(name),m,m.exports);return m.exports;}
const config={version:availability.TENANT_ACTIONS_VERSION,status:'published',allowedActions:['marketplace'],program:null,trivia:null,catalogAvailable:true,tenantSlug:'tenant-qa'};
const item={id:'synthetic-item',title:'Producto de ensayo',tenant_slug:'tenant-qa',stock_status:'active',request_to_buy_enabled:true};
const canonical=compile('../src/lib/public-tenant-configuration.ts',{
  "@product/config": { productUrls: { api: "https://api.example.invalid" } },
  "../app/me/_components/consumer-bounded-fetch": bounded,
  "../app/sun/tenant-action-availability": availability,
  "../app/api/_lib/server-api-transport": { fetchRuntimeApi: () => { throw Error("Unexpected default network read"); } },
}).configurationEventId;
function page(configuration=config){const calls=[],grids=[];const Page=compile('../src/app/me/marketplace/page.tsx',{
  'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},
  '../_components/consumer-api':{buildConsumerNextPath:()=>'/me/marketplace',readConsumerSession:async()=>{calls.push('auth');return{status:'ready'};},fetchConsumerPath:async()=>{calls.push('products');return{ok:true,items:[]};},fetchMarketplacePath:async path=>{calls.push(path);return{ok:true,items:[item]};}},
  '../_components/consumer-list-availability':lists,
  '../_components/consumer-portal-recovery':{ConsumerPortalUnavailable:()=>{throw new Error('authenticated context must not become unavailable');}},
  '../_components/me-portal-interactive-client':{ConsumerDataRetryButton:()=>React.createElement('button',null,'Reintentar carga')},
  '../_components/consumer-list-recovery.module.css':css,
  '../_components/consumer-portal-model':{resolveMarketplaceTenant:({tenantFromQuery})=>tenantFromQuery},
  '../_components/portal-shell':{PortalShell:({children})=>React.createElement('main',null,children)},
  './marketplace-grid-client':{MarketplaceGridClient:props=>{grids.push(props);return React.createElement('div',null,'Synthetic catalog');}},
  './marketplace.module.css':css,
  '../../../lib/public-tenant-configuration':{configurationEventId:canonical,readPublicTenantConfiguration:async eventId=>{calls.push(['configuration',eventId]);return configuration;}},
  '../../sun/tenant-action-availability':availability,
}).default;return{calls,grids,render:async params=>renderToStaticMarkup(await Page({searchParams:Promise.resolve(params)}))};}
const context={fromTap:'1',action:'marketplace',eventId:'715',tenant:'tenant-qa'};
test('SUN builders use the exact contextual discriminators preserved through portal login',()=>{
  const sun=readFileSync(new URL('../src/app/sun/page.tsx',import.meta.url),'utf8');assert.match(sun,/new URLSearchParams\(\{ fromTap: "1" \}\)/);assert.match(sun,/tapParams\.set\("eventId", eventId\)/);assert.match(sun,/withTapQuery\(marketplaceHref, "marketplace"\)/);
});
test('a validated contextual catalog forwards its event after authentication and uses server identity',async()=>{const subject=page();await subject.render({...context,tenant:'untrusted-url-brand'});assert.deepEqual(subject.calls,['auth',['configuration','715'],'products?tenant=tenant-qa']);assert.equal(subject.grids[0].postTapEventId,'715');});
test('independent browsing has no invented tap context and no public event lookup',async()=>{const subject=page();await subject.render({tenant:'tenant-qa'});assert.deepEqual(subject.calls,['auth','products','products?tenant=tenant-qa']);assert.equal(Object.hasOwn(subject.grids[0],'postTapEventId'),false);});
test('malformed contextual URLs never downgrade silently to a global inquiry',async()=>{for(const changes of[{fromTap:'0'},{fromTap:['1','1']},{action:'claim'},{eventId:'0'},{eventId:'01'},{eventId:'715\n'},{eventId:'9223372036854775808'},{eventId:'1\n'},{eventId:'١'},{eventId:'１２'},{eventId:1},{eventId:undefined},{action:undefined}]){const subject=page(),html=await subject.render({...context,...changes});assert.deepEqual(subject.calls,['auth']);assert.equal(subject.grids.length,0);assert.match(html,/Las consultas desde esta lectura no están disponibles/);assert.match(html,/href="\/me\/marketplace"/);}});
test('withdrawn or missing canonical company configuration hides only contextual inquiries',async()=>{for(const configuration of[null,{...config,tenantSlug:null},{...config,tenantSlug:undefined},{...config,status:'unpublished'},{...config,status:'unavailable'},{...config,catalogAvailable:false},{...config,allowedActions:[]}]){const subject=page(configuration),html=await subject.render(context);assert.deepEqual(subject.calls,['auth',['configuration','715']]);assert.equal(subject.grids.length,0);assert.match(html,/Volver al catálogo/);assert.match(html,/Ver mi wallet/);}});
const Grid=compile('../src/app/me/marketplace/marketplace-grid-client.tsx',{'./marketplace.module.css':css,'./marketplace-request':{sendMarketplaceRequest},'@product/config/safe-return-path':{normalizeSafeReturnPath},'../../login/consumer-login-continuation':{normalizeConsumerAuthReturnPath}}).MarketplaceGridClient;
test('invalid direct client props deny handlers and never fabricate a purchase',()=>{const html=renderToStaticMarkup(React.createElement(Grid,{items:[item],postTapEventId:'../715'}));assert.match(html,/Las consultas desde esta lectura ya no están disponibles/);assert.match(html,/<button[^>]+disabled=""[^>]*>Solicitar contacto/);assert.doesNotMatch(html,/Compra confirmada|Pago realizado|Sumaste puntos/);});

test('large canonical TAP context never falls back to an unscoped catalogue and retains server tenant',async()=>{
 for(const id of ['9007199254740992','9007199254740993','9223372036854775806','9223372036854775807']){
  const subject=page(),html=await subject.render({...context,eventId:id,tenant:'untrusted-url-brand'});
  assert.deepEqual(subject.calls,['auth',['configuration',id],'products?tenant=tenant-qa']);
  assert.equal(subject.grids.length,1);assert.equal(subject.grids[0].postTapEventId,id);assert.equal(typeof subject.grids[0].postTapEventId,'string');
  assert.doesNotMatch(html,/Las consultas desde esta lectura no están disponibles|href="\/me\/marketplace"/);
 }
});
