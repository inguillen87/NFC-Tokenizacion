import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { canonicalMigrationSql } from '../scripts/lib/migration-source.mjs';
test('LF migration semantics do not depend on Windows CRLF checkout',()=>{
 const lf="DO $$\nBEGIN\n  RAISE NOTICE 'migración';\nEND;\n$$;\n";
 assert.equal(canonicalMigrationSql(lf.replaceAll('\n','\r\n')),lf);
 assert.equal(canonicalMigrationSql(lf),lf);
});
test('escaped SQL line-ending sequences, plain CR and other whitespace are not rewritten',()=>{
 const source=String.raw`SELECT E'\r\n', 'a  b', '\u000d';`;
 assert.equal(canonicalMigrationSql(source),source);assert.equal(canonicalMigrationSql('lone\rreturn'),'lone\rreturn');
 assert.throws(()=>canonicalMigrationSql(Buffer.from('SQL')),/migration_source_must_be_text/);
});
test('historical exact-fragment migrations are canonical without changing checked-in SQL',async()=>{
 const migration=await readFile(new URL('../db/migrations/20260802320000_0097_sun_demo_replay_isolation.sql',import.meta.url),'utf8');
 const lf=canonicalMigrationSql(migration),crlf=lf.replaceAll('\n','\r\n');
 assert.equal(canonicalMigrationSql(crlf),lf);assert.ok(lf.includes('sun_demo_replay_declaration_source_mismatch'));
 assert.match(lf,/v_occurrences IS DISTINCT FROM 1/);
});
test('migration runner normalizes before its transaction and preserves ledger guards',async()=>{
 const source=await readFile(new URL('../scripts/db-apply.mjs',import.meta.url),'utf8');
 assert.match(source,/canonicalMigrationSql\(fs.readFileSync/);
 assert.ok(source.indexOf('canonicalMigrationSql(fs.readFileSync')<source.indexOf('await client.query(body)'));
 assert.match(source,/assertEmptyEnterpriseE2eDatabase/);assert.match(source,/INSERT INTO schema_migrations/);
});
