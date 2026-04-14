const CACHE_NAME = "nexid-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/nexid-mark-256.png",
  "/nexid-mark-512.png",
  "/nexid-mark-pulse.svg",
];

function fetchWithTimeout(request, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith(
      fetchWithTimeout(request).catch(() => caches.match("/")),
    );
    return;
  }

  if (request.destination === "script") {
    event.respondWith(fetchWithTimeout(request));
    return;
  }

  if (request.destination === "image" || request.destination === "style" || request.destination === "font") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetchWithTimeout(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});
