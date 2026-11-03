import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertQaPostgresClientIdentity} from './ownership-current-state-postgres-harness.mjs';
import {listSdkSensorTimeline} from '../../src/lib/sdk-sensor-sun-source.ts';

/** Actual production SELECT on existing disposable migrated tables, not copied SQL. */
export async function runSdkSensorReadPostgresQa({connect,dockerAttestation,target,foreignTarget}={}){
  assert.equal(typeof connect,'function','An explicit disposable QA connection factory is required');
  for(const value of[target,foreignTarget]){assert(value);for(const key of['tenantId','batchId','tagId'])assert.match(value[key],/^[a-f0-9-]{36}$/i);assert.equal(typeof value.bid,'string');assert.equal(typeof value.uidHex,'string');}
  assert.notEqual(target.tenantId,foreignTarget.tenantId);
  const clients=[],fixtureIds=[],captures=[],checks=[],report={ok:false,checks,sqlCopied:false,usesActualReader:true,readerTransactionReadOnly:false,fixtureRowsCreated:0,cleanup:{fixtureRowsDeleted:false,connectionsClosed:false}};
  let writer,reader,readTransaction=false;
  try{
    let database;const pids=[];
    for(let i=0;i<2;i++){
      const c=await connect();assert(!clients.includes(c),'Independent QA clients are required');clients.push(c);assert.equal(typeof c.query,'function');assert.equal(typeof c.end,'function');
      const{rows:[identity]}=await c.query("SELECT current_database() AS database,current_user AS role,pg_backend_pid() AS pid,host(inet_server_addr()) AS address,current_setting('server_version_num')::integer AS server_version_number,current_setting('neon.endpoint_id',true) AS neon_endpoint_id,current_setting('transaction_read_only') AS transaction_read_only");
      assertQaPostgresClientIdentity(c,identity,{dockerAttestation});database??=identity.database;assert.equal(identity.database,database);assert(!pids.includes(identity.pid));pids.push(identity.pid);
    }
    [writer,reader]=clients;
    const now=Date.now()-60_000;
    const sensor=(index,extra={})=>({temperatureC:index+1,humidityPct:50,measuredAt:new Date(now-index*1000).toISOString(),deviceId:'owned-'+index,source:'Owned PG sensor fixture',stage:'warehouse',nexidExpectedBatchId:target.batchId,nexidExpectedTagId:target.tagId,...extra});
    async function seed(data,overrides={}){
      const id=randomUUID(),scope={...target,...overrides},at=new Date(now+(overrides.newer?30_000:-(overrides.index??0)*1000)).toISOString();
      fixtureIds.push(id);
      await writer.query(`INSERT INTO public.sdk_external_events(id,tenant_id,batch_id,tag_id,bid,uid_hex,event_type,source,occurred_at,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,[id,scope.tenantId,scope.batchId,scope.tagId,scope.bid,scope.uidHex,overrides.eventType??'product.sensor_reading',overrides.source??'sdk_sensor',at,JSON.stringify(data)]);report.fixtureRowsCreated++;
    }
    // Invalid newer rows must be excluded in SQL before LIMIT, not just projected out.
    for(let i=0;i<25;i++)await seed({sensors:sensor(i)},{index:i});
    for(const data of[null,3,'scalar',[],{}, {other:{}}, {sensors:null}, {sensors:3}, {sensors:[]}, {sensors:sensor(0),extra:'private'}, {sensors:sensor(0),extra:1,third:2}, {sensors:sensor(0,{unsupported:'private'})}, {sensors:sensor(0,{nexidExpectedBatchId:foreignTarget.batchId})}, {sensors:sensor(0,{nexidExpectedTagId:foreignTarget.tagId})}])await seed(data,{newer:true});
    for(const override of[{tenantId:foreignTarget.tenantId},{batchId:foreignTarget.batchId},{tagId:foreignTarget.tagId},{bid:foreignTarget.bid},{uidHex:foreignTarget.uidHex},{eventType:'shipment.received'},{source:'sdk'}])await seed({sensors:sensor(0)},{...override,newer:true});
    await seed({sensors:{...sensor(0),nexidExpectedBatchId:foreignTarget.batchId,nexidExpectedTagId:foreignTarget.tagId}},{...foreignTarget,newer:true});
    await reader.query('BEGIN READ ONLY');readTransaction=true;
    assert.equal((await reader.query("SHOW transaction_read_only")).rows[0].transaction_read_only,'on');report.readerTransactionReadOnly=true;
    const query=async(strings,...values)=>{
      const statement=strings.reduce((text,part,index)=>text+(index?'$'+index:'')+part,'');
      assert.match(statement,/^\s*SELECT\b/);assert.match(statement,/FROM public\.sdk_external_events external_event/);
      const selected=(await reader.query(statement,values)).rows;
      const offsetShape=value=>typeof value==='string'&&/(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
      captures.push({statement,values,selectedRows:selected.length,receivedStrings:selected.filter(row=>typeof row.received_at==='string').length,receivedOffsetShapes:selected.filter(row=>offsetShape(row.received_at)).length,occurredNulls:selected.filter(row=>row.occurred_at===null).length,occurredOffsetShapes:selected.filter(row=>offsetShape(row.occurred_at)).length});
      return selected;
    };
    for(const[requested,expected]of[[undefined,6],[0,1],[2,2],[1000,24]]){
      const before=captures.length,rows=await listSdkSensorTimeline({tenantId:target.tenantId,bid:target.bid,uidHex:target.uidHex,...(requested===undefined?{}:{limit:requested})},query);
      assert.equal(captures.length,before+1);assert.deepEqual(captures.at(-1).values,[target.tenantId,target.bid,target.uidHex,'product.sensor_reading','sdk_sensor',expected]);
      const capture=captures.at(-1);
      assert.equal(rows.length,expected,'sdk_sensor_read_projection_count expected='+expected+' selected='+capture.selectedRows+' received_strings='+capture.receivedStrings+' received_offset_shapes='+capture.receivedOffsetShapes+' occurred_nulls='+capture.occurredNulls+' occurred_offset_shapes='+capture.occurredOffsetShapes);assert.deepEqual(rows.map(row=>row.deviceId),Array.from({length:expected},(_,index)=>'owned-'+index));
      for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['deviceId','humidityPct','lightExposure','measuredAt','occurredAt','receivedAt','source','stage','temperatureC','transitShock']);assert.equal(row.source,'Owned PG sensor fixture');assert.equal(row.humidityPct,50);assert(!JSON.stringify(row).includes('private'));}
      checks.push({name:'actual readonly scoped SQL and limit '+String(requested??'default'),ok:true,rows:rows.length});
    }
    const other=await listSdkSensorTimeline({tenantId:foreignTarget.tenantId,bid:foreignTarget.bid,uidHex:foreignTarget.uidHex,limit:2},query);
    assert.equal(other.length,1);assert.equal(other[0].deviceId,'owned-0');checks.push({name:'foreign target has its own scoped record only',ok:true});
    await reader.query('ROLLBACK');readTransaction=false;report.sqlExecutions=captures.length;report.ok=true;
  }finally{
    try{if(readTransaction)await reader.query('ROLLBACK');}
    finally{
      try{if(fixtureIds.length){await writer.query('DELETE FROM public.sdk_external_events WHERE id=ANY($1::uuid[]) AND tenant_id=ANY($2::uuid[])',[fixtureIds,[target.tenantId,foreignTarget.tenantId]]);const remaining=await writer.query('SELECT count(*)::integer AS n FROM public.sdk_external_events WHERE id=ANY($1::uuid[])',[fixtureIds]);assert.equal(remaining.rows[0].n,0);}report.cleanup.fixtureRowsDeleted=true;}
      finally{const closed=await Promise.allSettled(clients.map(c=>Promise.resolve().then(()=>c.end())));report.cleanup.connectionsClosed=closed.every(result=>result.status==='fulfilled');assert(report.cleanup.connectionsClosed);}
    }
  }
  return report;
}
