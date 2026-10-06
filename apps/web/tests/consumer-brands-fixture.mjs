// Fixed synthetic projections for bounded local QA. No real accounts or TAPs.
export const brandsQaDate = '2026-10-01T12:00:00.000000Z';
export const brandsQaMemberships = [
  { tenant_id:'synthetic-brand-a',slug:'brand-a',name:'Marca sintética A',status:'paused',points_balance:41,joined_at:brandsQaDate },
  { tenant_id:'synthetic-brand-b',slug:'branda',name:'Marca sintética B',status:'pending',points_balance:0,joined_at:brandsQaDate },
  { tenant_id:'synthetic-brand-c',slug:'brand_c',name:'Marca sintética C',status:'active',points_balance:null,joined_at:null },
];
export const brandsQaProducts = brandsQaMemberships.map((brand,index)=>({id:`synthetic-product-${index}`,tenant_slug:brand.slug,product_name:`Producto guardado ${brand.slug}`,bid:`LOT-QA-${index}`,ownership_status:'viewed'}));
export const brandsQaTaps = brandsQaMemberships.map((brand,index)=>({tap_event_id:String(900001+index),tenant_slug:brand.slug,verdict:index===1?'QR_VIEW':'VALID_CLOSED',created_at:brandsQaDate}));
export const brandsQaCatalog = [
  {id:'synthetic-catalog-a',tenant_slug:'brand-a',title:'Producto publicado A',status:'active',request_to_buy_enabled:true,age_gate_required:false},
  {id:'synthetic-catalog-draft',tenant_slug:'brand-a',title:'Borrador no publicado',status:'draft',request_to_buy_enabled:true,age_gate_required:false},
  {id:'synthetic-catalog-withdrawn',tenant_slug:'brand-a',title:'Producto retirado',status:'withdrawn',request_to_buy_enabled:true,age_gate_required:false},
  {id:'synthetic-catalog-unknown',tenant_slug:'brand-a',title:'Estado no informado',request_to_buy_enabled:true,age_gate_required:false},
  {id:'synthetic-catalog-b',tenant_slug:'branda',title:'Producto publicado B',stock_status:'active',request_to_buy_enabled:true,age_gate_required:false},
];
export const brandsQaCases = ['ready','empty','brands-unavailable','brands-malformed','products-unavailable','taps-unavailable','catalog-unavailable','session-unavailable'];
const cookies=raw=>new Map(String(raw||'').split(';').map(part=>part.trim().split('=')).filter(part=>part.length===2));
export function consumerBrandsFixture(url,init={}){
  const requestUrl=new URL(url),method=init.method||'GET';
  if(requestUrl.origin!=='https://api.nexid.lat')return null;
  if(!['GET','HEAD'].includes(method))throw Error('consumer_brands_fixture_write_blocked');
  const headers=new Headers(init.headers),jar=cookies(headers.get('cookie')),authorized=jar.get('consumer_qa')==='local';
  const mode=jar.get('consumer_brands_case')||'ready';
  if(!brandsQaCases.includes(mode))throw Error('consumer_brands_fixture_case_invalid');
  const result=(body,status=200)=>({body,status});
  if(requestUrl.pathname==='/consumer/session')return mode==='session-unavailable'?result({ok:false},503):result({ok:true,authenticated:authorized});
  if(!['/consumer/brands','/consumer/products','/consumer/taps','/marketplace/products','/consumer/rewards','/consumer/wallet','/consumer/taps/history'].includes(requestUrl.pathname))return null;
  if(!authorized)return result({ok:false,error:'unauthorized'},401);
  const failures={'/consumer/brands':'brands-unavailable','/consumer/products':'products-unavailable','/consumer/taps':'taps-unavailable','/marketplace/products':'catalog-unavailable'};
  if(failures[requestUrl.pathname]===mode)return result({ok:false,error:'unavailable'},503);
  const lists={'/consumer/brands':brandsQaMemberships,'/consumer/products':brandsQaProducts,'/consumer/taps':brandsQaTaps,'/marketplace/products':brandsQaCatalog};
  if(Object.hasOwn(lists,requestUrl.pathname)){
    if(mode==='brands-malformed'&&requestUrl.pathname==='/consumer/brands')return result({ok:true,items:[{}]});
    let items=mode==='empty'?[]:lists[requestUrl.pathname];
    const tenant=requestUrl.searchParams.get('tenant');
    if(tenant)items=items.filter(item=>item.tenant_slug===tenant);
    return result({ok:true,items});
  }
  if(requestUrl.pathname==='/consumer/rewards')return result({ok:true,items:[],scope:'own_brands',limit:250});
  if(requestUrl.pathname==='/consumer/wallet')return result({ok:true,tenantWallets:brandsQaMemberships.map(brand=>({slug:brand.slug,name:brand.name,points_balance:brand.points_balance,lifetime_points:null})),networkWallet:{enabled:false}});
  const query=Object.fromEntries(['tenant','from','to','event'].map(key=>[key,requestUrl.searchParams.get(key)||'']));
  if(query.tenant&&!brandsQaMemberships.some(brand=>brand.slug===query.tenant))return result({ok:false,error:'invalid_query'},400);
  return result({ok:true,protocol:'nexid.consumer-history.v1',source:'database',readOnly:true,timeBasis:'saved_to_account',accountKey:'a'.repeat(64),observedAt:brandsQaDate,query,items:[],brands:brandsQaMemberships.map(({slug,name})=>({slug,name})),moreBrands:false,navigation:{page:1,pageSize:25,returned:0,hasNext:false,cursor:'synthetic_history_page_1',nextCursor:null,cutoff:brandsQaDate}});
}
