import {NexIdClient,NexIdApiError} from '@product/nexid-server-sdk';
import {API_ORIGIN,EVENT_TYPE,ConnectorError,tenantName} from './receipts.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SAFE_RESEND_MS=6*24*60*60*1000; // Less than the API's documented seven-day idempotency retention.
export function createClient({tenant,apiKey,origin=API_ORIGIN,localTest=false}) {
  tenantName(tenant);
  const target=new URL(origin);
  const local=localTest&&target.protocol==='http:'&&['127.0.0.1','localhost'].includes(target.hostname)&&apiKey?.startsWith('local-test-');
  if(origin!==API_ORIGIN&&!local)throw new ConnectorError('unapproved_api_origin');
  if(typeof apiKey!=='string'||apiKey.length<16||/[\r\n]/.test(apiKey))throw new ConnectorError('api_key_required_in_environment');
  let requests=0;
  const client=new NexIdClient({apiKey,tenantSlug:tenant,apiBaseUrl:origin,environment:local?'private':'production',timeoutMs:8000,retry:false,
    fetchImpl:async(url,options)=>{if(new URL(url).origin!==target.origin)throw new ConnectorError('unexpected_api_origin');requests++;return fetch(url,{...options,redirect:'error'});}});
  return {client,get requestCount(){return requests;}};
}
function classify(error){return error instanceof NexIdApiError&&Number.isInteger(error.status)&&error.status>0?'http_'+error.status:'transport_unconfirmed';}
function validStatus(s){return s?.ok===true&&s.operation==='reportEvent'&&s.route==='/api/v1/sdk/events'&&['completed','processing','uncertain','failed'].includes(s.state);}
export async function drain(ledger,client,{confirmTenant,limit=10}={}) {
  if(confirmTenant!==ledger.binding.tenant)throw new ConnectorError('explicit_tenant_confirmation_required');
  if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new ConnectorError('send_limit_1_to_100');
  const token=ledger.acquire();const outcomes=[];
  try {
    for(const row of ledger.pending(limit)) {
      ledger.renew(token);
      const body=JSON.parse(row.body);
      if(row.first_attempt!==null){
        let status;
        try {
          status=await client.getIdempotencyStatus('reportEvent',row.id,{maxRetries:0,timeoutMs:8000});
          if(!validStatus(status))throw new ConnectorError('invalid_status_receipt');
          if(status.state==='uncertain'){
            status=await client.reconcileIdempotency('reportEvent',row.id,{timeoutMs:8000});
            if(!validStatus(status))throw new ConnectorError('invalid_reconciliation_receipt');
          }
          if(status.operationCommitted===true&&UUID.test(status.resourceId||'')){
            ledger.finish(row.id,'committed',status.resourceId,'reconciled',token);outcomes.push({externalId:row.external_id,state:'committed',via:'reconciliation'});continue;
          }
          const state=status.state==='failed'&&status.operationCommitted===false?'blocked':'uncertain';
          ledger.finish(row.id,state,null,state==='blocked'?'server_rejected':'server_processing_or_uncertain',token);
          outcomes.push({externalId:row.external_id,state});break;
        }catch(error){
          if(!(error instanceof NexIdApiError&&error.status===404)){
            ledger.finish(row.id,'uncertain',null,classify(error),token);outcomes.push({externalId:row.external_id,state:'uncertain'});break;
          }
          // A missing key after the retention window cannot prove that the event was not committed.
          if(ledger.clock()-row.first_attempt>=SAFE_RESEND_MS||ledger.clock()<row.first_attempt){
            ledger.finish(row.id,'manual_review',null,'retry_window_elapsed',token);outcomes.push({externalId:row.external_id,state:'manual_review'});break;
          }
        }
      }
      ledger.attempt(row.id,token); // FULL synchronous SQLite commit precedes any outbound write.
      try {
        const receipt=await client.reportEvent(body,{idempotencyKey:row.id,requestId:row.id,maxRetries:0,timeoutMs:8000});
        if(receipt?.ok!==true||!UUID.test(receipt.eventId||'')||receipt.tenant?.slug!==ledger.binding.tenant||receipt.bid!==body.bid||receipt.eventType!==EVENT_TYPE)throw new ConnectorError('invalid_event_receipt');
        ledger.finish(row.id,'committed',receipt.eventId,null,token);outcomes.push({externalId:row.external_id,state:'committed'});
      }catch(error){
        const terminal=error instanceof NexIdApiError&&[400,404,409,422].includes(error.status)&&error.body?.operationCommitted!==true;
        const state=terminal?'blocked':'uncertain';
        ledger.finish(row.id,state,null,classify(error),token);outcomes.push({externalId:row.external_id,state});break;
      }
    }
    return {outcomes,...ledger.summary()};
  }finally{ledger.release(token);}
}
export async function doctor(client,tenant,bid){
  if(typeof bid!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid))throw new ConnectorError('bid_required');
  const result=await client.getProduct(bid,{timeoutMs:8000,maxRetries:0});
  if(result?.ok!==true||result.tenant?.slug!==tenant||result.batch?.bid!==bid)throw new ConnectorError('product_scope_mismatch');
  return {ok:true,tenant,bid,scopeTested:'sdk:products',writesPerformed:0,otherScopes:'not_tested'};
}
