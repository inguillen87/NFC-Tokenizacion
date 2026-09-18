// Synthetic loopback API for browser tests only. No Neon or real tenant traffic.
import http from 'node:http';
const tenant='qa-company',tenantId='10000000-0000-4000-8000-000000000001',shipmentId='20000000-0000-4000-8000-000000000001';
const records=new Map();let shipments=[],requests=[],reads=0,failNext=false;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:4195'),reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname==='/qa-state')return reply(200,{rows:shipments.length,requests,reads,receipts:records.size});
  if(url.pathname==='/qa-reset'&&req.method==='POST'){records.clear();shipments=[];requests=[];reads=0;failNext=false;return reply(200,{ok:true});}
  if(url.pathname==='/qa-fail-next'&&req.method==='POST'){failNext=true;return reply(200,{ok:true});}
  const viewer=req.headers.authorization==='Bearer local-logistics-viewer';
  if(!viewer&&req.headers.authorization!=='Bearer local-logistics-admin')return reply(401,{ok:false});
  if(url.pathname==='/auth/session')return reply(200,{ok:true,session:{id:'qa-local',email:'qa@example.invalid',role:'tenant-admin',tenantId,tenantSlug:tenant,label:'Empresa QA · datos sintéticos',permissions:viewer?['logistics:read']:['*'],deniedPermissions:[],mfaVerified:true,setupCompleted:true,isDemo:false}});
  if(url.pathname==='/admin/logistics/shipments'&&req.method==='GET'){reads++;return reply(200,{ok:true,dataSource:'production',observedAt:new Date().toISOString(),scope:{tenant,limit:100},operationProtocol:'nexid.logistics.v1',stats:{total:shipments.length,in_transit:0,delivered:0,alerts:shipments.filter(s=>s.status==='QUARANTINED').length},shipments});}
  if(['/admin/logistics/shipments','/admin/logistics/scan'].includes(url.pathname)&&req.method==='POST'){
    if(viewer)return reply(403,{ok:false});let raw='';for await(const chunk of req)raw+=chunk;const data=JSON.parse(raw);requests.push({path:url.pathname,operation_key:data.operation_key,tt_raw:data.tt_raw});
    const old=records.get(data.operation_key);if(old){if(old.raw!==raw)return reply(409,{ok:false,reason:'logistics_idempotency_conflict'});return reply(200,{...old.response,[old.kind]:{...old.response[old.kind],replayed:true}});}
    const create=url.pathname.endsWith('/shipments'),kind=create?'shipment':'data';
    if(create)shipments.push({id:shipmentId,tenant_slug:tenant,shipment_code:data.shipment_code||'QA-SHIP-01',status:'draft',origin_address:data.origin_address,destination_address:data.destination_address,item_count:1,item_quantity:data.items[0].quantity,seal_count:0,custody_event_count:0,updated_at:new Date().toISOString()});
    else {shipments[0].status=data.tt_raw==='4343'?'SEALED':'QUARANTINED';shipments[0].seal_count=1;shipments[0].custody_event_count++;}
    const response={ok:true,tenant:{slug:tenant},[kind]:{id:shipmentId,tenantId,shipmentId,shipmentCode:'QA-SHIP-01',status:shipments[0].status,shipmentStatus:shipments[0].status,newStatus:create?'':shipments[0].status,previousStatus:create?'':'UNASSIGNED',receiptId:`30000000-0000-4000-8000-${String(records.size+1).padStart(12,'0')}`,replayed:false,idempotencyProvided:true,protocol:'nexid.logistics.v1',itemCount:1}};
    records.set(data.operation_key,{raw,kind,response});if(failNext){failNext=false;return reply(503,{ok:false,reason:'simulated_response_lost_after_commit'});}return reply(create?201:200,response);
  }
  reply(503,{ok:false,reason:'local_fixture_not_implemented'});
});
server.listen(4195,'127.0.0.1',()=>console.log('LOCAL_LOGISTICS_FIXTURE_4195_READY'));
