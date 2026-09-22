// Loopback-only browser adapter. Product/session/SUN/action responses are
// synthetic; this suite validates the real web/BFF, not production persistence.
import http from 'node:http';
import { randomBytes, createHmac } from 'node:crypto';
if (process.argv[2] !== '--local-qa') throw Error('Explicit local QA required');
const key = randomBytes(32), calls = [], consumed = new Set();
let mode = 'normal', sequence = 900100;
const port = 4288, origin = `http://127.0.0.1:${port}`;
const sign = body => createHmac('sha256', key).update(body).digest('base64url');
function capability(eventId) {
  const now = Math.floor(Date.now() / 1000);
  const p = { purpose: 'sun_fresh_handoff', bid: 'QA-ONLY', eventId, uid: 'EVENT-' + eventId, diagnosticId: Number(eventId), traceId: 'qa-only', iat: now, exp: now + 300 };
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  return body + '.' + sign(body);
}
function valid(token, eventId) {
  try { const [body, signature] = token.split('.'), p = JSON.parse(Buffer.from(body, 'base64url')); return signature === sign(body) && p.eventId === eventId && p.exp > Date.now() / 1000; } catch { return false; }
}
function editorial(trace) {
  if (trace === 'agro-absent') return undefined;
  const base = { protocol: 'nexid.current-editorial.v1', source: 'passport_studio', observedAt: '2026-09-22T00:00:00.000Z' };
  const state = trace.startsWith('agro-') ? trace.slice(5) : trace === 'agro' ? 'published' : 'legacy';
  if (!['published', 'removed'].includes(state)) return { ...base, state };
  return { ...base, state: 'published', version: state === 'removed' ? 3 : 2, publishedAt: '2026-09-21T23:00:00.000Z', contentDigest: 'a'.repeat(64),
    document: { schemaVersion: 'nexid.passport-editorial.v1', template: 'agro', locale: 'es-AR',
      identity: { product_name: 'Producto publicado versión 2', public_lot_label: 'Lote QA', sku: 'QA-PUBLIC', winery: 'Empresa QA', region: 'Origen declarado QA', image_url: null },
      agro_product_profile: { schemaVersion: 'agro-dpp-v1', productName: 'Producto publicado versión 2', technicalSheetUrl: state === 'removed' ? null : 'https://documents.example.invalid/current-v2-technical.pdf', safetySheetUrl: 'https://documents.example.invalid/current-v2-safety.pdf' },
    } };
}
function contract(u) {
  const eventId = /^\/sun\/snapshot\/(\d+)$/.exec(u.pathname)?.[1] || '900001';
  const trace = u.searchParams.get('trace') || '';
  const qr = u.searchParams.get('qr') === '1', agro = trace.startsWith('agro'), token = u.searchParams.get('fresh');
  const fresh = !qr && valid(token || '', eventId);
  return { ok: true, verdict: qr ? 'identified' : 'valid', status: { code: qr ? 'IDENTIFIED' : 'VALID_CLOSED', productState: qr ? 'NOT_REGISTERED' : 'VALID_CLOSED', tone: 'good', tamperSupported: !qr, tamperStatus: qr ? 'UNKNOWN' : 'CLOSED', carrierProfileCode: qr ? 'qr_basic' : 'ntag424_dna_tt' },
    ...(qr ? {} : { currentEditorial: editorial(trace) }),
    identity: { bid: 'QA-ONLY', tenantSlug: 'qa-brand', eventId, tagStatus: 'active' },
    product: { name: agro ? 'Producto agro QA' : 'Vino de ensayo local', winery: 'Empresa QA', category: agro ? 'Agro' : 'Vino', vertical: agro ? 'agro' : 'vino', region: 'Origen declarado QA', ...(agro ? { agro: { productName: 'Producto agro QA', technicalSheetUrl: 'https://documents.example.invalid/technical.pdf', safetySheetUrl: 'https://documents.example.invalid/safety.pdf' } } : {}) },
    tag_tamper: { available: !qr, status: qr ? 'not_available' : 'closed', raw: qr ? null : '4343' }, technical: { tt: { raw: '4343', source: 'enc_decrypted', length: 2 } },
    snapshot: { mode: fresh ? 'fresh_handoff' : 'historical', requiresFreshTap: !fresh },
    tapSecurity: { actionability: fresh ? 'fresh_handoff' : 'read_only', freshTap: fresh, snapshot: !fresh },
    certificate: u.searchParams.get('trace') === 'no-certificate' ? {} : { shareToken: 'qa-only-public-share' },
    allowedActions: fresh ? ['claim', 'save', 'join', 'rewards', 'provenance'] : ['provenance'], blockedActions: fresh ? [] : ['claim', 'warranty', 'tokenization', 'rewards'],
    cta: { claimOwnership: fresh, registerWarranty: false, tokenize: false, provenance: true }, provenance: { origin: 'Declarado por empresa QA', timelineSummary: agro ? [{ at: "2026-09-21T22:42:23.856Z", result: "Evento QA histórico" }] : [] }, tapContext: { utcTime: '2026-09-21T22:42:23.856Z' } };
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, origin);
  const reply = (status, value) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
  let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 16384) return reply(413, { ok: false }); }
  let body = {}; try { if (text) body = JSON.parse(text); } catch { return reply(400, { ok: false }); }
  if (u.pathname === '/qa-state') return reply(200, { localOnly: true, syntheticApi: true, calls, mode });
  if (u.pathname === '/qa-mode') { mode = u.searchParams.get('value') || 'normal'; return reply(200, { ok: true }); }
  if (u.pathname === '/qa-issue') { const eventId = String(++sequence); return reply(200, { eventId, token: capability(eventId) }); }
  calls.push({ method: req.method, path: u.pathname, hasCapability: Boolean(body.fresh_token), leakedCookie: String(req.headers.cookie || '').includes('nexid_tap_'), keys: Object.keys(body) });
  if (u.pathname === '/sun') return reply(200, contract(u));
  if (u.pathname.startsWith('/sun/snapshot/')) return reply(200, { contract: contract(u) });
  if (u.pathname === '/public/product-notices/v2') return reply(200, { ok: true, protocol: 'nexid.product-notices.v2', scope: { tenant: 'qa-brand', bid: 'QA-ONLY' }, observedAt: new Date().toISOString(), notices: [], total: 0, hasMore: false, doesNotDetermineNfcAuthenticity: true, closureDoesNotReleaseProduct: true, liftingNoticeDoesNotReleaseProduct: true });
  if (u.pathname.startsWith('/public/certificates/')) return reply(403, { ok: false, error: 'share_token_expired' });
  if (u.pathname === '/public/cta/experience-event') return reply(200, { ok: true, qaOnly: true });
  const authenticated = String(req.headers.cookie || '').includes('consumer_qa=local');
  if (u.pathname === '/consumer/session') return reply(200, { ok: true, authenticated });
  if (u.pathname.startsWith('/consumer/')) {
    if (!authenticated) return reply(401, { ok: false, error: 'unauthorized' });
    if (u.pathname === '/consumer/me') return reply(200, { ok: true, consumer: { display_name: 'Cuenta sintética QA', status: 'verified' }, stats: { products: 0, taps: 0 } });
    return reply(200, { ok: true, items: [] });
  }
  const action = /^\/mobile\/passport\/(\d+)\/(consumer\/(?:save-product|join-tenant|claim)|loyalty\/enroll)$/.exec(u.pathname);
  if (action) {
    if (!authenticated || mode === 'expired-session') return reply(401, { ok: false, error: 'unauthorized' });
    if (!valid(body.fresh_token || '', action[1])) return reply(403, { ok: false, error: 'fresh_tap_capability_required', fresh_token_status: 'fresh_token_missing' });
    if (mode === 'network-error') return reply(503, { ok: false, error: 'upstream_unavailable' });
    if (mode === 'invalid-response') return reply(200, { ok: true });
    if (mode === 'manual-review') return reply(403, { ok: false, error: 'manual_review_required', review_required: true });
    if (mode === 'committed') return reply(503, { ok: false, eventId: action[1], operation_committed: true, ownership: { status: 'claimed', record_scope: 'nexid_off_chain_digital_title' } });
    const id = action[0] + ':' + body.fresh_token;
    if (consumed.has(id)) return reply(403, { ok: false, error: 'fresh_tap_capability_required', fresh_token_status: 'fresh_token_already_used' });
    consumed.add(id);
    if (action[2] === 'consumer/save-product') return reply(200, { ok: true, saved: true, eventId: action[1] });
    if (action[2] === 'consumer/join-tenant') return reply(200, { ok: true, membership: { id: 'qa-only-member', status: 'active', tenant_id: 'qa-brand' } });
    if (action[2] === 'consumer/claim') return reply(200, { ok: true, eventId: action[1], ownership: { status: 'claimed', record_scope: 'nexid_off_chain_digital_title' } });
    return reply(200, { ok: true, enrollment_status: 'enrolled', member: { id: 'qa-only-member', status: 'enrolled' } });
  }
  return reply(404, { ok: false, error: 'qa_route_not_found' });
});
server.listen(port, '127.0.0.1', () => console.log('CONSUMER_ACTIONS_QA_READY'));
process.on('SIGTERM', () => server.close());
