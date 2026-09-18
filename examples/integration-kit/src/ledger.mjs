import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,lstatSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {ConnectorError,tenantName,connectorName,hash} from './receipts.mjs';
const LIMIT = 10000;
export class Ledger {
  constructor(path, {tenant,connector,origin,tenantId=null}, clock=Date.now) {
    tenantName(tenant); connectorName(connector); this.clock=clock;
    if (path!==':memory:') {
      mkdirSync(dirname(path),{recursive:true,mode:0o700});
      if (lstatSync(dirname(path)).isSymbolicLink()) throw new ConnectorError('state_symlink_forbidden');
      try { if (lstatSync(path).isSymbolicLink()) throw new ConnectorError('state_symlink_forbidden'); } catch(e) { if (e.code!=='ENOENT') throw e; }
    }
    this.db=new DatabaseSync(path,{allowExtension:false,enableForeignKeyConstraints:true,enableDoubleQuotedStringLiterals:false,timeout:2000,defensive:true});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA max_page_count=8192;
      CREATE TABLE IF NOT EXISTS binding(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,external_id TEXT NOT NULL,body TEXT NOT NULL,digest TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('planned','uncertain','committed','blocked','manual_review')),first_attempt INTEGER,attempts INTEGER NOT NULL DEFAULT 0,event_id TEXT,reason TEXT,created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS lease(id INTEGER PRIMARY KEY CHECK(id=1),token TEXT NOT NULL,until_ms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS inbox(id TEXT PRIMARY KEY,digest TEXT NOT NULL,type TEXT NOT NULL,received_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications(event_id TEXT PRIMARY KEY REFERENCES inbox(id),batch_id TEXT,external_event_id TEXT,event_type TEXT NOT NULL);`);
    this.binding={schema:1,tenant,connector,origin,tenantId};
    try { this.transaction(()=>{const encoded=JSON.stringify(this.binding);this.db.prepare('INSERT OR IGNORE INTO binding VALUES(1,?)').run(encoded);if(this.db.prepare('SELECT value FROM binding WHERE id=1').get().value!==encoded)throw new ConnectorError('state_bound_to_another_scope');}); }
    catch(e){this.db.close();throw e;}
  }
  transaction(fn) { this.db.exec('BEGIN IMMEDIATE'); try {const result=fn();this.db.exec('COMMIT');return result;} catch(e){this.db.exec('ROLLBACK');throw e;} }
  plan(operations) {
    return this.transaction(()=>{
      let added=0;
      for(const op of operations){const existing=this.db.prepare('SELECT digest FROM jobs WHERE id=?').get(op.key);if(existing){if(existing.digest!==op.digest)throw new ConnectorError('business_id_payload_conflict');continue;}
        this.db.prepare('INSERT INTO jobs(id,external_id,body,digest,state,created_at) VALUES(?,?,?,?,?,?)').run(op.key,op.externalId,op.body,op.digest,'planned',this.clock());added++;
      }
      if(this.db.prepare('SELECT count(*) n FROM jobs').get().n>LIMIT)throw new ConnectorError('local_queue_limit');
      return {added,alreadyPresent:operations.length-added};
    });
  }
  acquire() {
    const token=randomUUID(),now=this.clock();
    return this.transaction(()=>{const current=this.db.prepare('SELECT * FROM lease WHERE id=1').get();if(current&&current.until_ms>now)throw new ConnectorError('worker_already_running');this.db.prepare('INSERT INTO lease VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,until_ms=excluded.until_ms').run(token,now+120000);return token;});
  }
  own(token) {const lease=this.db.prepare('SELECT * FROM lease WHERE id=1').get();if(!lease||lease.token!==token||lease.until_ms<=this.clock())throw new ConnectorError('worker_lease_lost');}
  renew(token) {this.transaction(()=>{this.own(token);this.db.prepare('UPDATE lease SET until_ms=? WHERE id=1').run(this.clock()+120000);});}
  release(token) {this.db.prepare('DELETE FROM lease WHERE id=1 AND token=?').run(token);}
  pending(limit) {return this.db.prepare("SELECT * FROM jobs WHERE state IN ('planned','uncertain') ORDER BY created_at,id LIMIT ?").all(limit);}
  attempt(id,token) {this.transaction(()=>{this.own(token);const row=this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id);if(!row||row.digest!==hash(row.body))throw new ConnectorError('queue_integrity_mismatch');this.db.prepare("UPDATE jobs SET state='uncertain',first_attempt=coalesce(first_attempt,?),attempts=attempts+1,reason=NULL WHERE id=?").run(this.clock(),id);});}
  finish(id,state,eventId,reason,token) {this.transaction(()=>{this.own(token);this.db.prepare('UPDATE jobs SET state=?,event_id=?,reason=? WHERE id=?').run(state,eventId||null,reason||null,id);});}
  summary() {return {scope:this.binding,counts:this.db.prepare('SELECT state,count(*) count FROM jobs GROUP BY state ORDER BY state').all(),jobs:this.db.prepare('SELECT external_id,state,attempts,event_id,reason FROM jobs ORDER BY created_at,id LIMIT 500').all(),inbox:this.db.prepare('SELECT count(*) count FROM inbox').get().count};}
  receive(event,digest) {
    return this.transaction(()=>{const previous=this.db.prepare('SELECT digest FROM inbox WHERE id=?').get(event.id);if(previous){if(previous.digest!==digest)throw new ConnectorError('webhook_event_content_conflict');return {duplicate:true};}
      if(this.db.prepare('SELECT count(*) n FROM inbox').get().n>=LIMIT)throw new ConnectorError('local_inbox_limit');
      this.db.prepare('INSERT INTO inbox VALUES(?,?,?,?)').run(event.id,digest,event.type,this.clock());
      this.db.prepare('INSERT INTO notifications VALUES(?,?,?,?)').run(event.id,event.data.batch_id||null,event.data.event_id||null,event.type);
      return {duplicate:false};
    });
  }
  close(){this.db.close();}
}
