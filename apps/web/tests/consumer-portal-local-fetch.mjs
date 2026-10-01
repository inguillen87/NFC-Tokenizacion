// Explicit local QA only. Synthetic account projections and current notices;
// no PostgreSQL, production account, SUN credential or business mutation.
if(process.env.CONSUMER_PORTAL_QA!=='1')throw Error('consumer_portal_fixture_requires_explicit_local_qa');
const original=globalThis.fetch;
const date='2026-10-01T12:00:00Z';
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
  if(url.pathname==='/consumer/session')return reply({ok:true,authenticated:authorized});
  if(url.pathname.startsWith('/consumer/')){
   if(!authorized)return reply({ok:false},401);
   if(url.pathname==='/consumer/products')return reply({ok:true,items});
   if(url.pathname==='/consumer/me')return reply({ok:true,consumer:{display_name:'Cuenta sintética de ensayo',status:'verified'},stats:{products:items.length,taps:3}});
   if(url.pathname==='/consumer/brands')return reply({ok:true,items:[]});
   if(url.pathname==='/consumer/experiences')return reply({ok:true,verifiedExperiences:[]});
   if(url.pathname==='/consumer/taps')return reply({ok:true,items:items.slice(0,3).map(p=>({tap_event_id:p.latest_tap_event_id,tenant_slug:p.tenant_slug,product_name:p.product_name,bid:p.bid,verdict:p.latest_verdict,created_at:date}))});
   if(/^\/consumer\/taps\/90000[123]$/.test(url.pathname)){
    const p=items.find(p=>p.latest_tap_event_id===url.pathname.split('/').at(-1));
    return reply({ok:true,item:{tap_event_id:p.latest_tap_event_id,tenant_slug:p.tenant_slug,brand_name:p.brand_name,product_name:p.product_name,bid:p.bid,verdict:p.latest_verdict,created_at:date,risk_level:'low'}});
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
