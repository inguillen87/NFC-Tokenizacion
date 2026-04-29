import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = fs.existsSync(path.join(process.cwd(), 'apps')) ? process.cwd() : path.resolve(process.cwd(), '../..');

test('consumer auth uses strict DB-backed challenge flow (no in-memory fallback)', () => {
  const content = fs.readFileSync(path.join(repoRoot, 'apps/api/src/lib/consumer-auth.ts'), 'utf8');
  assert.equal(content.includes('fallbackChallenges'), false);
  assert.equal(content.includes('isMissingRelation'), false);
  assert.match(content, /INSERT INTO consumer_auth_challenges/);
});

test('backfill migration exists for consumer_auth_challenges', () => {
  const migration = fs.readFileSync(path.join(repoRoot, 'apps/api/db/migrations/20260428221000_0021_consumer_auth_challenges_backfill.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS consumer_auth_challenges/);
});

test('auth hotfix migration provides minimum users + consumer_auth_challenges tables', () => {
  const migration = fs.readFileSync(path.join(repoRoot, 'apps/api/db/migrations/20260429170000_0025_auth_hotfix_minimum_tables.sql'), 'utf8');
  assert.match(migration, /CREATE TABLE IF NOT EXISTS users/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS consumer_auth_challenges/);
});
