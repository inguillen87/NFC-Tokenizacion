// Test-process-only HTTP boundary; not imported by the application.
if (process.env.NODE_ENV !== 'test' || process.env.VERCEL_ENV !== 'test') throw Error('DEPENDENCY_QA_TEST_RUNTIME_REQUIRED');
const allowed = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
function inspect(value) {
 const host = typeof value === 'string' || value instanceof URL ? new URL(value).hostname : String(value?.hostname || value?.host || 'localhost').replace(/:\d+$/, '');
 if (!allowed.has(host)) throw Error('DEPENDENCY_QA_NON_LOOPBACK_NETWORK_BLOCKED');
}
const original = globalThis.fetch;
if (original) globalThis.fetch = function(resource, options) {
 inspect(resource instanceof Request ? resource.url : resource);
 return original(resource, options);
};
for (const name of ['node:http', 'node:https']) {
 const module = require(name);
 for (const method of ['request', 'get']) {
  const fn = module[method];
  module[method] = function(...args) { inspect(args[0]); return fn.apply(this, args); };
 }
}
