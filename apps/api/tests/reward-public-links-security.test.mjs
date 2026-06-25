import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function extractFunction(source, name) {
  const start = source.indexOf(`export function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  return source.slice(start);
}

test('public reward links use opaque tokens and never querystring tenant/code data', async () => {
  const links = await readFile(new URL('../src/lib/reward-public-links.ts', import.meta.url), 'utf8');

  assert.match(links, /createPublicRewardToken\(\)/);
  assert.match(links, /`nxr_\$\{randomBytes\(18\)\.toString\("base64url"\)\}`/);
  assert.ok(links.includes('.replace(/[^A-Za-z0-9_-]/g, "")'));
  assert.match(links, /slice\(0,\s*96\)/);
  assert.match(links, /return `\$\{publicWebBase\(\)\}\/r\/\$\{encodeURIComponent\(token\)\}`/);
  assert.match(links, /return `\$\{publicWebBase\(\)\}\/s\/\$\{encodeURIComponent\(token\)\}`/);
  assert.doesNotMatch(links, /publicRewardUrl[\s\S]*voucher=/);
  assert.doesNotMatch(links, /publicRewardUrl[\s\S]*tenant=/);
});

test('public reward payload is sanitized for consumers and staff', async () => {
  const links = await readFile(new URL('../src/lib/reward-public-links.ts', import.meta.url), 'utf8');
  const formatter = extractFunction(links, 'formatPublicRewardClaim');
  const returnedPayload = formatter.slice(formatter.indexOf('  return {'));

  assert.match(formatter, /phoneLast4/);
  assert.match(formatter, /phoneMasked/);
  assert.match(formatter, /emailMasked/);
  assert.match(formatter, /tenant:\s*\{\s*name:/);
  assert.match(formatter, /staffInstruction/);
  assert.doesNotMatch(returnedPayload, /tenant_slug/);
  assert.doesNotMatch(returnedPayload, /consumer_id/);
  assert.doesNotMatch(returnedPayload, /tenant_id/);
  assert.doesNotMatch(returnedPayload, /reward_id/);
  assert.doesNotMatch(returnedPayload, /tap_event_id/);
  assert.doesNotMatch(returnedPayload, /metadata_json/);
  assert.doesNotMatch(returnedPayload, /public_token/);
});

test('public reward API and QR pass stay noindex and token-only', async () => {
  const publicRoute = await readFile(new URL('../src/app/public/rewards/v/[token]/route.ts', import.meta.url), 'utf8');
  const passRoute = await readFile(new URL('../src/app/p/[token]/route.tsx', import.meta.url), 'utf8');
  const webPage = await readFile(new URL('../../web/src/app/r/[token]/page.tsx', import.meta.url), 'utf8');

  assert.match(publicRoute, /cleanPublicRewardToken\(token\)/);
  assert.match(publicRoute, /getPublicRewardClaimByToken\(publicToken\)/);
  assert.match(publicRoute, /passImageUrl:\s*publicRewardPassUrl\(req,\s*publicToken\)/);
  assert.match(publicRoute, /"cache-control":\s*"no-store"/);
  assert.match(publicRoute, /"x-robots-tag":\s*"noindex,\s*nofollow"/);

  assert.match(passRoute, /validationUrl:\s*publicRewardStaffUrl\(publicToken\)/);
  assert.match(passRoute, /cache-control",\s*"no-store,\s*max-age=0"/);
  assert.match(passRoute, /response\.headers\.set\("x-robots-tag",\s*"noindex,\s*nofollow"\)/);
  assert.doesNotMatch(passRoute, /validationUrl:[\s\S]*redemption_code/);
  assert.doesNotMatch(passRoute, /validationUrl:[\s\S]*tenant_slug/);
  assert.doesNotMatch(passRoute, /voucher=/);
  assert.doesNotMatch(passRoute, /tenant=/);

  assert.match(webPage, /\/public\/rewards\/v\/\$\{encodeURIComponent\(safeToken\)\}/);
  assert.match(webPage, /no expone IDs internos/);
  assert.doesNotMatch(webPage, /voucher=/);
  assert.doesNotMatch(webPage, /tenant=/);
});

test('public web base rejects localhost reward URLs in production messages', async () => {
  const links = await readFile(new URL('../src/lib/reward-public-links.ts', import.meta.url), 'utf8');

  assert.match(links, /CONSUMER_PORTAL_URL/);
  assert.match(links, /NEXID_PUBLIC_WEB_URL/);
  assert.match(links, /url\.protocol !== "https:"/);
  assert.match(links, /\^\(localhost\|127\\\.0\\\.0\\\.1\|0\\\.0\\\.0\\\.0\|\\\[::1\\\]\)\$/);
  assert.match(links, /return "https:\/\/nexid\.lat"/);
});
