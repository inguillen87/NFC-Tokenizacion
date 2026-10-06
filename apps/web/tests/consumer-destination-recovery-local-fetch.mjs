if(process.env.CONSUMER_DESTINATION_RECOVERY_QA!=='1')throw Error('destination_recovery_requires_explicit_qa');
const api=new URL(process.env.CONSUMER_DESTINATION_RECOVERY_API||'');
if(api.protocol!=='http:'||api.hostname!=='127.0.0.1')throw Error('destination_recovery_requires_loopback_api');
const original=globalThis.fetch;
globalThis.fetch=async(input,init)=>{
 const url=new URL(input instanceof Request?input.url:String(input));
 const method=init?.method||(input instanceof Request?input.method:'GET');
 if(url.hostname==='api.nexid.lat'){
  const allowed=url.pathname.startsWith('/consumer/')||url.pathname==='/marketplace/products'||url.pathname==='/public/product-notices/v2'||/^\/public\/passport\/900001\/(configuration|notices)$/.test(url.pathname);
  if(method!=='GET'||!allowed)throw Error('destination_recovery_forbids_api_operation');
  const requestInit=input instanceof Request?{method:input.method,headers:input.headers,signal:input.signal,...init}:init;
  return original(new URL(url.pathname+url.search,api),requestInit);
 }
 if(url.protocol==='http:'&&url.hostname==='127.0.0.1')return original(input,init);
 throw Error('destination_recovery_forbids_external_fetch');
};
