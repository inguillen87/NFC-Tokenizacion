import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import ts from 'typescript';

// Follow local static and literal dynamic imports without evaluating application code.
// Unknown CSS selectors still stay in the bundle; this graph only prevents removing
// a named marketing family when a shared component actually depends on it.
export async function localStyleSources(seeds) {
  const found = new Set();
  const pending = [...seeds];
  while (pending.length) {
    const path = resolve(pending.pop());
    if (found.has(path)) continue;
    found.add(path);
    const source = await readFile(path, 'utf8');
    const imports = ts.preProcessFile(source, true, true).importedFiles;
    for (const { fileName } of imports) {
      if (!fileName.startsWith('.')) continue;
      const base = resolve(dirname(path), fileName);
      if (extname(base) && !/\.[cm]?[jt]sx?$/.test(base)) continue;
      const candidates = extname(base) ? [base] : [base + '.ts', base + '.tsx', base + '.js', base + '.mjs', resolve(base, 'index.ts'), resolve(base, 'index.tsx')];
      let dependency;
      for (const candidate of candidates) {
        try { if ((await stat(candidate)).isFile()) { dependency = candidate; break; } }
        catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error; }
      }
      if (!dependency) throw Error('Unable to inventory local style dependency: ' + fileName + ' from ' + path);
      pending.push(dependency);
    }
  }
  return [...found].sort();
}
