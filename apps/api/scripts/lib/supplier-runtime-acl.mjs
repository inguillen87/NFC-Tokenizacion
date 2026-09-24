import assert from 'node:assert/strict';
import {SUPPLIER_RUNTIME_TABLES,SUPPLIER_RUNTIME_LOCK_COLUMNS,SUPPLIER_RUNTIME_FUNCTION_NAMES} from './supplier-runtime-profile.mjs';

/** Validate effective rights, not merely the intended GRANT statements. */
export async function verifySupplierRuntimeEffectiveAcl(client) {
  const names=Object.keys(SUPPLIER_RUNTIME_TABLES);
  const rows=(await client.query(`SELECT c.relname name,
    has_table_privilege(current_user,c.oid,'SELECT') can_select,
    has_table_privilege(current_user,c.oid,'INSERT') can_insert,
    has_table_privilege(current_user,c.oid,'UPDATE') can_update,
    has_table_privilege(current_user,c.oid,'DELETE') can_delete,
    has_table_privilege(current_user,c.oid,'TRUNCATE') can_truncate,
    has_table_privilege(current_user,c.oid,'REFERENCES') can_reference,
    has_table_privilege(current_user,c.oid,'TRIGGER') can_trigger
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname`,[names])).rows;
  assert.equal(rows.length,names.length,'Every ACL-manifest table must exist');
  for(const row of rows){
    const expected=SUPPLIER_RUNTIME_TABLES[row.name];
    for(const privilege of ['SELECT','INSERT','UPDATE'])assert.equal(row['can_'+privilege.toLowerCase()],expected.includes(privilege),'Unexpected effective '+privilege+' on '+row.name);
    for(const property of ['can_delete','can_truncate','can_reference','can_trigger'])assert.equal(row[property],false,'Unexpected '+property+' on '+row.name);
  }
  const columns=(await client.query(`SELECT c.relname name,a.attname column_name,
    has_column_privilege(current_user,c.oid,a.attnum,'UPDATE') can_update
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname,a.attnum`,[names])).rows;
  for(const row of columns){
    const expected=SUPPLIER_RUNTIME_TABLES[row.name].includes('UPDATE')||(SUPPLIER_RUNTIME_LOCK_COLUMNS[row.name]||[]).includes(row.column_name);
    assert.equal(row.can_update,expected,'Unexpected effective column UPDATE on '+row.name+'.'+row.column_name);
  }
  const functions=(await client.query(`SELECT p.proname name,
    has_function_privilege(current_user,p.oid,'EXECUTE') can_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY($1::text[]) ORDER BY p.proname`,[SUPPLIER_RUNTIME_FUNCTION_NAMES])).rows;
  assert.equal(functions.length,SUPPLIER_RUNTIME_FUNCTION_NAMES.length);
  for(const row of functions)assert.equal(row.can_execute,true,'Required explicit function missing '+row.name);
  return {tables_checked:rows.length,columns_checked:columns.length,functions_checked:functions.length,unexpected_privileges:0};
}
