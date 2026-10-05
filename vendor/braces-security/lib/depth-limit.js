'use strict';

const DEFAULT_MAX_DEPTH = 64;
const HARD_MAX_DEPTH = 128;

exports.maxDepth = (options = {}) => {
  const depth = options && options.maxDepth === undefined ? DEFAULT_MAX_DEPTH : options && options.maxDepth;
  if (!Number.isInteger(depth) || depth < 1 || depth > HARD_MAX_DEPTH) {
    throw new RangeError('maxDepth must be an integer between 1 and 128');
  }
  return depth;
};

exports.checkDepth = (depth, maximum) => {
  if (depth > maximum) {
    const error = new RangeError('Brace input exceeds the maximum nesting depth');
    error.code = 'ERR_BRACES_MAX_DEPTH';
    throw error;
  }
};

// Public walkers also accept ASTs: validate iteratively before any recursive walk.
const checkParents = (ast, maximum) => {
  // Unbalanced patterns keep historical parent links after parser flattening.
  const ancestors = new Set();
  let current = ast;
  let ancestorDepth = 0;
  while (current && current.parent) {
    if (ancestors.has(current) || typeof current.parent !== 'object') {
      const error = new TypeError('Invalid or cyclic brace AST parent chain');
      error.code = 'ERR_BRACES_AST_INVALID';
      throw error;
    }
    ancestors.add(current);
    if (current.parent.type !== 'root' || current.parent.parent) {
      exports.checkDepth(++ancestorDepth, maximum);
    }
    current = current.parent;
  }
};
exports.checkAst = (ast, maximum) => {
  const pending = [{ node: ast, depth: 0, parent: null }];
  const seen = new Set();
  while (pending.length) {
    const { node, depth, parent } = pending.pop();
    exports.checkDepth(depth, maximum);
    if (!node || typeof node !== 'object' || seen.has(node) ||
        (node.value !== undefined && typeof node.value !== 'string')) {
      const error = new TypeError('Invalid or cyclic brace AST');
      error.code = 'ERR_BRACES_AST_INVALID';
      throw error;
    }
    seen.add(node);
    checkParents(node, maximum);
    if (!node.nodes) continue;
    if (!Array.isArray(node.nodes)) throw new TypeError('Brace AST nodes must be an array');
    for (const child of node.nodes) {
      pending.push({ node: child, depth: depth + (child && child.nodes ? 1 : 0), parent: node });
    }
  }
};
