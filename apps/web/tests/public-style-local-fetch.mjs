// Test-server bootstrap only. The CSS acceptance must not contact a productive API.
const original=globalThis.fetch;
globalThis.fetch=async function(input,init){
 const address=input instanceof Request?input.url:String(input);
 const url=new URL(address);
 if(url.hostname==='api.nexid.lat'&&url.pathname==='/sun/snapshot/0'&&url.searchParams.get('trace')==='synthetic'&&url.searchParams.get('access')==='invalid'){
  return Response.json({ok:false,reason:'snapshot_not_found'},{status:404,headers:{'cache-control':'no-store'}});
 }
 if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('css_acceptance_external_fetch_blocked');
 return original(input,init);
};
