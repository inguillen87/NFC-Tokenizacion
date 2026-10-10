// Local-only synthetic consumer API projections for the real Next production
// build. All provider traffic and every write are blocked before transport.
import {appendFile} from 'node:fs/promises';

if (process.env.CONSUMER_ENGAGEMENT_QA !== '1') throw Error('consumer_engagement_fixture_requires_explicit_local_qa');
const original = globalThis.fetch;
const auditPath = process.env.QA_API_AUDIT;
if (!auditPath) throw Error('consumer_engagement_fixture_requires_audit_path');
const fixtureApiOrigin = process.env.CONSUMER_ENGAGEMENT_API_ORIGIN || 'https://api.nexid.lat';
if (fixtureApiOrigin !== 'https://api.nexid.lat' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(fixtureApiOrigin)) throw Error('consumer_engagement_fixture_requires_pinned_api_origin');
const date = '2026-10-03T12:00:00Z';
const product = {product_name:'Vino de ensayo QA',brand_name:'Bodega sintética',tenant_slug:'consumer-qa',bid:'LOT-ENGAGEMENT-QA',latest_tap_event_id:'900001',latest_verdict:'VALID_CLOSED',latest_tap_at:date,created_at:date,ownership_status:'viewed'};
const offers = [
 {id:'30000000-0000-4000-8000-000000000001',title:'Visita de ensayo a la bodega',tenant_slug:'consumer-qa',points_cost:999,can_claim:true},
 {id:'30000000-0000-4000-8000-000000000002',title:'Propuesta sin marca informada',tenant_slug:'../foreign'},
];
const reviews = [
 {id:'20000000-0000-4000-8000-000000000001',product_name:product.product_name,tenant_slug:'consumer-qa',rating:4,title:'Comentario sintético de ensayo',body:'Disfruté este producto de ensayo. Esta opinión solo valida la interfaz local.',moderation_status:'approved',visibility:'public',brand_response:'Gracias por tu comentario de ensayo. <script>window.__fixtureScriptExecuted = true</script>',verification_badges:['nfc_event_linked','consumer_session_authenticated','consumer_supplied_photo'],trust_score:null,trust_score_status:'not_computed'},
 {id:'20000000-0000-4000-8000-000000000002',product_name:'Producto de ensayo pendiente',tenant_slug:'consumer-qa',body:'Comentario pendiente de revisión, sin puntaje informado.',moderation_status:'pending',visibility:'private',rating:null,brand_response:null,verification_badges:[],trust_score:99,trust_score_status:'not_computed'},
];
const reply = (body,status=200) => Response.json(body,{status,headers:{'cache-control':'no-store'}});
async function audit(item) { await appendFile(auditPath,JSON.stringify(item)+'\n'); }
globalThis.fetch = async (input,init) => {
 const url = new URL(input instanceof Request ? input.url : String(input));
 const method = init?.method || (input instanceof Request ? input.method : 'GET');
 const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
 const cookies = headers.get('cookie') || '';
 const authorized = /(?:^|;\s*)consumer_qa=local(?:;|$)/.test(cookies);
 const scenario = cookies.match(/(?:^|;\s*)consumer_engagement_scenario=([a-z-]+)(?:;|$)/)?.[1] || 'anonymous';
 if (!['GET','HEAD'].includes(method)) {
  await audit({path:url.pathname,method,scenario,authorized,blocked:'write'});
  throw Error('consumer_engagement_write_blocked');
 }
 if (url.origin === fixtureApiOrigin) {
  await audit({path:url.pathname,method,scenario,authorized,fixture:true});
  if (url.pathname === '/consumer/session') return reply({ok:true,authenticated:authorized});
  if (url.pathname.startsWith('/consumer/')) {
   if (!authorized) return reply({ok:false,error:'unauthorized'},401);
   if (url.pathname === '/consumer/experiences') {
    if (scenario === 'unavailable') return reply({ok:false,error:'synthetic_unavailable'},503);
    if (scenario === 'empty') return reply({ok:true,items:[],verifiedExperiences:[]});
    if (scenario === 'partial-review-failure') return reply({ok:true,items:offers,verifiedExperiences:null});
    if (scenario === 'partial-offer-failure') return reply({ok:true,items:null,verifiedExperiences:reviews});
    return reply({ok:true,items:offers,verifiedExperiences:reviews});
   }
   if (url.pathname === '/consumer/products') return reply({ok:true,items:[product]});
   if (url.pathname === '/consumer/me') return reply({ok:true,consumer:{id:'synthetic-engagement-consumer',display_name:'Cuenta sintética de ensayo',status:'verified'},stats:{products:1,taps:1}});
   if (url.pathname === '/consumer/brands') return reply({ok:true,items:[]});
   if (url.pathname === '/consumer/taps') return reply({ok:true,items:[{tap_event_id:product.latest_tap_event_id,tenant_slug:product.tenant_slug,product_name:product.product_name,bid:product.bid,verdict:product.latest_verdict,created_at:date}]});
   if (url.pathname === '/consumer/taps/900001') return reply({ok:true,item:{tap_event_id:product.latest_tap_event_id,tenant_slug:product.tenant_slug,product_name:product.product_name,bid:product.bid,verdict:product.latest_verdict,created_at:date,risk_level:'low'}});
   return reply({ok:false,error:'synthetic_read_not_available'},404);
  }
  return reply({ok:false,error:'synthetic_read_not_available'},404);
 }
 if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
  await audit({path:url.pathname,method,scenario,authorized,blocked:'external'});
  throw Error('consumer_engagement_external_fetch_blocked');
 }
 return original(input,init);
};
