import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const vendor = new URL('../../vendor/zod3-security/', import.meta.url);
const require = createRequire(import.meta.url);
const variants = [
  ['root ESM', (await import(new URL('index.js', vendor))).z],
  ['v3 ESM', (await import(new URL('v3/index.js', vendor))).z],
  ['root CJS', require(fileURLToPath(new URL('index.cjs', vendor))).z],
  ['v3 CJS', require(fileURLToPath(new URL('v3/index.cjs', vendor))).z],
];
const digest = bytes => createHash('sha256').update(bytes.toString('utf8').replaceAll('\r\n', '\n')).digest('hex');

for (const [dialect, z] of variants) {
  for (const kind of ['array-max', 'array-exact', 'set-max', 'set-exact']) {
    test(`${dialect}: ${kind} rejects above its bound before member or outer refinement work`, async () => {
      for (const asynchronous of [false, true]) {
        let members = 0, outer = 0;
        const observe = value => { members++; return value; };
        const item = z.preprocess(asynchronous ? async value => observe(value) : observe, z.string());
        const bounded = kind === 'array-max' ? z.array(item).max(2)
          : kind === 'array-exact' ? z.array(item).length(2)
          : kind === 'set-max' ? z.set(item).max(2) : z.set(item).size(2);
        const schema = bounded.superRefine(() => { outer++; });
        const input = kind.startsWith('set') ? new Set(['a', 'b', 'c']) : ['a', 'b', 'c'];
        const result = asynchronous ? await schema.safeParseAsync(input) : schema.safeParse(input);
        assert.equal(result.success, false);
        assert.equal(members, 0);
        assert.equal(outer, 0);
        assert.equal(result.error.issues.length, 1);
        assert.equal(result.error.issues[0].code, 'too_big');
        assert.equal(result.error.issues[0].maximum, 2);
        assert.equal(result.error.errors, result.error.issues, 'major3 error alias remains available');
      }
    });
  }

  test(`${dialect}: accepted equality, transformations and zero bounds retain output`, async () => {
    let visits = 0;
    const item = z.preprocess(value => { visits++; return value; }, z.string().transform(value => value.toUpperCase()));
    assert.deepEqual(z.array(item).max(2).parse(['a', 'b']), ['A', 'B']);
    assert.equal(visits, 2);
    visits = 0;
    assert.deepEqual([...await z.set(item).size(2).parseAsync(new Set(['a', 'b']))], ['A', 'B']);
    assert.equal(visits, 2);
    for (const schema of [z.array(item).max(0), z.array(item).length(0)]) {
      visits = 0;
      assert.deepEqual(schema.parse([]), []);
      assert.equal(schema.safeParse(['a']).success, false);
      assert.equal(visits, 0);
    }
  });

  test(`${dialect}: lower bounds keep member diagnostics and dirty refinement semantics`, () => {
    for (const exact of [false, true]) {
      let members = 0, outer = 0;
      const item = z.preprocess(value => { members++; return value; }, z.string());
      const schema = (exact ? z.array(item).length(3) : z.array(item).min(3)).refine(() => { outer++; return true; });
      const result = schema.safeParse(['a', 'b']);
      assert.equal(result.success, false);
      assert.equal(members, 2);
      assert.equal(outer, 1);
      assert.equal(result.error.issues[0].code, 'too_small');
      assert.equal(result.error.issues[0].minimum, 3);
    }
  });

  test(`${dialect}: nested paths and custom upper-bound messages remain visible`, () => {
    const result = z.object({items: z.array(z.string()).max(1, 'capacity exceeded')}).safeParse({items: ['a', 'b']});
    assert.equal(result.success, false);
    assert.deepEqual(result.error.issues, [{code: 'too_big', maximum: 1, type: 'array', inclusive: true,
      exact: false, message: 'capacity exceeded', path: ['items']}]);
  });

  test(`${dialect}: catch and unions preserve accepted inputs and explicit rejection trees`, () => {
    let visits = 0;
    const bounded = z.array(z.preprocess(value => { visits++; return value; }, z.string())).max(2);
    assert.deepEqual(bounded.catch(['fallback']).parse(['a', 'b', 'c']), ['fallback']);
    assert.equal(visits, 0);
    const union = z.union([bounded, z.literal('fallback')]);
    assert.equal(union.parse('fallback'), 'fallback');
    assert.deepEqual(union.parse(['a']), ['a']);
    visits = 0;
    const result = union.safeParse(['a', 'b', 'c']);
    assert.equal(result.success, false);
    assert.equal(visits, 0);
    assert.equal(result.error.issues[0].code, 'invalid_union');
    assert.equal(result.error.issues[0].unionErrors[0].issues[0].code, 'too_big');
  });

  test(`${dialect}: Standard Schema uses the same bound and ordinary validation path`, async () => {
    let visits = 0;
    const schema = z.array(z.preprocess(value => { visits++; return value; }, z.string())).max(2);
    const rejected = await schema['~standard'].validate(['a', 'b', 'c']);
    assert.equal(rejected.issues[0].code, 'too_big');
    assert.equal(visits, 0);
    const accepted = await schema['~standard'].validate(['a', 'b']);
    assert.deepEqual(accepted.value, ['a', 'b']);
    assert.equal(visits, 2);
  });

  test(`${dialect}: unrestricted arrays and maps retain their declared major3 API`, () => {
    let visits = 0;
    const schema = z.array(z.preprocess(value => { visits++; return value; }, z.string()));
    assert.deepEqual(schema.parse(['a', 'b', 'c']), ['a', 'b', 'c']);
    assert.equal(visits, 3, 'this backport does not invent a global unrestricted-input budget');
    const map = z.map(z.string(), z.number());
    assert.deepEqual([...map.parse(new Map([['a', 1]]))], [['a', 1]]);
    assert.equal(typeof map.max, 'undefined', 'do not add a new major3 Map API');
  });
}

