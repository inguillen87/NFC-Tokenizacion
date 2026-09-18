// Synthetic contract fixtures. Never imported by application code or used in production.
export function healthFixture(window='24h') {
  const definitions=[['sun','persisted_adjudication_completeness',.9995,20],['canonical_event_outbox','persistence_integrity',.9999,1],['webhooks','terminal_delivery_success',.99,20],['incidents','acknowledged_within_15m',.95,5],['polygon_queue','terminal_anchor_success',.99,5],['iota_queue','terminal_confirmation_success',.99,5]];
  const now=new Date(),duration={'1h':3600000,'24h':86400000,'7d':604800000,'30d':2592000000}[window];
  const indicator=(id,target,minimumSample,total)=>({id,source:'persisted_database_aggregate',target,minimumSample,eligibleEvents:total,goodEvents:total,badEvents:0,ratio:total?1:null,errorBudgetRemaining:total?1:null,burnRate:total?0:null,evaluationWindow:window,alertThresholds:{page:6,ticket:3},state:total===0?'no_data':total<minimumSample?'insufficient_data':'healthy'});
  const services=definitions.map(([id,suffix,target,minimumSample])=>({id,name:'Upstream display text not forwarded',availability:'ready',reason:null,indicators:[indicator(id+'.'+suffix,target,minimumSample,id==='sun'?31:id==='webhooks'?100:id==='iota_queue'?3:0)],signals:[]}));
  services[2].signals=[{id:'webhooks.overdue_delivery_count',source:'persisted_database_aggregate',value:30,unit:'count',warningThreshold:1,criticalThreshold:25,state:'page'}];
  services[3].availability='unavailable';services[3].reason='query_unavailable';
  services[3].indicators[0]={...services[3].indicators[0],state:'unavailable',eligibleEvents:null,goodEvents:null,badEvents:null,ratio:null,errorBudgetRemaining:null,burnRate:null};
  services[3].indicators.push({...services[3].indicators[0],id:'incidents.terminal_disposition_within_4h',target:.9});
  return {ok:true,schemaVersion:'nexid.service-levels.v1',observedAt:now.toISOString(),scope:{kind:'tenant'},window:{id:window,startsAt:new Date(now-duration).toISOString(),endsAt:now.toISOString()},provenance:{source:'persisted_database_aggregates',synthetic:false,fixtures:false,demoExcluded:true,tenantIdentifiersExposed:false,limitation:'Database aggregates do not include pre-persistence failures'},alertPolicy:{automated:false,snapshotAlertsAreCandidates:true},services,alerts:[]};
}
export const sdkFixture=()=>({ok:true,tenant:{slug:'qa-company',name:'LOCAL QA'},usage:{monthRequests:7,avgLatencyMs:12},rows:[{key_prefix:'LOCAL_QA_DO_NOT_FORWARD',name:'not part of usage projection'}]});
