const CACHE_NAME = "nexid-v5";
const APP_SHELL = [
  "/",
  "/offline",
  "/offline/certificate",
  "/manifest.webmanifest",
  "/nexid-mark-256.png",
  "/nexid-mark-512.png",
  "/nexid-mark-pulse.svg",
];

const OFFLINE_DB_NAME = "nexid-offline-level1";
const OFFLINE_DB_VERSION = 1;
const OFFLINE_QUEUE_STORE = "pending-sun-scans";
const OFFLINE_PRODUCT_STORE = "public-products";
const MAX_OFFLINE_SCANS = 25;
const MAX_OFFLINE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TERMINAL_STATUSES = new Set(["SYNCED_VALID", "SYNCED_INVALID", "REPLAY_SUSPECT"]);

function fetchWithTimeout(request, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("offline_storage_request_failed")), { once: true });
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error || new Error("offline_storage_aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error || new Error("offline_storage_failed")), { once: true });
  });
}

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
        db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OFFLINE_PRODUCT_STORE)) {
        db.createObjectStore(OFFLINE_PRODUCT_STORE, { keyPath: "bid" });
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error || new Error("offline_storage_open_failed")), { once: true });
  });
}

function readSingleParam(url, key, required = true) {
  const values = url.searchParams.getAll(key);
  if ((required && values.length !== 1) || (!required && values.length > 1)) return null;
  return values.length === 1 ? values[0].trim() : "";
}

function isSunPath(pathname) {
  return pathname === "/sun" || pathname === "/sun/";
}

function normalizeSunNavigation(url) {
  if (url.origin !== self.location.origin || !isSunPath(url.pathname)) return null;
  const version = readSingleParam(url, "v", false);
  const bid = readSingleParam(url, "bid");
  const piccData = readSingleParam(url, "picc_data");
  const enc = readSingleParam(url, "enc");
  const cmac = readSingleParam(url, "cmac");
  if (version === null || bid === null || piccData === null || enc === null || cmac === null) return null;
  if (version && version !== "1") return null;
  if (!/^[A-Za-z0-9._:-]{3,120}$/.test(bid)) return null;

  const normalizedPiccData = piccData.toUpperCase();
  const normalizedEnc = enc.toUpperCase();
  const normalizedCmac = cmac.toUpperCase();
  if (!/^[0-9A-F]+$/.test(normalizedPiccData) || normalizedPiccData.length < 2 || normalizedPiccData.length > 256 || normalizedPiccData.length % 2 !== 0) return null;
  if (!/^[0-9A-F]{32}$/.test(normalizedEnc)) return null;
  if (!/^[0-9A-F]{16}$/.test(normalizedCmac)) return null;

  return {
    ...(version === "1" ? { v: "1" } : {}),
    bid,
    picc_data: normalizedPiccData,
    enc: normalizedEnc,
    cmac: normalizedCmac,
  };
}

function canonicalSunPath(params) {
  const query = new URLSearchParams();
  if (params.v) query.set("v", params.v);
  query.set("bid", params.bid);
  query.set("picc_data", params.picc_data);
  query.set("enc", params.enc);
  query.set("cmac", params.cmac);
  return `/sun?${query.toString()}`;
}

async function scanIdFor(params) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalSunPath(params)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pruneOfflineQueue(db, keepId) {
  const readTransaction = db.transaction(OFFLINE_QUEUE_STORE, "readonly");
  const records = await requestResult(readTransaction.objectStore(OFFLINE_QUEUE_STORE).getAll());
  await transactionComplete(readTransaction);
  const expiresBefore = Date.now() - MAX_OFFLINE_AGE_MS;
  const expiredIds = records
    .filter((record) => {
      const lastSeenAt = Date.parse(record.lastSeenAt || record.capturedAt || "");
      return record.id !== keepId && (!Number.isFinite(lastSeenAt) || lastSeenAt < expiresBefore);
    })
    .map((record) => record.id);
  const survivors = records
    .filter((record) => record.id === keepId || !expiredIds.includes(record.id))
    .sort((left, right) => String(right.lastSeenAt || right.capturedAt).localeCompare(String(left.lastSeenAt || left.capturedAt)));
  const overflowIds = survivors.slice(MAX_OFFLINE_SCANS).filter((record) => record.id !== keepId).map((record) => record.id);
  const idsToDelete = [...new Set([...expiredIds, ...overflowIds])];
  if (!idsToDelete.length) return;
  const writeTransaction = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
  const store = writeTransaction.objectStore(OFFLINE_QUEUE_STORE);
  idsToDelete.forEach((id) => store.delete(id));
  await transactionComplete(writeTransaction);
}

async function notifyOfflineClients() {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  windows.forEach((client) => client.postMessage({ type: "NEXID_OFFLINE_QUEUE_UPDATED" }));
}

