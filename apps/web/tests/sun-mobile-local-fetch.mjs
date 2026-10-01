// Isolated production-build browser test. No external fetch, real tag or capability.
const original = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'api.nexid.lat' && /^\/sun\/snapshot\/qa-(closed|opened|replay|missing|photo-failure|missing-date|history-only)$/.test(url.pathname) && url.searchParams.get('trace') === 'synthetic' && url.searchParams.get('access') === 'invalid') {
    const state = url.pathname.split('qa-')[1];
    return Response.json({ok:true,contract:{
      ok: state !== 'replay',
      status:{code:state==='replay'?'REPLAY_SUSPECT':state==='opened'?'VALID_OPENED':'VALID_CLOSED',tone:state==='replay'?'risk':'good',productState:state==='opened'?'VALID_OPENED':'VALID_CLOSED',tamperSupported:true,tamperStatus:state==='opened'?'opened':'closed'},
      identity:{bid:'synthetic-only',uid:'qa-only',eventId:'synthetic-event',scanCount:1,tenantSlug:'qa'},
      product:{name:'Producto de ensayo',winery:'Marca de ensayo',vertical:'wine',...(state==='missing'?{}:{imageUrl:'/qa-product.svg'})},
      snapshot:{mode:'fresh_handoff'},tapSecurity:{actionability:'fresh_handoff',replayDetected:state==='replay'},
      trustSignals:{antiReplay:state!=='replay'},
      tag_tamper:{available:true,status:state==='opened'?'opened':'closed'},
      provenance:{origin:'Origen de ensayo',timelineSummary:state==='history-only'?[{eventId:'older-synthetic-event',at:'2020-01-02T03:04:00.000Z',result:'VALID_CLOSED',city:'Montevideo',country:'UY'}]:[],...(state==='history-only'?{lastVerifiedLocation:{at:'2021-02-03T04:05:00.000Z',city:'Montevideo',country:'UY'}}:{})},
      ...(state==='missing-date'?{tapContext:{timezone:'UTC'}}:state==='history-only'?{}:{tapContext:{utcTime:'2026-09-30T14:25:00.000Z',timezone:'UTC'}}),
      cta:{},
    }},{headers:{'cache-control':'no-store'}});
  }
  if (url.hostname === 'api.nexid.lat' && url.pathname === '/sun/snapshot/0') return Response.json({ok:false},{status:404});
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw Error('sun_mobile_external_fetch_blocked');
  return original(input, init);
};