test('private provenance, license, complete file inventory and all patched dialect hashes are enforced', async () => {
  const metadata = JSON.parse(await readFile(new URL('package.json', vendor), 'utf8'));
  const provenance = JSON.parse(await readFile(new URL('UPSTREAM.json', vendor), 'utf8'));
  assert.equal(metadata.name, '@nexid/zod3-security-backport');
  assert.equal(metadata.version, '3.25.76+nexid.1');
  assert.equal(metadata.private, true);
  assert.deepEqual(Object.keys(metadata.exports).sort(), ['.', './package.json', './v3']);
  assert.equal(provenance.officialPatchedRelease, false);
  assert.equal(provenance.upstream.name, 'zod');
  assert.equal(provenance.upstream.version, '3.25.76');
  assert.equal(provenance.upstream.integrity, 'sha512-gzUt/qt81nXsFGKIFcC3YnfEAx5NkunCfnDlvuBSSFS02bcXu4Lmea0AFIUwbLWxWPx3d9p8S5QoaujKcNQxcQ==');
  assert.equal(digest(await readFile(new URL('LICENSE', vendor))), '3f1189b28e3866e0d979968d466b78f813f76827cfdca1fbb124cc0a5c8841f8');
  assert.match(await readFile(new URL('LICENSE', vendor), 'utf8'), /Permission is hereby granted/);
  const files = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      const relative = prefix + entry.name;
      assert(!entry.isSymbolicLink());
      if (entry.isDirectory()) await walk(new URL(entry.name + '/', directory), relative + '/');
      else { assert(entry.isFile()); files.push(relative); }
    }
  }
  await walk(vendor);
  assert.deepEqual(files.filter(name => name !== 'UPSTREAM.json').sort(), Object.keys(provenance.localPatch.filesSha256).sort());
  const modified = [];
  for (const [name, hash] of Object.entries(provenance.localPatch.filesSha256)) {
    assert.equal(digest(await readFile(new URL(name, vendor))), hash, name);
    if (hash !== provenance.upstream.filesSha256[name]) modified.push(name);
  }
  assert.deepEqual(modified.sort(), ['README.md', 'package.json', 'src/v3/types.ts', 'v3/types.cjs', 'v3/types.js']);
  for (const [name, hash] of Object.entries({
    'v3/types.js': 'a01e9f0a07ddfd522312cf0d8ee10caf9b21ea677cbc8431f731b84c6d778ff3',
    'v3/types.cjs': '258b6d818e30b794157fe3a4cd53064f2abf8a1e4e91faa699249df59fb5a58c',
    'src/v3/types.ts': 'ad115a1c20a5e7592177e725dce996bbb3df2f6af2a5ec55d34339b30e11bc72',
  })) assert.equal(provenance.localPatch.filesSha256[name], hash);
});
