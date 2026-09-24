import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalMigrationSql } from './migration-source.mjs';
const prerequisiteId='secure-delivery-v1';
export async function prepareEnterpriseBootstrapPrerequisite(client,migrationId,{emptyLocalBootstrap=false}={}) {
 if(migrationId!=='20260918050000_0103_logistics_atomic_operations.sql')return null;
 if(emptyLocalBootstrap!==true)throw Error('legacy_prerequisite_requires_empty_local_bootstrap');
 const baseline=canonicalMigrationSql(await readFile(new URL('../../db/bootstrap/secure-delivery-v1.sql',import.meta.url),'utf8'));
 const already=(await client.query("SELECT count(*)::integer n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])",[['carrier_integrations','shipments','shipment_items','seal_inventory','package_seals','custody_events','recipient_verifications','delivery_claims']])).rows[0]?.n;
 if(already!==0)throw Error('legacy_prerequisite_relations_already_present');
 await client.query(baseline);
 return {id:prerequisiteId,sha256:createHash('sha256').update(baseline).digest('hex'),source:'db/bootstrap/secure-delivery-v1.sql'};
}
