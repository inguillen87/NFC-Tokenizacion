/** Keep the split ESM worker beside its original shared module, not hashed media copies. */
export const MAPLIBRE_WORKER_URL = '/vendor/maplibre-gl/6.4.1/maplibre-gl-worker.mjs';
export function configureMapLibreWorker(maplibre: { setWorkerUrl: (url: string) => void }): void {
  maplibre.setWorkerUrl(MAPLIBRE_WORKER_URL);
}
