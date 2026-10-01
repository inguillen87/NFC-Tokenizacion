/** Same-origin worker, coupled to the installed MapLibre version by the build check. */
export const SUN_MAP_WORKER_PATH = '/maplibre/6.4.1/maplibre-gl-worker.mjs';

export function configureSunMapWorker(maplibre: { setWorkerUrl: (url: string) => void }, origin: string) {
  // No query, NFC payload, user location, cookies or external CDN are added to this URL.
  const worker = new URL(SUN_MAP_WORKER_PATH, origin);
  if (worker.origin !== new URL(origin).origin) throw new Error('map_worker_origin_mismatch');
  maplibre.setWorkerUrl(worker.href);
}
