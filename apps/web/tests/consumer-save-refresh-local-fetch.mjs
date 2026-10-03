// Explicit loopback QA. Account projections are synthetic and read-only.
// Save POSTs are intercepted by the browser test; this fixture never writes to
// an API, database, NFC tag or customer account.
if (process.env.CONSUMER_SAVE_REFRESH_QA !== '1') throw Error('consumer_save_fixture_requires_explicit_local_qa');

const originalFetch = globalThis.fetch;
const date = '2026-10-03T06:00:00Z';
const savedProduct = {
  product_name: 'Producto nuevo de ensayo QA',
  brand_name: 'Marca de ensayo QA',
  tenant_slug: 'save-feedback-qa',
  bid: 'SAVE-FEEDBACK-QA',
  latest_tap_event_id: '900101',
  latest_verdict: 'VALID_CLOSED',
  latest_tap_at: date,
  created_at: date,
  ownership_status: 'viewed',
};
const reply = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'api.nexid.lat') {
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    if (!['GET', 'HEAD'].includes(method)) throw Error('consumer_save_fixture_backend_write_blocked');
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const cookie = headers.get('cookie') || '';
    const authenticated = /(?:^|;\s*)consumer_qa=local(?:;|$)/.test(cookie);
    const saved = /(?:^|;\s*)consumer_saved_qa=1(?:;|$)/.test(cookie);
    if (url.pathname === '/consumer/session') return reply({ ok: true, authenticated });
    if (!authenticated) return reply({ ok: false }, 401);
    if (url.pathname === '/consumer/me') return reply({
      ok: true,
      consumer: { id: '50000000-0000-4000-8000-000000000003', display_name: 'Cuenta sintética QA', status: 'verified' },
      stats: { products: saved ? 1 : 0, taps: saved ? 1 : 0 },
    });
    if (url.pathname === '/consumer/products') return reply({ ok: true, items: saved ? [savedProduct] : [] });
    if (url.pathname === '/consumer/taps') return reply({ ok: true, items: saved ? [{
      tap_event_id: '900101', tenant_slug: 'save-feedback-qa', product_name: savedProduct.product_name,
      bid: savedProduct.bid, verdict: 'VALID_CLOSED', created_at: date,
    }] : [] });
    if (url.pathname === '/consumer/brands') return reply({ ok: true, items: [] });
    if (url.pathname === '/consumer/experiences') return reply({ ok: true, verifiedExperiences: [] });
    return reply({ ok: false }, 404);
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('consumer_save_fixture_external_fetch_blocked');
  return originalFetch(input, init);
};
