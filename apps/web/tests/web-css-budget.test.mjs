import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CSS_METRICS, WEB_CSS_BASELINE, WEB_CSS_SOURCE,
  checkWebCssBudget, compareWebCssBudget, measureWebCss,
} from "../../../scripts/web-css-budget.mjs";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const budget = metrics => ({ schema: "nexid.web-global-css-budget.v1", sourcePath: WEB_CSS_SOURCE, metrics });

test("physical CSS lines normalize line endings without inventing a final blank line", () => {
  for (const newline of ["\n", "\r\n", "\r"]) {
    assert.equal(measureWebCss(["/* comment */", ".a {", " color: red;", "}", ""].join(newline)).physicalLines, 4);
  }
  assert.equal(measureWebCss("").physicalLines, 0);
  assert.equal(measureWebCss("\n").physicalLines, 1);
  assert.equal(measureWebCss(".a{}\n\n").physicalLines, 2);
});

test("comment examples contribute physical lines and no effect/color annotations", () => {
  assert.deepEqual(measureWebCss("/*\n #123 !important linear-gradient(red, blue)\n*/\n.a{}\n"), {
    physicalLines: 4, importantDeclarations: 0, distinctHexColors: 0, gradientFunctions: 0,
  });
});

test("selectors, strings, escaped quotes and URL contents do not inflate color or gradient metrics", () => {
  const css = String.raw`#abc { content: "\" /* #123 !important linear-gradient(red,blue) */"; background: url(image.svg#fff); mask: url('radial-gradient(#000,#123)'); }`;
  assert.deepEqual(measureWebCss(css), {
    physicalLines: 1, importantDeclarations: 0, distinctHexColors: 0, gradientFunctions: 0,
  });
});

test("important annotations are declarations and accept case, spacing and comments", () => {
  const metrics = measureWebCss('.a { a: 1!important; b: 2 !IMPORTANT; c: 3!/**/important; content: "!important"; }');
  assert.equal(metrics.importantDeclarations, 3);
});

test("equivalent hex spellings share one RGBA color while alpha differences remain distinct", () => {
  const metrics = measureWebCss(String.raw`.a { a:#ABC; b:#aabbcc; c:#aabbccff; d:#abcf; e:#abcd; f:#aabbccdd; g:#f\66 f; h:#ffff; i:#12345; }`);
  assert.equal(metrics.distinctHexColors, 3);
});

test("native, repeating, vendor and escaped gradient names count as actual functions", () => {
  const metrics = measureWebCss(String.raw`.a { background: image-set(LINEAR-GRADIENT(#000,#fff) 1x, repeating-conic-gradient(#000,#fff) 2x), -webkit-radial-gradient(#fff,#000), lin\65 ar-gradient(#000,#fff); --word: linear-gradient; }`);
  assert.equal(metrics.gradientFunctions, 4);
  assert.equal(metrics.distinctHexColors, 2);
});

test("invalid CSS and incomplete or invalid budgets fail closed", () => {
  assert.throws(() => measureWebCss(".a { color:red"), /Unclosed block/);
  const metrics = measureWebCss(".a{}\n");
  for (const invalid of [
    {}, budget({}), budget({ ...metrics, extra: 1 }),
    budget({ ...metrics, physicalLines: -1 }), budget({ ...metrics, physicalLines: 1.5 }),
  ]) assert.throws(() => compareWebCssBudget(metrics, invalid), /Invalid|must specify/);
});

test("the ratchet accepts equal or reduced counts without changing the saved limits", () => {
  const metrics = measureWebCss(".a { color:#fff; background:linear-gradient(#000,#fff)!important; }\n");
  const baseline = budget(metrics), frozen = JSON.stringify(baseline);
  assert.deepEqual(compareWebCssBudget(metrics, baseline), []);
  assert.deepEqual(compareWebCssBudget(measureWebCss(""), baseline), []);
  assert.equal(JSON.stringify(baseline), frozen);
});

