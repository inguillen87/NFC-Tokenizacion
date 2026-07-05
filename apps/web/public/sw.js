const CACHE_NAME = "nexid-v4";
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
      fetchWithTimeout(request, 20000).catch(() =>
        new Response(
          `<!doctype html>
          <html lang="es">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <title>nexID offline</title>
              <style>
                *{box-sizing:border-box}
                body{margin:0;min-height:100vh;display:grid;place-items:center;overflow-x:hidden;padding:1rem;background:#070b14;color:#e5f9ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
                main{width:min(34rem,100%);padding:clamp(1.25rem,6vw,2rem);border:1px solid rgba(103,232,249,.22);border-radius:1.5rem;background:rgba(15,23,42,.82)}
                h1{margin:0;font-size:clamp(1.75rem,9vw,2.5rem);line-height:1.05}
                p{line-height:1.6;color:#b8c7d9}
                a{color:#67e8f9;font-weight:800}
              </style>
            </head>
            <body>
              <main>
                <h1>nexID necesita conexión</h1>
                <p>Esta pantalla contiene datos vivos del producto. Volvé a intentar cuando el certificado, el tap o el portal puedan sincronizar con la API.</p>
                <a href="/">Volver al inicio</a>
              </main>
            </body>
          </html>`,
          { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
        ),
      ),
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