async function enqueueFailedSunNavigation(url) {
  const params = normalizeSunNavigation(url);
  if (!params) return null;
  const id = await scanIdFor(params);
  const capturedPath = canonicalSunPath(params);
  const now = new Date().toISOString();
  const db = await openOfflineDb();
  try {
    const transaction = db.transaction(OFFLINE_QUEUE_STORE, "readwrite");
    const store = transaction.objectStore(OFFLINE_QUEUE_STORE);
    const existing = await requestResult(store.get(id));
    const status = existing && TERMINAL_STATUSES.has(existing.status)
      ? existing.status
      : "PENDING_BACKEND_VERIFICATION";
    const record = existing
      ? {
          ...existing,
          params,
          capturedPath,
          lastSeenAt: now,
          updatedAt: now,
          duplicateCount: Math.max(0, Number(existing.duplicateCount) || 0) + 1,
          status,
          ...(status === "PENDING_BACKEND_VERIFICATION" ? { lastError: undefined } : {}),
        }
      : {
          id,
          schemaVersion: 1,
          params,
          capturedPath,
          capturedAt: now,
          lastSeenAt: now,
          updatedAt: now,
          duplicateCount: 0,
          attempts: 0,
          status: "PENDING_BACKEND_VERIFICATION",
        };
    store.put(record);
    await transactionComplete(transaction);
    await pruneOfflineQueue(db, id);
    await notifyOfflineClients();
    return record;
  } finally {
    db.close();
  }
}

async function cacheIfUsable(request, response) {
  if (!response || !response.ok || response.type === "opaque") return response;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
}

async function warmOfflinePage(cache, pathname) {
  const response = await fetch(new Request(pathname, { cache: "reload", credentials: "omit" }));
  if (!response.ok) return;
  await cache.put(pathname, response.clone());
  const html = await response.text();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((value) => value.startsWith("/_next/static/") || value.startsWith("/nexid-"));
  await Promise.all([...new Set(assets)].map(async (asset) => {
    try {
      const assetResponse = await fetch(new Request(asset, { cache: "reload", credentials: "omit" }));
      if (assetResponse.ok) await cache.put(asset, assetResponse);
    } catch {
      // The static shell remains usable even when one optional asset misses.
    }
  }));
}

function emergencyOfflineResponse() {
  return new Response(
    `<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Verificación pendiente · nexID</title>
        <style>
          *{box-sizing:border-box}
          body{margin:0;min-height:100vh;display:grid;place-items:center;overflow-x:hidden;padding:1rem;background:#050914;color:#e5f9ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
          main{width:min(34rem,100%);padding:clamp(1.25rem,6vw,2rem);border:1px solid rgba(103,232,249,.22);border-radius:1.5rem;background:rgba(15,23,42,.9)}
          h1{margin:0;font-size:clamp(1.75rem,9vw,2.5rem);line-height:1.05}
          p{line-height:1.6;color:#b8c7d9}
          a{display:inline-flex;min-height:44px;align-items:center;color:#67e8f9;font-weight:800}
        </style>
      </head>
      <body>
        <main>
          <h1>Verificación pendiente</h1>
          <p>Necesitamos conexión para confirmar autenticidad criptográfica.</p>
          <p>La lectura se guardó en este dispositivo. Abrí esta pantalla cuando vuelva la conexión para sincronizarla.</p>
          <a href="/offline">Abrir cola local</a>
        </main>
      </body>
    </html>`,
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (asset) => {
      try {
        const response = await fetch(new Request(asset, { cache: "reload", credentials: "omit" }));
        if (response.ok) await cache.put(asset, response);
      } catch {
        // Install remains recoverable; the emergency HTML is always available.
      }
    }));
    await Promise.all([
      warmOfflinePage(cache, "/offline").catch(() => undefined),
      warmOfflinePage(cache, "/offline/certificate").catch(() => undefined),
    ]);
  })());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const { request } = event;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const url = new URL(request.url);
      try {
        const response = await fetchWithTimeout(request, 20_000);
        if (isSunPath(url.pathname) && response.status >= 500) throw new Error("sun_navigation_failed");
        return response;
      } catch {
        if (isSunPath(url.pathname)) {
          const record = await enqueueFailedSunNavigation(url).catch(() => null);
          const offlineUrl = new URL("/offline", self.location.origin);
          offlineUrl.searchParams.set("capture", record ? record.id : "invalid");
          return Response.redirect(offlineUrl.href, 302);
        }
        if (url.pathname === "/offline/certificate" || url.pathname === "/offline/certificate/") {
          return (await caches.match("/offline/certificate")) || (await caches.match("/offline")) || emergencyOfflineResponse();
        }
        return (await caches.match("/offline")) || emergencyOfflineResponse();
      }
    })());
    return;
  }

  if (request.destination === "script" || request.destination === "style" || request.destination === "font") {
    event.respondWith(
      fetchWithTimeout(request)
        .then((response) => cacheIfUsable(request, response))
        .catch(async () => (await caches.match(request)) || Response.error()),
    );
    return;
  }

  if (request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetchWithTimeout(request).then((response) => cacheIfUsable(request, response))),
    );
  }
});
