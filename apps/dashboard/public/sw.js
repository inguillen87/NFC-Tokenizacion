const CACHE_NAME = "nexid-dash-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/logo-mark.svg",
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
      fetchWithTimeout(request, 20000).catch(() =>
        new Response(
          `<!doctype html>
          <html lang="es">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>nexID Control offline</title>
              <style>
                body{margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
                main{max-width:34rem;padding:2rem;border:1px solid rgba(103,232,249,.22);border-radius:1.5rem;background:rgba(15,23,42,.82)}
                p{line-height:1.6;color:#94a3b8}
                a{color:#67e8f9;font-weight:800}
              </style>
            </head>
            <body>
              <main>
                <h1>Control Center offline</h1>
                <p>El centro de operaciones de nexID requiere conexion de red activa para sincronizar los lotes y la telemetria en vivo.</p>
                <a href="/">Reintentar conexion</a>
              </main>
            </body>
          </html>`,
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
        ),
      ),
    );
    return;
  }

  if (request.destination === "script" || request.destination === "style") {
    event.respondWith(
      fetchWithTimeout(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      }).catch(() => caches.match(request)),
    );
    return;
  }

  if (request.destination === "image" || request.destination === "font") {
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