for (const [metric, before, after] of [
  ["physicalLines", ".a{}", ".a{}\n.b{}"],
  ["importantDeclarations", ".a{color:red}", ".a{color:red!important}"],
  ["distinctHexColors", ".a{color:red}", ".a{color:#123}"],
  ["gradientFunctions", ".a{color:red}", ".a{background:linear-gradient(red,blue)}"],
]) test("the ratchet rejects independently growing " + metric, () => {
  const baseline = budget(measureWebCss(before));
  const growth = compareWebCssBudget(measureWebCss(after), baseline);
  assert.deepEqual(growth.map(issue => issue.metric), [metric]);
  assert.equal(growth[0].growth, 1);
});

test("the measured 5d3 baseline bounds the actual checked-out Web CSS", async () => {
  const baseline = JSON.parse(await readFile(join(repo, WEB_CSS_BASELINE), "utf8"));
  assert.equal(baseline.sourceCommit, "5d3d13ac43b0892bd5bce9809bee44bdb3ed9524");
  assert.equal(baseline.sourceBlob, "bd8496a15743f053a69bfd51ec98abf19a5fd744");
  assert.match(baseline.sourceSHA256, /^[a-f\d]{64}$/);
  assert.deepEqual(Object.keys(baseline.metrics), CSS_METRICS);
  assert.deepEqual(checkWebCssBudget(repo).growth, []);
});

test("qa-static invokes the real ratchet and fails on growth without rewriting the baseline", async () => {
  const prefix = join(tmpdir(), "nexid-web-css-budget-");
  const directory = await mkdtemp(prefix);
  const before = ".a{color:#fff}\n";
  try {
    await mkdir(join(directory, "apps/web/src/app"), { recursive: true });
    const saved = JSON.stringify(budget(measureWebCss(before)));
    await writeFile(join(directory, WEB_CSS_BASELINE), saved);
    await writeFile(join(directory, WEB_CSS_SOURCE), before);
    const command = [join(repo, "scripts/qa-static.mjs")];
    const allowed = spawnSync(process.execPath, command, { cwd: directory, encoding: "utf8", windowsHide: true });
    assert.equal(allowed.status, 0, allowed.stderr);
    await writeFile(join(directory, WEB_CSS_SOURCE), before + ".b{color:#123!important;background:linear-gradient(red,blue)}\n");
    const rejected = spawnSync(process.execPath, command, { cwd: directory, encoding: "utf8", windowsHide: true });
    assert.equal(rejected.status, 1);
    for (const metric of CSS_METRICS) assert.ok(rejected.stderr.includes("css-budget:" + metric), rejected.stderr);
    assert.equal(await readFile(join(directory, WEB_CSS_BASELINE), "utf8"), saved);
  } finally {
    assert.ok(resolve(directory).startsWith(resolve(prefix)), "remove only this test's owned temporary directory");
    await rm(directory, { recursive: true, force: true });
  }
});

test("existing mandatory Web CI executes the test wildcard and build's static QA ratchet", async () => {
  const [rootPackage, webPackage, workflow] = await Promise.all([
    readFile(join(repo, "package.json"), "utf8"),
    readFile(join(repo, "apps/web/package.json"), "utf8"),
    readFile(join(repo, ".github/workflows/enterprise-ci-security-gate.yml"), "utf8"),
  ]);
  assert.equal(JSON.parse(rootPackage).scripts["qa:static"], "node scripts/qa-static.mjs");
  assert.match(JSON.parse(rootPackage).scripts["build:web"], /^npm run qa:static &&/);
  assert.match(JSON.parse(webPackage).scripts.test, /--test tests\/\*\.test\.mjs/);
  const normalizedWorkflow = workflow.replaceAll("\r\n", "\n");
  assert.match(normalizedWorkflow, /^([ \t]+)npm test --workspace=web[ \t]*\n\1npm run build:web[ \t]*$/m);
});
