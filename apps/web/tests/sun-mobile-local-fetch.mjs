// Isolated production-build browser test. No external fetch, real tag or capability.
const original = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'api.nexid.lat') console.log('SUN_QA_READ '+url.pathname);
  if (url.hostname === 'api.nexid.lat' && /^\/sun\/snapshot\/qa-(denied|unavailable|malformed|transport)$/.test(url.pathname)) {
    const failure=url.pathname.split('qa-')[1];
    if(failure==='transport')throw Error('synthetic_transport_failure');
    if(failure==='malformed')return Response.json({ok:true,contract:{}});
    return Response.json({ok:false},{status:failure==='denied'?403:503});
  }
  if (url.hostname === 'api.nexid.lat' && /^\/sun\/snapshot\/qa-(closed|opened|replay|missing|photo-failure|missing-date|history-only|seal-unknown|unsupported|historical-closed|manual-opened|invalid)$/.test(url.pathname) && url.searchParams.get('trace') === 'synthetic' && url.searchParams.get('access') === 'invalid') {
    const state = url.pathname.split('qa-')[1];
    const statusCode=state==='manual-opened'?'MANUAL_OPENED':state==='replay'?'REPLAY_SUSPECT':state==='invalid'?'INVALID':state==='opened'?'VALID_OPENED':state==='seal-unknown'?'VALID_UNKNOWN_TAMPER':state==='unsupported'?'AUTH_OK':'VALID_CLOSED';
    const seal=state==='seal-unknown'?'unknown':state==='unsupported'?'not_available':state==='opened'?'opened':'closed';
    return Response.json({ok:true,contract:{
      ok: !['replay','invalid'].includes(state),
      status:{code:statusCode,tone:['replay','invalid'].includes(state)?'risk':'good',productState:state==='manual-opened'?'VALID_MANUAL_OPENED':statusCode,tamperSupported:state!=='unsupported',tamperStatus:seal,...(state==='unsupported'?{carrierProfileCode:'ntag424_dna'}:{})},
      identity:{bid:'synthetic-only',uid:'qa-only',eventId:'synthetic-event',scanCount:1,tenantSlug:'qa'},
      product:{name:'Producto de ensayo',winery:'Marca de ensayo',vertical:'wine',...(state==='missing'?{}:{imageUrl:'/qa-product.svg'})},
      snapshot:{mode:state==='historical-closed'?'readonly':'fresh_handoff'},tapSecurity:{actionability:state==='historical-closed'?'snapshot':'fresh_handoff',replayDetected:state==='replay'},
      trustSignals:{antiReplay:state!=='replay'},
      tag_tamper:{available:state!=='unsupported',status:seal},
      provenance:{origin:'Origen de ensayo',timelineSummary:state==='history-only'?[{eventId:'older-synthetic-event',at:'2020-01-02T03:04:00.000Z',result:'VALID_CLOSED',city:'Montevideo',country:'UY'}]:[],...(state==='history-only'?{lastVerifiedLocation:{at:'2021-02-03T04:05:00.000Z',city:'Montevideo',country:'UY'}}:{})},
      ...(state==='missing-date'?{tapContext:{timezone:'UTC'}}:state==='history-only'?{}:{tapContext:{utcTime:'2026-09-30T14:25:00.000Z',timezone:'UTC'}}),
      cta:{},
    }},{headers:{'cache-control':'no-store'}});
  }
  if (url.hostname === 'api.nexid.lat' && url.pathname === '/sun/snapshot/0') return Response.json({ok:false},{status:404});
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) throw Error('sun_mobile_external_fetch_blocked');
  return original(input, init);
};
