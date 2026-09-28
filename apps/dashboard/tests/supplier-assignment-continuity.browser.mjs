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
const output = resolve(process.env.QA_OUTPUT || 'artifacts/supplier-assignment-continuity-browser');
await mkdir(output, { recursive: true });
const operatorId = '20000000-0000-4000-8000-000000000001', otherOperatorId = '20000000-0000-4000-8000-000000000002';
const tenantId = '10000000-0000-4000-8000-000000000001', otherTenantId = '10000000-0000-4000-8000-000000000002';
const operator = { id: '30000000-0000-4000-8000-000000000001', userId: operatorId, role: 'supplier-operator', tenantSlug: null, tenantId: null, permissions: ['supplier_request.assigned.read', 'supplier_request.assigned.review'], deniedPermissions: [], isDemo: false };
const superadmin = { ...operator, userId: '20000000-0000-4000-8000-000000000003', role: 'super-admin', permissions: ['supplier_order.create', 'supplier_request.assign'] };
const fixture = `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import{SupplierRequestWorkspace}from'./src/components/supplier-request-workspace';
function Fixture(){const[props,setProps]=useState(window.__qaInitial);window.__qaContext=next=>setProps(current=>({...current,...next}));return <div className="dashboard-main mx-auto w-full max-w-7xl min-w-0 p-4 md:p-8"><aside aria-label="Alcance de la prueba" className="mb-4 text-sm">QA local sintética: componentes reales, transporte simulado. No crea cuentas, pedidos ni asignaciones en producción.</aside><SupplierRequestWorkspace {...props}/></div>}createRoot(document.getElementById('root')).render(window.__qaInitial.strictMode?<React.StrictMode><Fixture/></React.StrictMode>:<Fixture/>);`;
const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: dashboard }, bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"', 'process.env': '{}' }, logLevel: 'silent', plugins: [{ name: 'synthetic-navigation', setup(builder) {
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
const check = (value, description) => { report.checks.push({ description, passed: Boolean(value) }); };
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
  const props = { strictMode:Boolean(options.strictMode), access: { ...operator, ...options.access }, ...(options.id ? { initialRequestId: options.id } : {}), ...(options.tenant ? { initialTenant: options.tenant } : {}) };
  await page.addInitScript(value => { window.__qaInitial = value; const original=window.fetch.bind(window); window.fetch=(url,init={})=>original(url,window.__qaIgnoreAbort?{...init,signal:undefined}:init); }, props);
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
          if (['401','403','404','503'].includes(state.assignmentReadMode)) return send(route,Number(state.assignmentReadMode),{ok:false,reason:'synthetic_assignment_read'});
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
async function assignmentSettled(page) { await page.waitForFunction(()=>{const n=document.querySelector('[data-testid="supplier-request-assignment-panel"]');return !n||!n.textContent.includes('Consultando responsable');}); await tick(page); }
try {
 for(const status of ['401','403','404']) {
  const row=requestItem(),other=requestItem({title:'Otra solicitud autorizada'});
  const t=await scenario(390,'light',{access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row,other]});await assignmentReady(t.page);await ready(t.page);
  await t.page.getByTestId('supplier-request-assignment-select').selectOption(otherOperatorId);t.state.assignmentReadMode=status;
  await t.page.getByTestId('supplier-request-assignment-refresh').click();await assignmentSettled(t.page);
  const rendered=await t.page.locator('main').textContent();
  check(!rendered.includes(row.title)&&!rendered.includes(row.notes)&&!rendered.includes(row.id),'Assignment GET '+status+' withdraws dossier fields');
  check(await t.page.getByTestId('supplier-request-read-denied').count()===1,'Assignment GET '+status+' reports withdrawal at the workspace');
  check(await t.page.getByTestId('supplier-request-open').count()===(status==='404'?1:0),'Assignment GET '+status+' respects record versus session scope');
  check(t.state.assignmentWrites.length===0&&t.state.reviewWrites.length===0,'Assignment GET '+status+' never writes');
  await t.context.close();
 }
 for(const action of ['quote-open','supplier-cancel-start']) {
  const row=requestItem();const t=await scenario(390,'dark',{access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row]});await assignmentReady(t.page);await ready(t.page);
  t.state.assignmentReadMode='delayed';await t.page.getByTestId('supplier-request-assignment-refresh').click();await waitFor(()=>t.state.pendingAssignment.length===1);
  check(await t.page.getByTestId(action).isDisabled(),'Assignment read prevents the competing '+action);
  const before=t.state.reads.length;await t.page.getByTestId(action).evaluate(b=>{b.disabled=false;b.click();});await tick(t.page);
  check(t.state.reads.length===before&&t.state.assignmentWrites.length===0&&t.state.reviewWrites.length===0,'Forced '+action+' cannot start during assignment read');
  await t.context.close();
 }
 {
  const row=requestItem();const t=await scenario(390,'dark',{strictMode:true,access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row]});
  const settled=await t.page.waitForFunction(()=>document.querySelector('[data-testid="supplier-request-assignment-select"]')&&!document.querySelector('[data-testid="supplier-request-assignment-refresh"]')?.disabled&&document.querySelector('[data-testid="supplier-request-review-state"]')&&!document.querySelector('[data-testid="supplier-request-review-state"]').textContent.includes('Consultando'),null,{timeout:3000}).then(()=>true,()=>false);
  check(settled,'Both assignment and review bootstrap after StrictMode effect replay without deadlock');check(t.state.assignmentWrites.length===0&&t.state.reviewWrites.length===0,'StrictMode never sends an operation');await t.context.close();
 }
 for(const theme of ['light','dark'])for(const width of [320,390,768,1440]) {
  const row=requestItem();const t=await scenario(width,theme,{access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row]});await assignmentReady(t.page);await ready(t.page);
  await t.page.getByTestId('supplier-request-assignment-select').selectOption(otherOperatorId);await t.page.evaluate(()=>window.__qaIgnoreAbort=true);
  t.state.assignmentReadMode='delayed';await t.page.getByTestId('supplier-request-assignment-refresh').click();await waitFor(()=>t.state.pendingAssignment.length===1);
  await t.page.getByTestId('supplier-request-assignment-cancel-read').click();await tick(t.page);
  check(await t.page.getByTestId('supplier-request-assignment-select').inputValue()===otherOperatorId,'Cancel preserves selected operator '+width+' '+theme);
  check(await t.page.getByTestId('supplier-request-assignment-refresh').evaluate(n=>document.activeElement===n),'Cancel restores keyboard focus '+width+' '+theme);
  check(await t.page.getByTestId('supplier-request-assignment-inspect').isDisabled(),'Cancelled lookup cannot authorize a reassignment '+width+' '+theme);
  await inspect(t.page,'assignment-cancelled',width,theme);
  t.state.assignmentReadMode='success';await t.page.getByTestId('supplier-request-assignment-refresh').click();await assignmentReady(t.page);
  for(const pending of t.state.pendingAssignment.splice(0))await pending.route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({ok:false,reason:'late_denial'})}).catch(()=>{});await tick(t.page);
  check(!await t.page.getByTestId('supplier-request-read-denied').count() && await t.page.getByTestId('supplier-request-assignment-select').inputValue()===otherOperatorId,'Late cancelled denial cannot replace confirmed selection '+width+' '+theme);
  check(await t.page.getByTestId('supplier-request-assignment-inspect').isEnabled(),'Explicit reread restores review only '+width+' '+theme);
  check(t.state.assignmentWrites.length===0&&t.state.reviewWrites.length===0,'Cancel and reread never mutate '+width+' '+theme);await t.context.close();
 }
 {
  const row=requestItem();const t=await scenario(390,'dark',{access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row]});await assignmentReady(t.page);await ready(t.page);
  await inspectAssignment(t.page,otherOperatorId);t.state.assignmentMode='commit-lost';await t.page.getByTestId('supplier-request-assignment-confirm').click();await t.page.getByTestId('supplier-request-assignment-retry').waitFor();const before=t.state.reads.length;
  await t.page.getByTestId('supplier-request-assignment-refresh').evaluate(b=>{b.disabled=false;b.click();});await tick(t.page);
  check(t.state.reads.length===before&&!await t.page.getByTestId('supplier-request-assignment-cancel-read').count(),'Lost write acknowledgement cannot be discarded through the new read control');
  t.state.assignmentMode='success';await t.page.getByTestId('supplier-request-assignment-retry').click();await assignmentSaved(t.page,2);
  check(t.state.assignmentEvents.get(row.id).length===2&&new Set(t.state.assignmentWrites.map(x=>x.key)).size===1,'Same assignment operation recovers its original acknowledgement once');await t.context.close();
 }
 {
  const row=requestItem();const t=await scenario(390,'light',{access:superadmin,id:row.id,tenant:row.tenant_slug,rows:[row]});await assignmentReady(t.page);await ready(t.page);
  await t.page.getByTestId('supplier-request-assignment-select').selectOption(otherOperatorId);t.state.assignmentReadMode='503';await t.page.getByTestId('supplier-request-assignment-refresh').click();await assignmentSettled(t.page);
  check(!await t.page.getByTestId('supplier-request-read-denied').count()&&await t.page.getByTestId('supplier-request-assignment-select').inputValue()===otherOperatorId,'Transient service failure preserves the local choice without inventing revocation');check(await t.page.getByTestId('supplier-request-assignment-inspect').isDisabled(),'An unconfirmed assignment cannot be saved');await t.context.close();
 }

 check(report.clientErrors.length===0,'No client errors');check(report.unexpectedRequests.length===0,'No unexpected external requests');
} finally {await browser.close();await new Promise(done=>server.close(done));await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failed:report.checks.filter(c=>!c.passed),views:report.views.length,output},null,2));
assert.equal(report.checks.filter(c=>!c.passed).length,0);
