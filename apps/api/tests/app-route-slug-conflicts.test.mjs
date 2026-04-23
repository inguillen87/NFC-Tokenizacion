import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '../src/app');

function walk(dir, rel = '') {
  const entries = readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('_') || name === 'node_modules') continue;
    const childRel = rel ? `${rel}/${name}` : name;
    results.push(childRel);
    results = results.concat(walk(path.join(dir, name), childRel));
  }
  return results;
}

function normalize(segment) {
  const match = segment.match(/^\[(.+)\]$/);
  if (!match) return { key: segment, param: null };
  return { key: '[]', param: match[1] };
}

function templateFromRoute(route) {
  const segs = route.split('/');
  const parts = [];
  const params = [];
  for (const seg of segs) {
    const { key, param } = normalize(seg);
    parts.push(key);
    if (param) params.push({ depth: parts.length - 1, name: param });
  }
  return { template: parts.join('/'), params };
}

test('app router does not mix dynamic slug names for same route template', () => {
  assert.equal(statSync(appRoot).isDirectory(), true, `missing app root: ${appRoot}`);

  const dirs = walk(appRoot);
  const byTemplate = new Map();
  const examplesByTemplate = new Map();

  for (const rel of dirs) {
    const { template, params } = templateFromRoute(rel);
    if (!byTemplate.has(template)) byTemplate.set(template, new Map());
    if (!examplesByTemplate.has(template)) examplesByTemplate.set(template, new Map());
    const slotMap = byTemplate.get(template);
    const exampleSlotMap = examplesByTemplate.get(template);

    for (const { depth, name } of params) {
      if (!slotMap.has(depth)) slotMap.set(depth, new Set());
      if (!exampleSlotMap.has(depth)) exampleSlotMap.set(depth, new Map());
      if (!exampleSlotMap.get(depth).has(name)) exampleSlotMap.get(depth).set(name, rel);
      slotMap.get(depth).add(name);
    }
  }

  const conflicts = [];
  for (const [template, slotMap] of byTemplate.entries()) {
    for (const [depth, names] of slotMap.entries()) {
      if (names.size > 1) {
        const nameList = [...names].sort();
        const examples = nameList
          .map((name) => `${name}=>${examplesByTemplate.get(template).get(depth).get(name)}`)
          .join(' | ');
        conflicts.push({ template, depth, names: nameList, examples });
      }
    }
  }

  assert.deepEqual(
    conflicts,
    [],
    `Found mixed dynamic segment names:\n${conflicts
      .map((c) => `- template=${c.template} depth=${c.depth} names=${c.names.join(', ')} examples=${c.examples}`)
      .join('\n')}`,
  );
});

test('consumer redemption cancel route uses /consumer/redemptions and legacy rewards path is absent', () => {
  const canonicalPath = path.join(appRoot, 'consumer', 'redemptions', '[redemptionId]', 'cancel', 'route.ts');
  const legacyPath = path.join(appRoot, 'consumer', 'rewards', '[redemptionId]');

  assert.equal(
    existsSync(canonicalPath),
    true,
    `expected canonical redemption route to exist: ${canonicalPath}`,
  );
  assert.equal(
    existsSync(legacyPath),
    false,
    `legacy conflicting route directory must not exist: ${legacyPath}`,
  );
});
