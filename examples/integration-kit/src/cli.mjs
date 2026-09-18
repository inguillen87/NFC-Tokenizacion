import {readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {parseArgs} from 'node:util';
import {API_ORIGIN,ConnectorError,parseReceiptCsv,receiptOperation,tenantName,connectorName} from './receipts.mjs';
import {Ledger} from './ledger.mjs';
import {createClient,doctor,drain} from './connector.mjs';
import {webhookServer} from './webhook.mjs';
const USAGE='node src/cli.mjs <plan|send|status|doctor|webhook> --tenant YOUR-TENANT --connector erp-main [--file receipts.csv] [--confirm-tenant YOUR-TENANT] [--limit 10] [--bid BID] [--tenant-id UUID] [--port 8788]';
let ledger;
try {
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<24||(major===24&&minor<14))throw new ConnectorError('node_24_14_required');
  const {positionals,values:v}=parseArgs({allowPositionals:true,strict:true,options:{tenant:{type:'string'},connector:{type:'string',default:'erp-main'},file:{type:'string'},'confirm-tenant':{type:'string'},limit:{type:'string',default:'10'},bid:{type:'string'},'tenant-id':{type:'string'},port:{type:'string',default:'8788'},help:{type:'boolean'}}});
  const command=positionals[0];
  if(v.help||!command){console.log(USAGE);}else{
    if(positionals.length!==1||!['plan','send','status','doctor','webhook'].includes(command))throw new ConnectorError('unknown_command');
    const tenant=tenantName(v.tenant||process.env.NEXID_TENANT_SLUG),connector=connectorName(v.connector);
    if(process.env.NEXID_API_BASE_URL&&process.env.NEXID_API_BASE_URL!==API_ORIGIN)throw new ConnectorError('unapproved_api_origin');
    if(command==='doctor'){
      const transport=createClient({tenant,apiKey:process.env.NEXID_API_KEY});console.log(JSON.stringify(await doctor(transport.client,tenant,v.bid),null,2));
    }else{
      const inbox=command==='webhook';
      const path=join(process.cwd(),'.nexid-integration',tenant,connector,inbox?'inbox.sqlite':'outbox.sqlite');
      ledger=new Ledger(path,{tenant,connector,origin:API_ORIGIN,tenantId:inbox?v['tenant-id']:null});
      if(command==='plan'){
        if(!v.file)throw new ConnectorError('csv_file_required');
        if((await stat(v.file)).size>524288)throw new ConnectorError('csv_size_limit');
        const source=await readFile(v.file,'utf8'),receipts=parseReceiptCsv(source);
        const result=ledger.plan(receipts.map(r=>receiptOperation(tenant,connector,r)));
        console.log(JSON.stringify({mode:'local_plan',networkRequests:0,...result,...ledger.summary()},null,2));
      }else if(command==='send'){
        if(v['confirm-tenant']!==tenant)throw new ConnectorError('explicit_tenant_confirmation_required');
        const transport=createClient({tenant,apiKey:process.env.NEXID_API_KEY});
        const result=await drain(ledger,transport.client,{confirmTenant:v['confirm-tenant'],limit:Number(v.limit)});
        console.log(JSON.stringify({mode:'live',networkRequests:transport.requestCount,...result},null,2));
        if(result.counts.some(r=>['blocked','uncertain','manual_review'].includes(r.state)))process.exitCode=2;
      }else if(command==='status')console.log(JSON.stringify({mode:'local_status',networkRequests:0,...ledger.summary()},null,2));
      else {
        const port=Number(v.port);if(!Number.isInteger(port)||port<1024||port>65535)throw new ConnectorError('port_invalid');
        const receiverLedger=ledger;
        const server=webhookServer({ledger:receiverLedger,secret:process.env.NEXID_WEBHOOK_SECRET,keyId:process.env.NEXID_WEBHOOK_KEY_ID,tenantId:v['tenant-id']});
        server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({listening:'127.0.0.1',port,path:'/webhooks/nexid',publicEndpointConfigured:false})));
        server.on('error',()=>{console.error(JSON.stringify({ok:false,reason:'receiver_listen_failed'}));receiverLedger.close();process.exitCode=1;});
        let stopping=false;const close=()=>{if(stopping)return;stopping=true;server.close(()=>receiverLedger.close());server.closeIdleConnections();};process.on('SIGINT',close);process.on('SIGTERM',close);
        ledger=null;
      }
    }
  }
}catch(error){console.error(JSON.stringify({ok:false,reason:error instanceof ConnectorError?error.code:'operation_failed_check_configuration'}));process.exitCode=1;}
finally{if(ledger)ledger.close();}
