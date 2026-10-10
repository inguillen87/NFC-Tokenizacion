// Synthetic read-only API for destination recovery. Never contacts a provider/DB.
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
export async function createDestinationRecoveryFixture(){
 const requests=[];
 const scenarios=new Set(['ready','empty','session-500','session-401','session-false','session-malformed','session-network','session-headers-stall','session-body-stall','brands-unavailable','brands-malformed','catalog-unavailable','catalog-malformed','products-unavailable','taps-unavailable']);
 const brand={slug:'loading-qa',name:'Marca local QA',status:'active',points_balance:0};
 const product={id:'00000000-0000-4000-8000-000000000002',product_name:'Producto local QA',brand_name:brand.name,tenant_slug:brand.slug,bid:'LOT-QA',latest_tap_event_id:'900001',first_tap_event_id:'900001',ownership_status:'viewed',latest_verdict:'VALID_CLOSED',created_at:'2026-10-05T12:00:00Z',latest_tap_at:'2026-10-05T12:00:00Z'};
 const listing={id:'00000000-0000-4000-8000-000000000001',title:'Catálogo local QA',tenant_slug:brand.slug,brand_name:brand.name,stock_status:'active',request_to_buy_enabled:true,age_gate_required:false,cash_price:120};
 const historyAccount=createHash('sha256').update('consumer-history:synthetic-only').digest('hex');
 const historyCutoff='2026-10-06T12:00:00.000000Z',savedAt='2026-10-05T12:00:00.000123Z';
 function historyResponse(url,scenario){
  const p=url.searchParams;
  if([...p.keys()].some(key=>!['tenant','from','to','event','cursor'].includes(key)||p.getAll(key).length!==1))return null;
  const query={tenant:p.get('tenant')||'',from:p.get('from')||'',to:p.get('to')||'',event:p.get('event')||''};
  const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
  if(query.tenant&&!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(query.tenant)||query.event&&(!/^[1-9][0-9]{0,18}$/.test(query.event)||BigInt(query.event)>9223372036854775807n))return null;
  if(Boolean(query.from)!==Boolean(query.to)||query.from&&(!day(query.from)||!day(query.to)||Date.parse(query.to)<Date.parse(query.from)||Date.parse(query.to)-Date.parse(query.from)>=366*86400000))return null;
  const cursor=Buffer.from(JSON.stringify({v:1,account:historyAccount,query,cutoff:historyCutoff,page:1,last:null})).toString('base64url');
  if(p.has('cursor')&&p.get('cursor')!==cursor)return null;
  const included=scenario!=='empty'&&(!query.tenant||query.tenant===brand.slug)&&(!query.event||query.event==='900001')&&(!query.from||savedAt>=query.from+'T00:00:00Z'&&Date.parse(savedAt)<Date.parse(query.to)+86400000);
  const items=included?[{row_id:'900001',tap_event_id:'900001',created_at:savedAt,verdict:'VALID_CLOSED',risk_level:'low',city:null,country:null,tenant_slug:brand.slug,tenant_name:brand.name,product_name:product.product_name,brand_name:brand.name}]:[];
  return{ok:true,protocol:'nexid.consumer-history.v1',source:'database',accountKey:historyAccount,observedAt:'2026-10-06T12:00:00Z',query,items,brands:scenario==='empty'?[]:[{slug:brand.slug,name:brand.name}],moreBrands:false,navigation:{page:1,pageSize:25,returned:items.length,hasNext:false,cursor,nextCursor:null,cutoff:historyCutoff},timeBasis:'saved_to_account',readOnly:true};
 }
 const server=createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),path=url.pathname;
  const requested=/(?:^|;\s*)consumer_loading_qa=([^;]+)/.exec(req.headers.cookie||'')?.[1];
  const scenario=scenarios.has(requested)?requested:'session-401';
  const row={path,query:url.search,scenario,method:req.method,responseStatus:null,injectedFailure:null,closedBeforeEnd:false,cookieForwarded:Boolean(req.headers.cookie),authorizationForwarded:Boolean(req.headers.authorization)};requests.push(row);
  res.on('close',()=>{row.closedBeforeEnd=!res.writableEnded;});
  res.setHeader('cache-control','no-store');res.setHeader('content-type','application/json');
  const reply=(body,status=200)=>{row.responseStatus=status;res.writeHead(status);res.end(JSON.stringify(body));};
  if(req.method!=='GET')return reply({ok:false,error:'fixture_writes_forbidden'},405);
  if(path==='/consumer/session'){
   if(scenario==='session-headers-stall'){row.injectedFailure='stalled-headers';return;}
   if(scenario==='session-body-stall'){row.injectedFailure='stalled-body';row.responseStatus=200;res.writeHead(200);res.flushHeaders();res.write('{"ok":true,"authenticated":');return;}
   if(scenario==='session-network'){row.injectedFailure='socket-disconnected';req.socket.destroy();return;}
   if(scenario==='session-500'){row.injectedFailure='http-500';return reply({ok:true,authenticated:true},500);}
   if(scenario==='session-malformed'){row.injectedFailure='invalid-json';row.responseStatus=200;res.writeHead(200);res.end('{malformed');return;}
   if(scenario==='session-401')return reply({ok:false,authenticated:false},401);
   if(scenario==='session-false')return reply({ok:true,authenticated:false});
   return reply({ok:true,authenticated:true,consumer:{id:'synthetic-only'}});
  }
  if(path==='/public/passport/900001/configuration'){row.scenario='public-read-only';return reply({ok:true,configuration:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:['marketplace'],program:null,trivia:null,catalogAvailable:true,tenantSlug:brand.slug}});}
  if(path==='/public/passport/900001/notices'){row.scenario='public-read-only';return reply({ok:true,items:[]});}
  if(path==='/public/product-notices/v2'){
   row.scenario='public-read-only';
   if(url.searchParams.get('tenant')!==brand.slug||url.searchParams.get('bid')!==product.bid||[...url.searchParams.keys()].some(key=>!['tenant','bid'].includes(key)||url.searchParams.getAll(key).length!==1))return reply({ok:false,reason:'fixture_public_scope_invalid'},400);
   return reply({ok:true,protocol:'nexid.product-notices.v2',scope:{tenant:brand.slug,bid:product.bid},observedAt:'2026-10-06T12:00:00Z',notices:[],total:0,hasMore:false,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true});
  }
  if(scenario.startsWith('session-'))return reply({ok:false,error:'fixture_private_denied'},401);
  if(path==='/consumer/me')return reply({ok:true,consumer:{id:'synthetic-only',display_name:'Cuenta local QA',email:'qa@example.invalid',status:'registered'},stats:{products:1,taps:1,memberships:0},memberships:[]});
  if(path==='/consumer/products')return scenario==='products-unavailable'?reply({ok:false,error:'fixture_unavailable'},503):reply({ok:true,items:scenario==='empty'?[]:[product]});
  if(path==='/consumer/brands')return scenario==='brands-unavailable'?reply({ok:false,error:'fixture_unavailable'},503):reply(scenario==='brands-malformed'?{ok:true,items:[null]}:{ok:true,items:scenario==='empty'?[]:[brand]});
  if(path==='/consumer/taps')return scenario==='taps-unavailable'?reply({ok:false,error:'fixture_unavailable'},503):reply({ok:true,items:[],limit:200,truncated:false});
  if(path==='/consumer/taps/history'){
   const history=historyResponse(url,scenario);
   return history?reply(history):reply({ok:false,error:'history_query_invalid'},400);
  }
  if(path==='/consumer/taps/900001')return reply({ok:true,item:{tap_event_id:'900001',verdict:'VALID_CLOSED',risk_level:'low',created_at:'2026-10-05T12:00:00Z',tenant_slug:brand.slug,tenant_name:brand.name,product_name:product.product_name,bid:product.bid}});
  if(path==='/consumer/wallet')return reply({ok:true,tenantWallets:[],networkWallet:{enabled:false},certificates:[],ownerships:[],nfts:[],balances:[]});
  if(path==='/consumer/rewards')return reply({ok:true,items:[]});
  if(path==='/consumer/experiences')return reply({ok:true,items:[],offers:[]});
  if(path==='/consumer/privacy')return reply({ok:true,consumer:{display_name:'Cuenta local QA',preferred_locale:'es-AR'},consents:[]});
  if(path==='/marketplace/products')return scenario==='catalog-unavailable'?reply({ok:false,error:'fixture_unavailable'},503):reply(scenario==='catalog-malformed'?{ok:true,items:[null]}:{ok:true,items:scenario==='empty'?[]:[listing]});
  return reply({ok:false,error:'fixture_route_unknown'},404);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return{origin:`http://127.0.0.1:${server.address().port}`,requests,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
