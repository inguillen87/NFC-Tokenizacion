// Explicit local QA only. Synthetic account projections and current notices;
// no PostgreSQL, production account, SUN credential or business mutation.
import { marketplaceFixtureItems } from './consumer-marketplace-fixture.mjs';
if(process.env.CONSUMER_PORTAL_QA!=='1')throw Error('consumer_portal_fixture_requires_explicit_local_qa');
const original=globalThis.fetch;
const date='2026-10-01T12:00:00Z';
const currentEditorial=(state='published')=>({protocol:'nexid.current-editorial.v1',source:'passport_studio',state,observedAt:'2026-10-05T15:00:00Z',version:3,publishedAt:'2026-10-04T15:00:00Z',contentDigest:'a'.repeat(64),
 document:{schemaVersion:'nexid.passport-editorial.v1',template:'agro',locale:'es-AR',identity:{product_name:'Ficha actual de ensayo',public_lot_label:'LOTE-PUBLICADO-QA',sku:null,winery:'Empresa publicada de ensayo',region:null,image_url:null},agro_product_profile:{technicalSheetUrl:'https://docs.example.test/current-qa.pdf',safetySheetUrl:null}}});
const items=[
 {product_name:'Vino reserva QA',brand_name:'Bodega de ensayo',tenant_slug:'consumer-qa',bid:'LOT-WINE-QA',latest_tap_event_id:'900001',latest_verdict:'VALID_CLOSED',latest_tap_at:date,created_at:date,ownership_status:'viewed'},
 {product_name:'Aceite de oliva QA',brand_name:'Oliva de ensayo',tenant_slug:'olive-qa',bid:'LOT-OLIVE-QA',latest_tap_event_id:'900002',latest_verdict:'QR_VIEW',latest_tap_at:date,created_at:date,ownership_status:'viewed'},
 {product_name:'Producto sin lote QA',latest_tap_event_id:'900003',latest_verdict:'QR_VIEW'},
 ...Array.from({length:12},(_,index)=>({product_name:'Producto de ensayo '+(index+1),brand_name:'Bodega de ensayo',tenant_slug:'consumer-qa',bid:'LOT-WINE-QA',latest_tap_event_id:String(900010+index),ownership_status:'pending'})),
];
const reply=(body,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 if(url.hostname==='api.nexid.lat'){
  const method=init?.method||(input instanceof Request?input.method:'GET');
  if(method!=='GET'&&method!=='HEAD')throw Error('consumer_portal_business_write_blocked');
  const headers=new Headers(init?.headers||(input instanceof Request?input.headers:undefined));
  const authorized=(headers.get('cookie')||'').includes('consumer_qa=local');
  const photoQa=/(?:^|;\s*)consumer_photo_qa=(failed|updated)(?:;|$)/.exec(headers.get('cookie')||'')?.[1];
  if(url.pathname==='/consumer/session')return reply({ok:true,authenticated:authorized});
  if(/^\/public\/passport\/90000[123]\/configuration$/.test(url.pathname)){
   if(headers.has('cookie')||headers.has('authorization'))throw Error('public_configuration_must_not_forward_account_credentials');
   const tenantSlug=items.find(item=>item.latest_tap_event_id===url.pathname.split('/')[3])?.tenant_slug||null;
   return reply({ok:true,configuration:{version:'nexid.tenant-actions.v1',status:'published',allowedActions:tenantSlug==='consumer-qa'?['marketplace','feedback']:['marketplace'],program:null,trivia:null,catalogAvailable:true,tenantSlug}});
  }
  if(url.pathname==='/marketplace/products'){
   if(!authorized)return reply({ok:false},401);
   return reply({ok:true,items:url.searchParams.get('tenant')==='qa-empty'?[]:marketplaceFixtureItems});
  }
  if(url.pathname.startsWith('/consumer/')){
   if(!authorized)return reply({ok:false},401);
   if(url.pathname==='/consumer/products')return reply({ok:true,items:photoQa?items.map((item,index)=>index===0?{...item,image_url:photoQa==='failed'?'/qa-photo/failed.svg':'/qa-photo/updated.svg'}:item):items});
   if(url.pathname==='/consumer/me')return reply({ok:true,consumer:{id:'synthetic-portal-consumer',display_name:'Cuenta sintética de ensayo',status:'verified'},stats:{products:items.length,taps:3}});
   // An explicit local-only partial-load state exposes the real router.refresh
   // control for the image recovery regression. No production data is queried.
   if(url.pathname==='/consumer/brands')return photoQa?reply({ok:false},503):reply({ok:true,items:[]});
   if(url.pathname==='/consumer/experiences')return reply({ok:true,verifiedExperiences:[]});
   if(url.pathname==='/consumer/taps')return reply({ok:true,items:items.slice(0,3).map(p=>({tap_event_id:p.latest_tap_event_id,tenant_slug:p.tenant_slug,product_name:p.product_name,bid:p.bid,verdict:p.latest_verdict,created_at:date}))});
   if(/^\/consumer\/taps\/90000[123]$/.test(url.pathname)){
    const p=items.find(p=>p.latest_tap_event_id===url.pathname.split('/').at(-1));
    return reply({ok:true,currentEditorial:currentEditorial(p.latest_tap_event_id==='900001'?'published':p.latest_tap_event_id==='900002'?'withdrawn':'unavailable'),item:{tap_event_id:p.latest_tap_event_id,tenant_slug:p.tenant_slug,brand_name:p.brand_name,product_name:p.product_name,historical_brand_name:p.brand_name??null,historical_product_name:p.product_name??null,bid:p.bid,verdict:p.latest_verdict,created_at:date,risk_level:'low'}});
   }
   return reply({ok:false},404);
  }
  if(url.pathname==='/public/product-notices/v2'){
   const tenant=url.searchParams.get('tenant'),bid=url.searchParams.get('bid');
   const notices=tenant==='consumer-qa'?[{id:'10000000-0000-4000-8000-000000000001',kind:'recall',title:'Aviso de ensayo local',message:'Aviso sintético para comprobar la lectura de restricciones.',instructions:'Consultá a la marca antes de usar este lote de ensayo.',contact:'Contacto de la marca de ensayo',publishedAt:date,trackingState:'active',noticeState:'active',noticeVersion:1,effectiveAt:date,resolutionMessage:null}]:[];
   return reply({ok:true,protocol:'nexid.product-notices.v2',scope:{tenant,bid},observedAt:date,notices,total:notices.length,hasMore:false,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true});
  }
  return reply({ok:false},404);
 }
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('consumer_portal_external_fetch_blocked');
 return original(input,init);
};
