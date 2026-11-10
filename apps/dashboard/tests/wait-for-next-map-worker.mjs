import { setTimeout as delay } from 'node:timers/promises';
import { MAPLIBRE_ASSET_VERSION } from '../../../scripts/prepare-maplibre-assets.mjs';

const origin = process.env.NEXT_QA_ORIGIN ?? '';
if (!/^http:\/\/127\.0\.0\.1:[1-9]\d{0,4}$/.test(origin)) {
  throw Error('Dashboard map readiness requires a loopback QA origin');
}

const worker = new URL(`/vendor/maplibre-gl/${MAPLIBRE_ASSET_VERSION}/maplibre-gl-worker.mjs`, origin);
const deadline = performance.now() + 15_000;
const observations = {};
let attempts = 0;
let ready = false;

while (performance.now() < deadline && attempts < 30) {
  attempts++;
  const remaining = Math.max(1, Math.ceil(deadline - performance.now()));
  let outcome;
  try {
    const response = await fetch(worker, {
      redirect: 'manual',
      signal: AbortSignal.timeout(Math.min(remaining, 1_000)),
    });
    outcome = `http_${response.status}`;
    await response.body?.cancel();
    ready = response.ok;
  } catch (error) {
    const code = error?.cause?.code;
    if (error?.name === 'TimeoutError') outcome = 'timeout';
    else if (['ECONNREFUSED', 'ECONNRESET', 'UND_ERR_SOCKET'].includes(code)) outcome = code;
    else outcome = 'transport_error';
  }
  observations[outcome] = (observations[outcome] ?? 0) + 1;
  if (ready) break;
  await delay(Math.max(0, Math.min(500, deadline - performance.now())));
}

const report = { phase: 'next-map-worker-readiness', ready, attempts, observations };
if (ready) console.log(JSON.stringify(report));
else {
  console.error(JSON.stringify(report));
  process.exitCode = 1;
}
