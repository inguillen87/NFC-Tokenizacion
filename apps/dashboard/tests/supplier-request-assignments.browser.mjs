import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';

assert.ok(process.env.PLAYWRIGHT_MODULE && process.env.AXE_MODULE_PATH, 'Use installed browser/axe modules; no downloads');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const axeSource = await readFile(process.env.AXE_MODULE_PATH, 'utf8');
const dashboard = fileURLToPath(new URL('../', import.meta.url)), root = resolve(dashboard, '../..');
const output = resolve(process.env.QA_OUTPUT || 'artifacts/supplier-request-assignments-browser');
await mkdir(output, { recursive: true });
const operatorId = '20000000-0000-4000-8000-000000000001', otherOperatorId = '20000000-0000-4000-8000-000000000002';
const tenantId = '10000000-0000-4000-8000-000000000001', otherTenantId = '10000000-0000-4000-8000-000000000002';
const operator = { id: '30000000-0000-4000-8000-000000000001', userId: operatorId, role: 'supplier-operator', tenantSlug: null, tenantId: null, permissions: ['supplier_request.assigned.read', 'supplier_request.assigned.review'], deniedPermissions: [], isDemo: false };
const superadmin = { ...operator, userId: '20000000-0000-4000-8000-000000000003', role: 'super-admin', permissions: ['supplier_order.create', 'supplier_request.assign'] };
const fixture = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{SupplierRequestWorkspace}from'./src/components/supplier-request-workspace';
function Fixture(){const[props,setProps]=useState(window.__qaInitial);window.__qaContext=next=>setProps(current=>({...current,...next}));return <div className="dashboard-main mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8"><aside aria-label="Alcance de la prueba" className="mb-4 text-sm">QA local sintética: componentes reales, transporte simulado. No crea cuentas, pedidos ni asignaciones en producción.</aside><SupplierRequestWorkspace {...props}/></div>}createRoot(document.getElementById('root')).render(<Fixture/>);`;
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'synthetic-navigation', setup(builder) {
  builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'qa' }));
  builder.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: `const router={push(url){(window.__qaNavigations ||= []).push(url)},replace(url){(window.__qaNavigations ||= []).push(url)},refresh(){}};export const useRouter=()=>router;export const useSearchParams=()=>new URLSearchParams(location.search);`, loader: 'js' }));
} }] });
const css = (await postcss([tailwindcss({ content: [join(dashboard, 'src/**/*.{ts,tsx}').replaceAll('\\', '/'), join(root, 'packages/ui/src/**/*.{ts,tsx}').replaceAll('\\', '/'), { raw: fixture, extension: 'tsx' }], darkMode: ['selector', '[data-theme="dark"]'], theme: { extend: { colors: { brand: { dark: '#020617', card: '#0f172a', border: '#1e293b', cyan: '#06b6d4', blue: '#3b82f6' } } } }, plugins: [] })]).process(await readFile(join(dashboard, 'src/app/globals.css'), 'utf8'), { from: undefined })).css + (bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text || '');
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).contents;
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://qa.invalid');
  if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
  if (url.pathname === '/fixture.js') { res.setHeader('content-type', 'text/javascript'); return res.end(js); }
  if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  if (url.pathname !== '/') { res.writeHead(404); return res.end(); }
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  res.setHeader('content-type', 'text/html;charset=utf-8');
  res.end(`<!doctype html><html lang="es-AR" data-theme="${theme}" class="theme-${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Asignaciones · QA sintética</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
});
await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH });
const report = { localOnly: true, syntheticData: true, actualComponents: ['SupplierRequestWorkspace'], actualClientContracts: true, httpBoundaryMocked: true, realDatabase: false, productionTested: false, checks: [], views: [], clientErrors: [], unexpectedRequests: [] };
const check = (value, description) => { report.checks.push({ description, passed: Boolean(value) }); assert.ok(value, description); };
const tick = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
async function waitFor(predicate) { for (let n = 0; n < 300; n++) { if (predicate()) return; await new Promise(done => setTimeout(done, 20)); } assert.ok(predicate(), 'Expected synthetic HTTP operation'); }
const requestItem = (patch = {}) => ({ id: randomUUID(), tenant_id: tenantId, tenant_slug: 'qa-only', title: 'Solicitud sintética asignada', construction_id: 'tt_bridge', quantity: 125, pack_purpose: 'trial_integration', notes: 'Original comercial sintético e inmutable.', status: 'submitted', revision: 3, created_at: '2026-09-23T12:00:00.000Z', updated_at: '2026-09-23T12:01:00.000Z', submitted_at: '2026-09-23T12:01:00.000Z', order_id: null, review_summary: { state: 'pending', revision: 0, updated_at: null }, assignment: { operator_id: operatorId, revision: 1, updated_at: '2026-09-23T12:02:00.000Z' }, ...patch });
const event = (row, revision, patch = {}) => ({ id: randomUUID(), revision, request_revision: row.revision, action: revision % 2 ? 'request_information' : 'respond', message: `Mensaje sintético ${revision}`, actor_id: operatorId, created_at: new Date(Date.UTC(2026, 8, 23, 13, 0, revision)).toISOString(), ...patch });
const summary = events => events.length ? { state: events.at(-1).action === 'request_information' ? 'needs_information' : 'answered', revision: events.at(-1).revision, updated_at: events.at(-1).created_at } : { state: 'pending', revision: 0, updated_at: null };
async function inspect(page, name, width, theme) {
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => (await axe.run('main', { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  const clippedControls = await page.locator('main input,main textarea,main select,main button,main fieldset,main code').evaluateAll(nodes => nodes.filter(node => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.left < -1 || box.right > document.documentElement.clientWidth + 1); }).map(node => node.getAttribute('data-testid') || node.tagName));
  const screenshot = `${name}-${width}-${theme}.png`; await page.screenshot({ path: join(output, screenshot), fullPage: true });
  report.views.push({ name, width, theme, violations, dimensions, clippedControls, screenshot });
  check(!violations.some(v => ['serious', 'critical'].includes(v.impact)), `${name} ${width} ${theme}: axe serious/critical zero`);
  check(dimensions.scrollWidth <= dimensions.width + 1 && !clippedControls.length, `${name} ${width} ${theme}: no overflow or clipped controls`);
}

// Synthetic HTTP persistence below tests the actual browser components and
// response contracts. Real authorization, CAS and row locks are certified only
// by the independent API/isolated PostgreSQL tests, never by these mocks.
async function scenario(width = 390, theme = 'light', options = {}) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'es-AR' });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  const props = { access: { ...operator, ...options.access }, ...(options.id ? { initialRequestId: options.id } : {}), ...(options.tenant ? { initialTenant: options.tenant } : {}) };
  await page.addInitScript(value => window.__qaInitial = value, props);
  page.on('pageerror', error => report.clientErrors.push(error.message));
  const state = { access: props.access, reads: [], writes: [], reviewWrites: [], assignmentWrites: [], rows: options.store?.rows || new Map((options.rows || []).map(row => [row.id, structuredClone(row)])), reviews: options.store?.reviews || new Map(options.history || []), reviewReceipts: options.store?.reviewReceipts || new Map(), assignmentEvents: options.store?.assignmentEvents || new Map(options.assignments || []), assignmentReceipts: options.store?.assignmentReceipts || new Map(), readMode: options.readMode || 'success', reviewMode: 'success', assignmentMode: 'success', assignmentReadMode: 'success', candidatesMode: options.candidatesMode || 'success', pending: [], pendingReview: [], pendingAssignment: [], truncated: false };
  for (const [id, events] of state.reviews) state.rows.get(id).review_summary = summary(events);
  for (const row of state.rows.values()) if (!state.assignmentEvents.has(row.id) && row.assignment?.revision === 1) state.assignmentEvents.set(row.id,[{ id: randomUUID(), revision: 1, request_revision: row.revision, action: 'assign', operator_id: row.assignment.operator_id, actor_id: superadmin.userId, created_at: row.assignment.updated_at }]);
  const assignedScope = () => ({ mode: 'assigned', operator_id: state.access.userId });
  const tenantScope = row => ({ mode: 'tenant', tenant_id: row.tenant_id, tenant_slug: row.tenant_slug });
  const canRead = row => row && row.status !== 'draft' && row.assignment?.operator_id === state.access.userId;
  async function send(route, status, body) { await route.fulfill({ status, headers: { 'content-type': 'application/json', 'x-nexid-data-mode': 'production' }, body: JSON.stringify(body) }).catch(() => {}); }
  function reviewResult(id, assigned, before) {
    const row = state.rows.get(id), events = state.reviews.get(id) || [], eligible = before === null ? events : events.filter(item => item.revision < before), history = eligible.slice(-100), truncated = eligible.length > history.length;
    return { ok: true, protocol: 'nexid.supplier-request-review.v1', scope: assigned ? assignedScope() : tenantScope(row), request_id: id, request_revision: row.revision, review: summary(events), history, count: history.length, truncated, next_before_revision: truncated ? history[0].revision : null };
  }
  function commitReview(input) {
    const { id, assigned, key, body } = input, row = state.rows.get(id), prior = state.reviewReceipts.get(key), events = state.reviews.get(id) || [];
    if (assigned && !canRead(row)) return { ok: false, reason: 'supplier_request_review_scope_forbidden' };
    if (prior) return { ...reviewResult(id, assigned, null), receipt: prior, idempotent_replay: true };
    if (body.expected_revision !== events.length || body.expected_request_revision !== row.revision) return { ok: false, reason: 'supplier_request_review_revision_conflict' };
    const next = event(row, events.length + 1, { message: body.message, action: body.action, actor_id: state.access.userId });
    state.reviews.set(id, [...events, next]); row.review_summary = summary([...events, next]);
    const receipt = { idempotency_key: key, action: body.action, revision: next.revision }; state.reviewReceipts.set(key, receipt);
    return { ...reviewResult(id, assigned, null), receipt, idempotent_replay: false };
  }
  function assignmentResult(id, before = null) {
    const row = state.rows.get(id), events = state.assignmentEvents.get(id) || [], eligible = before === null ? events : events.filter(event => event.revision < before), history = eligible.slice(-100), truncated = eligible.length > history.length;
    return { ok: true, protocol: 'nexid.supplier-request-assignment.v1', scope: tenantScope(row), request_id: id, request_revision: row.revision, assignment: row.assignment || { operator_id: null, revision: 0, updated_at: null }, history, count: history.length, truncated, next_before_revision: truncated ? history[0].revision : null };
  }
  function commitAssignment(input) {
    const { id, key, body } = input, row = state.rows.get(id), events = state.assignmentEvents.get(id) || [], prior = state.assignmentReceipts.get(key);
    if (prior) return { ...assignmentResult(id), receipt: prior, idempotent_replay: true };
    if (body.expected_revision !== events.length || body.expected_request_revision !== row.revision) return { ok: false, reason: 'supplier_request_assignment_revision_conflict' };
    const action = body.operator_id ? 'assign' : 'unassign', next = { id: randomUUID(), revision: events.length + 1, request_revision: row.revision, action, operator_id: body.operator_id, actor_id: state.access.userId, created_at: new Date(Date.UTC(2026,8,23,14,0,events.length+1)).toISOString() };
    state.assignmentEvents.set(id,[...events,next]); row.assignment = { operator_id: body.operator_id, revision: next.revision, updated_at: next.created_at };
    const receipt = { idempotency_key: key, action, revision: next.revision }; state.assignmentReceipts.set(key,receipt);
    return { ...assignmentResult(id), receipt, idempotent_replay: false };
  }
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) { report.unexpectedRequests.push(request.method() + ' ' + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith('/api/admin/supplier-requests')) {
      const parts = url.pathname.split('/').filter(Boolean), assigned = parts[3] === 'assigned', id = parts[assigned ? 4 : 3], action = parts[assigned ? 5 : 4];
      if (request.method() === 'GET') state.reads.push(url.pathname + url.search);
      if (assigned) assert.equal(url.searchParams.has('tenant'), false, 'Assigned namespace must never send a tenant selector');
      if (id === 'operators' && !action && request.method() === 'GET') {
        if (state.candidatesMode === '503') return send(route,503,{ok:false,reason:'synthetic_unavailable'});
        const operators=state.candidatesMode==='empty'?[]:[{id:operatorId,display_name:'Operador sintético A'},{id:otherOperatorId,display_name:'Operador sintético B'}];
        return send(route,200,{ok:true,protocol:'nexid.supplier-request-assignment.v1',scope:{mode:'global',tenant_id:null,tenant_slug:null},operators,count:operators.length,truncated:false});
      }
      if (action === 'assignment' && !assigned) {
        if (request.method() === 'GET') {
          if (state.assignmentReadMode === '503') return send(route,503,{ok:false,reason:'synthetic_unavailable'});
          const result = assignmentResult(id,url.searchParams.has('before_revision')?Number(url.searchParams.get('before_revision')):null);
          if (state.assignmentReadMode === 'delayed') { state.pendingAssignment.push({route,result,read:true}); return; }
          return send(route,200,result);
        }
        const input = { id,key:request.headers()['idempotency-key'],body:request.postDataJSON() }; state.assignmentWrites.push(input);
        if (state.assignmentMode === 'delayed' || state.assignmentMode === 'hang') { state.pendingAssignment.push({route,input}); return; }
        if (state.assignmentMode === 'conflict') return send(route,409,{ok:false,reason:'supplier_request_assignment_revision_conflict'});
        if (state.assignmentMode === 'forbidden') return send(route,403,{ok:false,reason:'supplier_request_assignment_scope_forbidden'});
        const result = commitAssignment(input);
        if (state.assignmentMode === 'commit-lost') return send(route,503,{ok:false,reason:'synthetic_response_lost'});
        return send(route,result.ok?200:409,result);
      }
      if (action === 'review') {
        const row = state.rows.get(id);
        const input=request.method()==='POST'?{ id, assigned, key: request.headers()['idempotency-key'], body: request.postDataJSON() }:null;
        if(input)state.reviewWrites.push(input);
        if(state.reviewAuthStatus)return send(route,state.reviewAuthStatus,{ok:false,reason:'supplier_request_review_scope_forbidden'});
        if (!row || (assigned && !canRead(row))) return send(route, request.method() === 'GET' ? 404 : 403, { ok: false, reason: 'supplier_request_review_scope_forbidden' });
        if (request.method() === 'GET') return send(route, 200, reviewResult(id, assigned, url.searchParams.has('before_revision') ? Number(url.searchParams.get('before_revision')) : null));
        if (state.reviewMode === 'delayed' || state.reviewMode === 'hang') { state.pendingReview.push({ route, input }); return; }
        if (state.reviewMode === 'forbidden') return send(route, 403, { ok: false, reason: 'supplier_request_review_scope_forbidden' });
        if (state.reviewMode === 'conflict') return send(route, 409, { ok: false, reason: 'supplier_request_review_revision_conflict' });
        const result = commitReview(input);
        if (state.reviewMode === 'commit-lost') return send(route, 503, { ok: false, reason: 'synthetic_response_lost' });
        return send(route, result.ok ? 200 : 409, result);
      }
      if (assigned && request.method() === 'GET') {
        if (state.readMode === '503') return send(route, 503, { ok: false, reason: 'synthetic_unavailable' });
        if (!id && state.listAuthStatus) return send(route, state.listAuthStatus, { ok: false, reason: 'supplier_request_scope_forbidden' });
        const rows = [...state.rows.values()].filter(canRead).filter(item => item.id !== state.listExcludedId), row = id ? state.rows.get(id) : null;
        if (id && !canRead(row)) return send(route, 404, { ok: false, reason: 'supplier_request_not_found' });
        const result = { ok: true, protocol: 'nexid.supplier-request.v1', scope: assignedScope(), ...(id ? { request: structuredClone(row) } : { items: structuredClone(rows), count: rows.length, truncated: state.truncated }) };
        if (state.readMode === 'foreign-scope') result.scope.operator_id = otherOperatorId;
        if (state.readMode === 'foreign-assignment') (id ? result.request : result.items[0]).assignment.operator_id = otherOperatorId;
        if (state.readMode === 'draft') (id ? result.request : result.items[0]).status = 'draft';
        if (state.readMode === 'demo') result.demo = true;
        if (state.readMode === 'delayed') { state.pending.push({ route, result }); return; }
        return send(route, 200, result);
      }
      if (!assigned && request.method() === 'GET' && !action) {
        const tenant = url.searchParams.get('tenant'), row = id ? state.rows.get(id) : null;
        const scope = tenant ? tenantScope(row || [...state.rows.values()].find(item => item.tenant_slug === tenant)) : { mode: 'global', tenant_id: null, tenant_slug: null };
        if (id) return send(route, row ? 200 : 404, row ? { ok: true, protocol: 'nexid.supplier-request.v1', scope, request: row } : { ok: false, reason: 'supplier_request_not_found' });
        const items = [...state.rows.values()].filter(row => row.status !== 'draft' && (!tenant || row.tenant_slug === tenant));
        return send(route, 200, { ok: true, protocol: 'nexid.supplier-request.v1', scope, items, count: items.length, truncated: state.truncated });
      }
      state.writes.push(request.method() + ' ' + url.pathname);
    }
    if (request.method() === 'GET' && ['/', '/fixture.js', '/favicon.ico'].includes(url.pathname)) return route.continue();
    report.unexpectedRequests.push(request.method() + ' ' + url.pathname); return route.abort();
  });
  state.releaseReads = async () => { for (const value of state.pending.splice(0)) await send(value.route, 200, value.result); };
  state.releaseReview = async () => { for (const { route, input } of state.pendingReview.splice(0)) { const result = commitReview(input); await send(route, result.ok ? 200 : 403, result); } };
  state.releaseAssignment = async () => { for (const value of state.pendingAssignment.splice(0)) { const result = value.read ? value.result : commitAssignment(value.input); await send(value.route,result.ok?200:409,result); } };
  state.updateContext = async next => { if (next.access) state.access = next.access; await page.evaluate(value => window.__qaContext(value), next); await tick(page); };
  await page.goto(origin + '/?theme=' + theme, { waitUntil: 'networkidle' }); await page.locator('main').waitFor(); await tick(page);
  return { context, page, state };
}
async function ready(page) { await page.getByTestId('supplier-request-review-panel').waitFor(); await page.waitForFunction(() => { const node = document.querySelector('[data-testid="supplier-request-review-state"]'); return node && !node.textContent.includes('Consultando'); }); }
async function inspectQuestion(page, text) { await page.getByTestId('supplier-request-review-message').fill(text); await page.getByTestId('supplier-request-review-inspect').click(); await page.getByTestId('supplier-request-review-confirmation').waitFor(); }
async function saved(page, revision) { await page.getByTestId('supplier-request-review-receipt').filter({ hasText: `Mensaje guardado · revisión ${revision}` }).waitFor(); }
async function assignmentReady(page) { await page.getByTestId('supplier-request-assignment-select').waitFor(); await page.waitForFunction(()=>!document.querySelector('[data-testid="supplier-request-assignment-refresh"]')?.disabled); }
async function inspectAssignment(page,id) { await page.getByTestId('supplier-request-assignment-select').selectOption(id || ''); await page.getByTestId('supplier-request-assignment-inspect').click(); await page.getByTestId('supplier-request-assignment-confirm').waitFor(); }
async function assignmentSaved(page,revision) { await page.getByTestId('supplier-request-assignment-panel').getByRole('status').filter({hasText:`Cambio confirmado · revisión ${revision}`}).waitFor(); }
try {

  // Regressions for the workbench, against actual components and synthetic transport only.
  const removedRow=requestItem({title:'Withdrawn selected request',notes:'Previously authorized commercial detail'}), keptRow=requestItem({title:'Still assigned request'});
  const removed=await scenario(390,'light',{rows:[removedRow,keptRow],id:removedRow.id});await ready(removed.page);
  await removed.page.getByTestId('supplier-request-review-message').fill('Local draft before revocation');
  removed.state.rows.get(removedRow.id).assignment.operator_id=null;
  await removed.page.getByRole('button',{name:'Actualizar mis asignaciones'}).click();
  await removed.page.waitForFunction(()=>[...document.querySelectorAll('button')].some(node=>node.textContent==='Actualizar mis asignaciones'&&!node.disabled));await tick(removed.page);
  check(await removed.page.getByTestId('supplier-request-detail-heading').count()===0,'A successful refreshed list revalidates and withdraws a selected record whose assignment was revoked');
  check(!(await removed.page.locator('main').textContent()).includes(removedRow.id)&&!(await removed.page.locator('main').textContent()).includes(removedRow.notes),'Revoked selected record leaves no cached commercial detail or reference after list success');
  check(await removed.page.getByTestId('supplier-request-open').count()===1&&removed.state.reviewWrites.length===0,'Record withdrawal preserves other authorized assignments and sends no message');await removed.context.close();
  const outsideRow=requestItem({title:'Authorized outside this page'}),insideRow=requestItem({title:'Loaded record'});
  const outside=await scenario(390,'light',{rows:[outsideRow,insideRow],id:outsideRow.id});await ready(outside.page);
  await outside.page.getByTestId('supplier-request-review-message').fill('Keep this unsent draft');outside.state.truncated=true;outside.state.listExcludedId=outsideRow.id;
  const priorDetailReads=outside.state.reads.filter(path=>path.endsWith('/assigned/'+outsideRow.id)).length;
  await outside.page.getByRole('button',{name:'Actualizar mis asignaciones'}).click();
  await outside.page.waitForFunction(()=>[...document.querySelectorAll('button')].some(node=>node.textContent==='Actualizar mis asignaciones'&&!node.disabled));await tick(outside.page);
  check(outside.state.reads.filter(path=>path.endsWith('/assigned/'+outsideRow.id)).length===priorDetailReads+1,'Truncation is not a revocation: selected record is independently reauthorized');
  check(await outside.page.getByTestId('supplier-request-detail-heading').count()===1&&await outside.page.getByTestId('supplier-request-review-message').inputValue()==='Keep this unsent draft','Successful access revalidation preserves the selected panel and unsent text');
  check((await outside.page.getByTestId('supplier-request-inbox-count').innerText()).includes('1 de 1')&&outside.state.reviewWrites.length===0,'Revalidating an off-page detail does not inflate the loaded denominator or write');await outside.context.close();
  for(const status of [401,403,404]){
    const row=requestItem({title:'Private cached '+status}),test=await scenario(390,'light',{rows:[row],id:row.id});await ready(test.page);test.state.listAuthStatus=status;
    await test.page.getByRole('button',{name:'Actualizar mis asignaciones'}).click();await test.page.getByRole('status').filter({hasText:'No se confirmó acceso a tu bandeja'}).waitFor();
    check(await test.page.getByTestId('supplier-request-detail-heading').count()===0&&await test.page.getByTestId('supplier-request-open').count()===0,'List denial '+status+' clears both cached detail and inbox');
    check(!await test.page.getByRole('group',{name:'Filtrar solicitudes por próximo paso'}).count()&&test.state.reviewWrites.length===0,'List denial '+status+' does not render zero-valued successful metrics or perform writes');await test.context.close();
  }
  for(const [width,theme] of [[320,'light'],[390,'dark'],[1440,'light'],[1440,'dark']]){
    const pending=requestItem({title:'Edición Única',tenant_slug:'mendoza',submitted_at:'2026-09-20T10:00:00.000Z'});
    const answered=requestItem({title:'Empresa respondió',review_summary:{state:'answered',revision:2,updated_at:'2026-09-23T12:04:00.000Z'}});
    const waiting=requestItem({title:'Aclaración pendiente',review_summary:{state:'needs_information',revision:1,updated_at:'2026-09-22T12:04:00.000Z'}});
    const prepared=requestItem({title:'Pedido preparado',status:'provisioned',order_id:randomUUID()});
    const test=await scenario(width,theme,{rows:[pending,prepared,waiting,answered]});
    const metrics=test.page.getByRole('group',{name:'Filtrar solicitudes por próximo paso'});
    check(await metrics.getByRole('button').count()===4&&(await test.page.getByTestId('supplier-request-open').first().getAttribute('aria-label')).includes(answered.title),'Workbench exposes four scoped metric filters and reviews company responses first');
    await metrics.getByRole('button',{name:'Para revisión de NexID: 2. Filtrar bandeja',exact:true}).click();
    check(await test.page.getByTestId('supplier-request-open').count()===2,'Actionable metric filters pending and answered records only');
    await test.page.getByTestId('supplier-request-inbox-search').fill('mendoza edicion');
    check(await test.page.getByTestId('supplier-request-open').count()===1&&(await metrics.innerText()).includes('4'),'Accent-insensitive multi-term search spans title and tenant while loaded counters remain unchanged');
    await test.page.getByTestId('supplier-request-inbox-search').fill('not-a-loaded-record');await test.page.getByRole('button',{name:'Limpiar búsqueda y filtros'}).click();
    check(await test.page.getByTestId('supplier-request-open').count()===4&&await test.page.getByTestId('supplier-request-inbox-filter').inputValue()==='all','Empty-search recovery resets both query and management filter');
    await test.page.getByTestId('supplier-assigned-sort').selectOption('oldest_activity');
    check((await test.page.getByTestId('supplier-request-open').first().getAttribute('aria-label')).includes(pending.id),'Oldest activity sort uses the submission/review time and full reference');
    const waitingMetric=metrics.getByRole('button',{name:'Esperando a la empresa: 1. Filtrar bandeja',exact:true});await waitingMetric.focus();await test.page.keyboard.press('Enter');
    check(await waitingMetric.getAttribute('aria-pressed')==='true'&&await test.page.getByTestId('supplier-request-open').count()===1,'Metric filter operates by keyboard and announces its pressed state');
    await metrics.getByRole('button',{name:'Solicitudes cargadas: 4. Filtrar bandeja',exact:true}).click();
    check(test.state.reviewWrites.length===0&&test.state.assignmentWrites.length===0&&test.state.writes.length===0,'Workbench presentation controls never create business writes');
    await inspect(test.page,'operator-workbench',width,theme);await test.context.close();
  }
  for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
    const first = requestItem(), foreign = requestItem({ title: 'Sólo otro operador', assignment: { operator_id: otherOperatorId, revision: 1, updated_at: '2026-09-23T12:02:00.000Z' } });
    const otherCompany = requestItem({ title: 'Segunda empresa asignada', tenant_id: otherTenantId, tenant_slug: 'qa-other' });
    const test = await scenario(width, theme, { rows: [first, foreign, otherCompany] });
    check(await test.page.getByTestId('supplier-request-open').count() === 2, 'Assigned list contains only the two rows assigned to the current operator');
    check(await test.page.getByTestId('supplier-request-tenant').count() === 0 && await test.page.getByTestId('supplier-request-save').count() === 0 && await test.page.getByTestId('supplier-request-prepare').count() === 0, 'Operator has no tenant selector, draft save, or technical preparation control');
    await inspect(test.page, 'operator-inbox', width, theme);
    await test.page.getByTestId('supplier-request-open').first().click(); await ready(test.page);
    check(await test.page.getByTestId('supplier-request-detail-heading').evaluate(node => document.activeElement === node), 'Confirmed assigned request opening moves focus to its heading');
    const question = 'Confirmar diámetro y adhesivo para el envase lleno. <b>Literal</b>';
    await inspectQuestion(test.page, question);
    check(test.state.reviewWrites.length === 0, 'Reviewing an operator question never sends it automatically');
    await inspect(test.page, 'operator-question-confirmation', width, theme);
    await test.page.getByTestId('supplier-request-review-confirm').click(); await saved(test.page, 1);
    check(test.state.reviewWrites.length === 1 && test.state.reviewWrites[0].body.action === 'request_information' && test.state.reviewWrites[0].body.expected_request_revision === 3, 'Operator sends exactly one source-bound clarification');
    check(test.state.rows.get(first.id).revision === 3 && test.state.rows.get(first.id).status === 'submitted' && test.state.writes.length === 0, 'Clarification does not mutate commercial input or create a technical order');
    check(test.state.reads.every(path => path.includes('/assigned') && !path.includes('tenant=')), 'Every operator read uses the assigned namespace without a tenant selector');
    await test.context.close();
  }
  for(const theme of ['light','dark'])for(const width of [390,1440]){
    const row=requestItem({assignment:{operator_id:null,revision:0,updated_at:null}}), test=await scenario(width,theme,{access:superadmin,rows:[row],id:row.id,tenant:row.tenant_slug}); await assignmentReady(test.page);await ready(test.page);
    await inspectAssignment(test.page,operatorId);check(test.state.assignmentWrites.length===0,'Choosing and reviewing an operator does not write an assignment');
    await test.page.getByTestId('supplier-request-assignment-panel').getByRole('button',{name:'Volver',exact:true}).click();check(await test.page.getByTestId('supplier-request-assignment-select').inputValue()===operatorId&&test.state.assignmentWrites.length===0,'Cancelled assignment confirmation preserves the selected operator');
    await test.page.getByTestId('supplier-request-assignment-inspect').click();await inspect(test.page,'superadmin-assignment-confirmation',width,theme);
    test.state.assignmentMode='delayed';await test.page.getByTestId('supplier-request-assignment-confirm').evaluate(button=>{button.click();button.click();});await waitFor(()=>test.state.pendingAssignment.length===1);
    check(test.state.assignmentWrites.length===1&&await test.page.getByRole('button',{name:'Nueva solicitud',exact:true}).isDisabled(),'Immediate duplicate assignment confirmation is suppressed and parent navigation is locked');
    check(await test.page.getByTestId('supplier-request-review-refresh').isDisabled(),'Pending assignment prevents a competing clarification action');
    await test.state.releaseAssignment();await assignmentSaved(test.page,1);
    check(test.state.assignmentWrites[0].body.expected_revision===0&&test.state.assignmentWrites[0].body.expected_request_revision===3&&test.state.assignmentWrites[0].body.operator_id===operatorId,'Explicit assignment binds operator, commercial revision and assignment revision');
    await test.state.updateContext({access:operator,initialRequestId:row.id,initialTenant:''});await ready(test.page);
    check(await test.page.getByTestId('supplier-request-assignment-panel').count()===0&&await test.page.getByTestId('supplier-request-prepare').count()===0,'Assigned operator cannot reassign itself or prepare a technical order');
    await inspectQuestion(test.page,'Pregunta del responsable recién asignado');await test.page.getByTestId('supplier-request-review-confirm').click();await saved(test.page,1);
    await test.state.updateContext({access:superadmin,initialRequestId:row.id,initialTenant:row.tenant_slug});await assignmentReady(test.page);await ready(test.page);
    check((await test.page.getByTestId('supplier-request-review-history').innerText()).includes('responsable recién asignado'),'SA sees the assigned operator question in the same synthetic durable history');
    test.state.assignmentMode='success';await inspectAssignment(test.page,null);await test.page.getByTestId('supplier-request-assignment-confirm').click();await assignmentSaved(test.page,2);await inspect(test.page,'superadmin-revoked',width,theme);
    await test.state.updateContext({access:operator,initialRequestId:row.id,initialTenant:''});await test.page.getByRole('alert').filter({hasText:'No se confirmó el acceso'}).waitFor();
    check(await test.page.getByTestId('supplier-request-open').count()===0&&await test.page.getByTestId('supplier-request-detail-heading').count()===0,'Revoked operator cannot reopen the request after explicit reauthentication context change');
    check(test.state.rows.get(row.id).revision===3&&test.state.rows.get(row.id).notes===row.notes&&test.state.writes.length===0,'Assignment and clarification leave submitted business content and technical-order creation unchanged');await test.context.close();
  }
  for(const patch of [{permissions:[]},{deniedPermissions:['supplier_request.assigned.read']},{isDemo:true},{userId:undefined},{tenantSlug:'qa-only',tenantId},{permissions:['*']}]){
    const test=await scenario(390,'light',{rows:[requestItem()],access:patch});await test.page.getByRole('alert').waitFor();check(test.state.reads.length===0&&test.state.reviewWrites.length===0,'Invalid supplier identity/demo/deny/wildcard performs no data reads or writes: '+JSON.stringify(patch));await test.context.close();
  }
  for(const readMode of ['foreign-scope','foreign-assignment','draft','demo','503']){
    const row=requestItem(),test=await scenario(390,'light',{rows:[row],readMode});await test.page.getByRole('status').filter({hasText:'No se confirmó tu bandeja'}).waitFor();check(await test.page.getByTestId('supplier-request-open').count()===0&&test.state.reviewWrites.length===0,`Invalid ${readMode} assigned response never exposes a selectable record or implies an empty successful inbox`);await test.context.close();
  }
  const readonlyRow=requestItem(),readonly=await scenario(390,'light',{rows:[readonlyRow],id:readonlyRow.id,access:{permissions:['supplier_request.assigned.read']}});await ready(readonly.page);check(await readonly.page.getByTestId('supplier-request-review-message').count()===0&&readonly.state.reviewWrites.length===0,'Explicit read-only supplier grant can inspect the assigned history but not ask a question');await readonly.context.close();
  for(const status of [401,403,404]){
    const row=requestItem({title:'TÍTULO RETIRADO '+status,notes:'CONTENIDO COMERCIAL RETIRADO '+status}),test=await scenario(390,'light',{rows:[row],id:row.id});await ready(test.page);
    await inspectQuestion(test.page,'Mensaje local conservado tras retirar el acceso');test.state.reviewAuthStatus=status;await test.page.getByTestId('supplier-request-review-confirm').click();await test.page.getByTestId('supplier-request-access-withdrawn').waitFor();
    const rendered=await test.page.locator('main').textContent();check(!rendered.includes(row.title)&&!rendered.includes(row.notes)&&!rendered.includes(row.id),'Confirmed '+status+' hides cached title, UUID and commercial details');
    check(rendered.includes('Mensaje local conservado')&&await test.page.getByTestId('supplier-request-review-confirm').count()===0&&await test.page.getByTestId('supplier-request-review-retry').count()===0,'Revoked access preserves local text but exposes no further write/retry control');
    test.page.once('dialog',dialog=>dialog.dismiss());await test.page.getByTestId('supplier-request-exit-withdrawn').click();check(await test.page.getByTestId('supplier-request-access-withdrawn').count()===1,'Cancelling explicit exit preserves the local message');
    test.state.rows.get(row.id).assignment.operator_id=null;test.page.once('dialog',dialog=>dialog.accept());await test.page.getByTestId('supplier-request-exit-withdrawn').click();await test.page.getByRole('status').filter({hasText:'Se cerró la solicitud'}).waitFor();check(test.state.reviewWrites.length===1&&await test.page.getByTestId('supplier-request-open').count()===0,'Leaving a revoked request performs no second write');await test.context.close();
  }
  const lostRow=requestItem(),lost=await scenario(390,'light',{rows:[lostRow],id:lostRow.id});await ready(lost.page);await inspectQuestion(lost.page,'Mensaje con commit sintético y recibo perdido');lost.state.reviewMode='commit-lost';await lost.page.getByTestId('supplier-request-review-confirm').click();await lost.page.getByTestId('supplier-request-review-retry').waitFor();
  lost.state.rows.get(lostRow.id).assignment.operator_id=null;await lost.page.getByTestId('supplier-request-review-retry').click();await lost.page.getByTestId('supplier-request-access-withdrawn').waitFor();check((await lost.page.getByTestId('supplier-request-access-withdrawn').innerText()).includes('sigue sin confirmar'),'Revoked access after a lost receipt does not claim rollback or successful cancellation');check(lost.state.reviews.get(lostRow.id).length===1&&new Set(lost.state.reviewWrites.map(write=>write.key)).size===1&&new Set(lost.state.reviewWrites.map(write=>JSON.stringify(write.body))).size===1,'Retry after lost receipt retains the same command and creates no second question');await inspect(lost.page,'operator-revoked-uncertain',390,'light');await lost.context.close();
  const uncertainRow=requestItem({assignment:{operator_id:null,revision:0,updated_at:null}}),uncertain=await scenario(390,'light',{access:superadmin,rows:[uncertainRow],id:uncertainRow.id,tenant:uncertainRow.tenant_slug});await assignmentReady(uncertain.page);await inspectAssignment(uncertain.page,operatorId);uncertain.state.assignmentMode='commit-lost';await uncertain.page.getByTestId('supplier-request-assignment-confirm').click();await uncertain.page.getByTestId('supplier-request-assignment-retry').waitFor();
  check(uncertain.state.assignmentEvents.get(uncertainRow.id).length===1&&await uncertain.page.getByTestId('supplier-request-assignment-select').isDisabled(),'Lost assignment receipt preserves one commit and locks selection');uncertain.state.assignmentMode='forbidden';await uncertain.page.getByTestId('supplier-request-assignment-retry').click();await uncertain.page.getByTestId('supplier-request-assignment-panel').getByRole('alert').waitFor();check(await uncertain.page.getByTestId('supplier-request-assignment-select').isDisabled(),'Later403 cannot release an uncertain assignment command');
  const change={id:randomUUID(),revision:2,request_revision:3,action:'assign',operator_id:otherOperatorId,actor_id:superadmin.userId,created_at:'2026-09-23T15:00:00.000Z'};uncertain.state.assignmentEvents.get(uncertainRow.id).push(change);uncertain.state.rows.get(uncertainRow.id).assignment={operator_id:otherOperatorId,revision:2,updated_at:change.created_at};uncertain.state.assignmentMode='success';await uncertain.page.getByTestId('supplier-request-assignment-retry').click();await assignmentSaved(uncertain.page,1);
  check(await uncertain.page.getByTestId('supplier-request-assignment-select').inputValue()===otherOperatorId&&new Set(uncertain.state.assignmentWrites.map(write=>write.key)).size===1&&new Set(uncertain.state.assignmentWrites.map(write=>JSON.stringify(write.body))).size===1,'Original receipt replay shows newer current operator and never reassigns using the old receipt');await inspect(uncertain.page,'superadmin-replayed-current',390,'light');await uncertain.context.close();
  const casRow=requestItem({assignment:{operator_id:null,revision:0,updated_at:null}}),cas=await scenario(390,'light',{access:superadmin,rows:[casRow],id:casRow.id,tenant:casRow.tenant_slug});await assignmentReady(cas.page);await inspectAssignment(cas.page,operatorId);cas.state.assignmentMode='conflict';await cas.page.getByTestId('supplier-request-assignment-confirm').click();await cas.page.getByRole('alert').filter({hasText:'asignación cambió'}).waitFor();check(await cas.page.getByTestId('supplier-request-assignment-select').inputValue()===operatorId&&await cas.page.getByTestId('supplier-request-assignment-inspect').isDisabled(),'Assignment CAS conflict preserves choice and requires a fresh read');await cas.page.getByTestId('supplier-request-assignment-refresh').click();await assignmentReady(cas.page);check(await cas.page.getByTestId('supplier-request-assignment-select').inputValue()===operatorId&&cas.state.assignmentWrites.length===1,'Refreshing a conflict preserves selection without automatically replaying');await cas.context.close();
  for(const permission of [false,true]){const row=requestItem({assignment:{operator_id:null,revision:0,updated_at:null}}),test=await scenario(390,'light',{access:{...superadmin,permissions:[...superadmin.permissions,...(permission?['users:manage']:[])]},rows:[row],id:row.id,tenant:row.tenant_slug,candidatesMode:'empty'});await test.page.getByTestId('supplier-request-operators-empty').waitFor();check(await test.page.getByTestId('supplier-request-operators-empty').getByRole('link').count()===(permission?1:0),'Confirmed empty roster offers user management only to an explicitly authorized SA');check(await test.page.getByTestId('supplier-request-assignment-inspect').isDisabled()&&test.state.assignmentWrites.length===0,'Empty roster never invents a user or creates an assignment');await test.context.close();}
  const historyRow=requestItem(),assignmentHistory=Array.from({length:105},(_,index)=>({id:randomUUID(),revision:index+1,request_revision:3,action:'assign',operator_id:index%2?otherOperatorId:operatorId,actor_id:superadmin.userId,created_at:new Date(Date.UTC(2026,8,23,14,0,index+1)).toISOString()}));historyRow.assignment={operator_id:operatorId,revision:105,updated_at:assignmentHistory.at(-1).created_at};
  const history=await scenario(1440,'dark',{access:superadmin,rows:[historyRow],id:historyRow.id,tenant:historyRow.tenant_slug,assignments:[[historyRow.id,assignmentHistory]]});await assignmentReady(history.page);await history.page.getByText('Historial de responsables',{exact:true}).click();
  check(await history.page.getByTestId('supplier-request-assignment-history').locator('li').count()===100,'Assignment history initially displays latest100 with an explicit older-page control');history.state.assignmentReadMode='503';await history.page.getByTestId('supplier-request-assignment-older').click();await history.page.getByTestId('supplier-request-assignment-panel').getByRole('alert').waitFor();check(await history.page.getByTestId('supplier-request-assignment-history').locator('li').count()===100,'Failed assignment history page preserves confirmed items');
  history.state.assignmentReadMode='success';await history.page.getByTestId('supplier-request-assignment-older').click();await history.page.waitForFunction(()=>document.querySelectorAll('[data-testid="supplier-request-assignment-history"] li').length===105);check(history.state.reads.filter(path=>path.includes('/assignment?')&&path.includes('before_revision=6')).length===2&&await history.page.getByTestId('supplier-request-assignment-older').count()===0,'Retry uses the same exclusive cursor and merges105 entries without duplicates');check(history.state.assignmentWrites.length===0,'Reading older assignments never changes the responsible operator');await history.context.close();
  const contextA=requestItem({title:'Visible sólo operador A'}),contextB=requestItem({title:'Visible sólo operador B',tenant_id:otherTenantId,tenant_slug:'qa-other',assignment:{operator_id:otherOperatorId,revision:1,updated_at:'2026-09-23T12:02:00.000Z'}}),stale=await scenario(390,'light',{rows:[contextA,contextB],id:contextA.id});await ready(stale.page);
  stale.state.readMode='delayed';await stale.page.getByRole('button',{name:'Actualizar mis asignaciones'}).click();await waitFor(()=>stale.state.pending.length===1);stale.state.readMode='success';
  await stale.state.updateContext({access:{...operator,userId:otherOperatorId},initialRequestId:contextB.id});await stale.page.getByTestId('supplier-request-detail-heading').filter({hasText:contextB.title}).waitFor();await ready(stale.page);await stale.state.releaseReads();await tick(stale.page);
  check(!(await stale.page.locator('main').textContent()).includes(contextA.title)&&(await stale.page.locator('main').textContent()).includes(contextB.title),'Late inbox response for operator A cannot populate B, even when session fixture ID is unchanged');
  await stale.state.updateContext({access:operator,initialRequestId:contextA.id});await stale.page.getByTestId('supplier-request-detail-heading').filter({hasText:contextA.title}).waitFor();await ready(stale.page);check(!(await stale.page.locator('main').textContent()).includes(contextB.title),'Returning B→A uses the newly authorized A context, not B cached data');await stale.context.close();
  const writerA=requestItem({title:'Pregunta contexto A'}),writerB=requestItem({title:'Pregunta contexto B',tenant_id:otherTenantId,tenant_slug:'qa-other',assignment:{operator_id:otherOperatorId,revision:1,updated_at:'2026-09-23T12:02:00.000Z'}}),writer=await scenario(390,'light',{rows:[writerA,writerB],id:writerA.id});await ready(writer.page);await inspectQuestion(writer.page,'Comando A pendiente del servidor');writer.state.reviewMode='delayed';await writer.page.getByTestId('supplier-request-review-confirm').click();await waitFor(()=>writer.state.pendingReview.length===1);
  await writer.state.updateContext({access:{...operator,userId:otherOperatorId},initialRequestId:writerB.id});await writer.page.getByTestId('supplier-request-detail-heading').filter({hasText:writerB.title}).waitFor();await ready(writer.page);
  await writer.state.updateContext({access:operator,initialRequestId:writerA.id});await writer.page.getByTestId('supplier-request-detail-heading').filter({hasText:writerA.title}).waitFor();await ready(writer.page);await writer.state.releaseReview();await tick(writer.page);check(await writer.page.getByTestId('supplier-request-review-receipt').count()===0&&!await writer.page.getByTestId('supplier-request-review-message').isDisabled(),'Late writer completion from an old A mount cannot confirm or relock the new A after A→B→A');await writer.context.close();
  const pendingReadA=requestItem({title:'Asignación A',assignment:{operator_id:null,revision:0,updated_at:null}}),pendingReadB=requestItem({title:'Asignación B',assignment:{operator_id:null,revision:0,updated_at:null}}),late=await scenario(390,'light',{access:superadmin,rows:[pendingReadA,pendingReadB],id:pendingReadA.id,tenant:pendingReadA.tenant_slug});await assignmentReady(late.page);
  late.state.assignmentReadMode='delayed';await late.page.getByTestId('supplier-request-assignment-refresh').click();await waitFor(()=>late.state.pendingAssignment.length===1);late.state.assignmentReadMode='success';await late.state.updateContext({initialRequestId:pendingReadB.id});await late.page.getByTestId('supplier-request-detail-heading').filter({hasText:pendingReadB.title}).waitFor();await assignmentReady(late.page);
  const newlyAssigned={id:randomUUID(),revision:1,request_revision:3,action:'assign',operator_id:otherOperatorId,actor_id:superadmin.userId,created_at:'2026-09-23T15:02:00.000Z'};late.state.assignmentEvents.set(pendingReadA.id,[newlyAssigned]);late.state.rows.get(pendingReadA.id).assignment={operator_id:otherOperatorId,revision:1,updated_at:newlyAssigned.created_at};
  await late.state.updateContext({initialRequestId:pendingReadA.id});await late.page.getByTestId('supplier-request-detail-heading').filter({hasText:pendingReadA.title}).waitFor();await assignmentReady(late.page);await late.state.releaseAssignment();await tick(late.page);check(await late.page.getByTestId('supplier-request-assignment-select').inputValue()===otherOperatorId,'Late assignment read from old A cannot replace the newly confirmed current assignment after A→B→A');await late.context.close();
  const filterRows=[requestItem({title:'Pendiente'}),requestItem({title:'Respuesta recibida',review_summary:{state:'answered',revision:2,updated_at:'2026-09-23T12:04:00.000Z'}})],filters=await scenario(1440,'dark',{rows:filterRows});filters.state.truncated=true;await filters.page.getByRole('button',{name:'Actualizar mis asignaciones'}).click();await filters.page.getByTestId('supplier-request-inbox-count').filter({hasText:'Hay más registros'}).waitFor();check((await filters.page.getByTestId('supplier-request-inbox-count').innerText()).includes('2 de 2 solicitudes cargadas'),'Assigned inbox labels the loaded page denominator and its truncation honestly');await filters.page.getByTestId('supplier-request-inbox-filter').selectOption('answered');check(await filters.page.getByTestId('supplier-request-open').count()===1&&(await filters.page.getByTestId('supplier-request-inbox-count').innerText()).includes('1 de 2'),'Assigned local filter preserves the loaded denominator');await filters.page.getByTestId('supplier-request-inbox-filter').selectOption('all');await filters.page.getByTestId('supplier-request-inbox-search').fill(filterRows[0].id);check(await filters.page.getByTestId('supplier-request-open').count()===1&&filters.state.assignmentWrites.length===0&&filters.state.reviewWrites.length===0,'Exact UUID search filters local assigned rows without mutating');await filters.context.close();
  const timedRow=requestItem({assignment:{operator_id:null,revision:0,updated_at:null}}),timed=await scenario(390,'light',{access:superadmin,rows:[timedRow],id:timedRow.id,tenant:timedRow.tenant_slug});await assignmentReady(timed.page);await inspectAssignment(timed.page,operatorId);timed.state.assignmentMode='hang';const started=Date.now();await timed.page.getByTestId('supplier-request-assignment-confirm').click();await timed.page.getByTestId('supplier-request-assignment-retry').waitFor({timeout:35000});check(Date.now()-started>=15000&&Date.now()-started<35000&&timed.state.assignmentWrites.length===1,'Actual assignment client deadline preserves uncertainty without automatic retry');await timed.context.close();
  assert.deepEqual(report.clientErrors, [], 'No browser exceptions');
  assert.deepEqual(report.unexpectedRequests, [], 'No external calls or unplanned actions');
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.error = String(error.stack || error); throw error; }
finally { await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); await new Promise(done => server.close(done)); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, views: report.views.length, output }, null, 2)); }
