#!/usr/bin/env node
import { readdirSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.git', '.vercel']);
const DYNAMIC_SEGMENT = /^\[\.\.\.?[^\]/]+\]$|^\[[^\]/]+\]$/;

function safeListDirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !IGNORE_DIRS.has(entry.name));
  } catch {
    return [];
  }
}

function walkForAppDirs(startDir) {
  const found = [];
  const stack = [startDir];

  while (stack.length) {
    const current = stack.pop();
    const children = safeListDirs(current);

    for (const child of children) {
      const abs = path.join(current, child.name);
      if (child.name === 'app') {
        found.push(abs);
      }
      stack.push(abs);
    }
  }

  return found;
}

function checkDynamicSiblingConflicts(appDir, conflicts) {
  const stack = [appDir];

  while (stack.length) {
    const current = stack.pop();
    const children = safeListDirs(current);

    const dynamicChildren = children
      .map((entry) => entry.name)
      .filter((name) => DYNAMIC_SEGMENT.test(name));

    const uniqueDynamicChildren = [...new Set(dynamicChildren)];
    if (uniqueDynamicChildren.length > 1) {
      conflicts.push({
        parent: path.relative(repoRoot, current) || '.',
        children: uniqueDynamicChildren.sort(),
      });
    }

    for (const child of children) {
      stack.push(path.join(current, child.name));
    }
  }
}

function main() {
  const appDirs = walkForAppDirs(repoRoot);
  const conflicts = [];

  for (const appDir of appDirs) {
    checkDynamicSiblingConflicts(appDir, conflicts);
  }

  if (conflicts.length > 0) {
    console.error('❌ Next dynamic route conflicts detected:');
    for (const conflict of conflicts) {
      console.error(`- ${conflict.parent} -> ${conflict.children.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`✅ No Next dynamic route sibling conflicts found across ${appDirs.length} app directories.`);
  process.exit(0);
}

main();
