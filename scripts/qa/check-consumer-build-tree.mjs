import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Next 16 rewrites its generated route-types import between dev and build.
// Allow precisely that generated line; never ignore the whole file's content.
const file = 'apps/web/next-env.d.ts';
const before = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
const after = readFileSync(file, 'utf8');
const normalize = value => value.replace(/\r\n/g, '\n').replace(/^import "\.\/\.next\/(?:dev\/)?types\/routes\.d\.ts";$/m, 'import "./.next/types/routes.d.ts";');
assert.equal(normalize(after), normalize(before), 'Unexpected mutation of next-env.d.ts');
execFileSync('git', ['diff', '--exit-code', '--', 'apps', 'packages', 'package.json', 'package-lock.json', ':(exclude)apps/web/next-env.d.ts'], { stdio: 'inherit' });
console.log('Build tree unchanged except the verified Next-generated route-types import.');
