import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const vendor = await realpath(path.join(root, 'vendor/zod3-security'));
const repositoryRequire = createRequire(path.join(root, 'package.json'));
const readJson = async name => JSON.parse(await readFile(name, 'utf8'));
const consumers = ['hardhat', '@nomicfoundation/hardhat-ethers', '@nomicfoundation/hardhat-verify'];

for (const name of consumers) {
  test(`${name} and its helper load the actual corrected major3 component`, async () => {
    const consumer = createRequire(path.join(root, 'node_modules', name, 'package.json'));
    const metadataPath = consumer.resolve('zod/package.json');
    const metadata = await readJson(metadataPath);
    assert.equal(metadata.name, '@nexid/zod3-security-backport');
    assert.equal(metadata.version, '3.25.76+nexid.1');
    assert.equal(metadata.private, true);
    assert.equal(await realpath(path.dirname(metadataPath)), vendor);
    let members = 0;
    const z = consumer('zod').z;
    assert.equal(z.array(z.preprocess(value => { members++; return value; }, z.string())).max(1).safeParse(['a', 'b']).success, false);
    assert.equal(members, 0);
    const helperEntry = consumer.resolve('@nomicfoundation/hardhat-zod-utils');
    const helperRequire = createRequire(helperEntry);
    assert.equal(await realpath(path.dirname(helperRequire.resolve('zod/package.json'))), vendor);
    const helper = await import(pathToFileURL(helperEntry).href);
    const esm = await import(pathToFileURL(path.join(vendor, 'index.js')).href);
    const configType = esm.z.object({names: esm.z.array(esm.z.string()).nonempty()});
    assert.deepEqual(helper.validateUserConfigZodType({names: ['ordinary']}, configType), []);
    const rejected = helper.validateUserConfigZodType({names: [7]}, configType);
    assert.deepEqual(rejected.map(issue => issue.path), [['names', 0]]);
    assert.match(rejected[0].message, /Expected string/);
    assert.equal(helper.sensitiveUrlSchema.parse('https://example.invalid'), 'https://example.invalid');
    assert.equal(helper.sensitiveUrlSchema.safeParse(7).success, false);
  });
}

test('API, shared SDK, Upstash and root keep the patched official production major', async () => {
  const upstash = createRequire(repositoryRequire.resolve('@upstash/realtime'));
  for (const requireFrom of [repositoryRequire, createRequire(path.join(root, 'apps/api/package.json')),
    createRequire(path.join(root, 'packages/api-client/package.json')), upstash]) {
    const metadata = await readJson(requireFrom.resolve('zod/package.json'));
    assert.equal(metadata.name, 'zod');
    assert.equal(metadata.version, '4.6.7');
  }
});

test('the local major3 declarations retain ESM and CommonJS consumer contracts', () => {
  const snippets = {
    'zod3-compatibility.fixture.mts': `import {z, type ZodType, type ZodTypeDef} from '../../vendor/zod3-security/index.js';
      const schema: ZodType<string, ZodTypeDef, string> = z.string();
      const record = z.record(z.string());
      const union = z.union([schema, z.number()]);
      const result: string | number = union.parse('valid');
      const dictionary: Record<string,string> = record.parse({key:'value'});`,
    'zod3-compatibility.fixture.cts': `import zod = require('../../vendor/zod3-security/index.cjs');
      const schema: zod.ZodType<string, zod.ZodTypeDef, string> = zod.z.string();
      const values: string[] = zod.z.array(schema).max(2).parse(['valid']);`,
  };
  const virtual = new Map(Object.entries(snippets).map(([name, source]) => [path.join(root, 'scripts/tests', name), source]));
  const options = {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, types: [], skipLibCheck: false};
  const host = ts.createCompilerHost(options);
  const originalRead = host.readFile.bind(host), originalExists = host.fileExists.bind(host), originalSource = host.getSourceFile.bind(host);
  host.readFile = name => virtual.get(path.normalize(name)) ?? originalRead(name);
  host.fileExists = name => virtual.has(path.normalize(name)) || originalExists(name);
  host.getSourceFile = (name, language, onError, fresh) => virtual.has(path.normalize(name))
    ? ts.createSourceFile(name, virtual.get(path.normalize(name)), language, true) : originalSource(name, language, onError, fresh);
  const program = ts.createProgram([...virtual.keys()], options, host);
  const errors = ts.getPreEmitDiagnostics(program).filter(item => item.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), []);
});
