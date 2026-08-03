"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, ShieldAlert, Trash2, Wifi, WifiOff, XCircle } from "lucide-react";
import { BrandLockup } from "@product/ui";
import {
  isOfflineSunStatus,
  isTerminalOfflineSunStatus,
  type OfflinePublicProduct,
  type OfflineSunStatus,
} from "../../lib/offline-sun-contract";
import {
  cacheOfflinePublicProduct,
  getOfflinePublicProduct,
  listOfflineSunRecords,
  putOfflineSunRecord,
  removeOfflineSunRecord,
  type OfflineSunRecord,
} from "./offline-store";

type Connectivity = "online" | "offline";

const OFFLINE_PENDING_PUBLIC_COPY = "Sin conexión. La información pública está disponible. La autenticidad criptográfica se confirmará al recuperar conexión.";

const STATUS_COPY: Record<OfflineSunStatus, { title: string; body: string; tone: string }> = {
  PENDING_BACKEND_VERIFICATION: {
    title: "Verificación pendiente",
    body: OFFLINE_PENDING_PUBLIC_COPY,
    tone: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  },
  SYNCING: {
    title: "Sincronizando",
    body: "Estamos enviando el mensaje guardado al verificador online.",
    tone: "border-cyan-400/35 bg-cyan-400/10 text-cyan-100",
  },
  SYNCED_VALID: {
    title: "Validación online completada",
    body: "El backend aceptó el mensaje SUN/CMAC. Esto no acredita por sí solo contenido físico, origen, custodia ni propiedad.",
    tone: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  },
  SYNCED_INVALID: {
    title: "Lectura no validada",
    body: "El backend no pudo validar el mensaje. Repetí el tap físico antes de continuar.",
    tone: "border-rose-400/35 bg-rose-400/10 text-rose-100",
  },
  REPLAY_SUSPECT: {
    title: "Repetición detectada",
    body: "El backend reconoció un mensaje ya utilizado. Hacé un nuevo tap físico para obtener una lectura fresca.",
    tone: "border-rose-400/35 bg-rose-400/10 text-rose-100",
  },
  SYNC_FAILED: {
    title: "Sincronización pendiente",
    body: "No pudimos completar el envío. Se conserva en este dispositivo para reintentar cuando vuelva la conexión.",
    tone: "border-amber-400/35 bg-amber-400/10 text-amber-100",
  },
};

function safePublicText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function readPublicProduct(value: unknown, expectedBid: string): OfflinePublicProduct | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (source.bid !== expectedBid) return undefined;
  const cachedAt = safePublicText(source.cachedAt, 40);
  if (!cachedAt || !Number.isFinite(Date.parse(cachedAt))) return undefined;
  const agroSource = source.agro && typeof source.agro === "object" && !Array.isArray(source.agro)
    ? source.agro as Record<string, unknown>
    : {};
  const readList = (candidate: unknown) => Array.isArray(candidate)
    ? candidate.map((item) => safePublicText(item, 180)).filter(Boolean).slice(0, 12)
    : [];
  const agro = {
    crop: safePublicText(agroSource.crop, 120) || undefined,
    seedVariety: safePublicText(agroSource.seedVariety, 160) || undefined,
    productFamily: safePublicText(agroSource.productFamily, 160) || undefined,
    activeIngredient: safePublicText(agroSource.activeIngredient, 240) || undefined,
    formulation: safePublicText(agroSource.formulation, 160) || undefined,
    registrationNumber: safePublicText(agroSource.registrationNumber, 160) || undefined,
    batchLot: safePublicText(agroSource.batchLot, 160) || undefined,
    productionDate: safePublicText(agroSource.productionDate, 40) || undefined,
    expirationDate: safePublicText(agroSource.expirationDate, 40) || undefined,
    distributor: safePublicText(agroSource.distributor, 200) || undefined,
    authorizedChannel: safePublicText(agroSource.authorizedChannel, 200) || undefined,
    ppeSummary: safePublicText(agroSource.ppeSummary, 600) || undefined,
    ppeItems: readList(agroSource.ppeItems),
    stewardshipSummary: safePublicText(agroSource.stewardshipSummary, 1_000) || undefined,
    stewardshipItems: readList(agroSource.stewardshipItems),
  };
  return {
    bid: expectedBid,
    name: safePublicText(source.name, 120) || undefined,
    brand: safePublicText(source.brand, 120) || undefined,
    region: safePublicText(source.region, 120) || undefined,
    origin: safePublicText(source.origin, 160) || undefined,
    storage: safePublicText(source.storage, 180) || undefined,
    notes: safePublicText(source.notes, 320) || undefined,
    agro: Object.values(agro).some((item) => Array.isArray(item) ? item.length > 0 : Boolean(item)) ? agro : undefined,
    cachedAt,
  };
}

function statusIcon(status: OfflineSunStatus) {
  if (status === "SYNCED_VALID") return CheckCircle2;
  if (status === "SYNCED_INVALID" || status === "REPLAY_SUSPECT") return XCircle;
  if (status === "SYNCING") return RefreshCw;
  return Clock3;
}

function formatCapturedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function enrichWithCachedProduct(records: OfflineSunRecord[]) {
  return Promise.all(records.map(async (record) => {
    const embedded = readPublicProduct(record.publicProduct, record.params.bid);
    if (embedded) return { ...record, publicProduct: embedded };
    const cached = await getOfflinePublicProduct(record.params.bid).catch(() => null);
    const product = readPublicProduct(cached, record.params.bid);
    return product ? { ...record, publicProduct: product } : { ...record, publicProduct: undefined };
  }));
}

export function OfflineQueueClient() {
  const [records, setRecords] = useState<OfflineSunRecord[]>([]);
  const [connectivity, setConnectivity] = useState<Connectivity>("offline");
  const [storageReady, setStorageReady] = useState(false);
  const syncingRef = useRef(false);

  const refresh = useCallback(async () => {
    const stored = await listOfflineSunRecords().catch(() => []);
    setRecords(await enrichWithCachedProduct(stored));
    setStorageReady(true);
  }, []);

  const syncPending = useCallback(async () => {
    if (syncingRef.current || typeof navigator === "undefined" || !navigator.onLine) return;
    const run = async () => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const current = await listOfflineSunRecords().catch(() => []);
        const pending = current.filter((record) => !isTerminalOfflineSunStatus(record.status));

        for (const record of pending) {
          const syncing: OfflineSunRecord = {
            ...record,
            status: "SYNCING",
            attempts: Math.max(0, Number(record.attempts) || 0) + 1,
            updatedAt: new Date().toISOString(),
            lastError: undefined,
          };
          await putOfflineSunRecord(syncing);
          await refresh();

          try {
            const response = await fetch("/api/offline/sun-sync", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                schemaVersion: 1,
                scanId: record.id,
                params: record.params,
              }),
              cache: "no-store",
              credentials: "same-origin",
            });
            const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

            if (!response.ok || payload?.ok !== true || !isOfflineSunStatus(payload.status) || !isTerminalOfflineSunStatus(payload.status)) {
              const lastError = response.status === 429 ? "rate_limited" : response.status === 0 ? "network_unavailable" : "sync_unavailable";
              await putOfflineSunRecord({
                ...syncing,
                status: "SYNC_FAILED",
                updatedAt: new Date().toISOString(),
                lastError,
              });
              continue;
            }

            const publicProduct = readPublicProduct(payload.publicProduct, record.params.bid);
            const next: OfflineSunRecord = {
              ...syncing,
              status: payload.status,
              verdict: payload.verdict === "MESSAGE_VALID" || payload.verdict === "MESSAGE_NOT_VALID" || payload.verdict === "REPLAY_SUSPECT"
                ? payload.verdict
                : undefined,
              checkedAt: safePublicText(payload.checkedAt, 40) || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastError: undefined,
              ...(publicProduct ? { publicProduct } : {}),
            };
            await putOfflineSunRecord(next);
            if (publicProduct) await cacheOfflinePublicProduct(publicProduct);
          } catch {
            await putOfflineSunRecord({
              ...syncing,
              status: "SYNC_FAILED",
              updatedAt: new Date().toISOString(),
              lastError: "network_unavailable",
            }).catch(() => undefined);
          }
        }
      } finally {
        syncingRef.current = false;
        await refresh();
      }
    };

    if (navigator.locks) {
      await navigator.locks.request("nexid-offline-sun-sync", { mode: "exclusive", ifAvailable: true }, async (lock) => {
        if (lock) await run();
      });
      return;
    }
    await run();
  }, [refresh]);

  useEffect(() => {
    const updateConnectivity = () => setConnectivity(navigator.onLine ? "online" : "offline");
    const handleOnline = () => {
      updateConnectivity();
      void syncPending();
    };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "NEXID_OFFLINE_QUEUE_UPDATED") void refresh();
    };

    updateConnectivity();
    void refresh().then(() => {
      if (navigator.onLine) void syncPending();
    });
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", updateConnectivity);
    navigator.serviceWorker?.addEventListener("message", handleWorkerMessage);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", updateConnectivity);
      navigator.serviceWorker?.removeEventListener("message", handleWorkerMessage);
    };
  }, [refresh, syncPending]);

  const remove = async (id: string) => {
    await removeOfflineSunRecord(id).catch(() => undefined);
    await refresh();
  };

  const pendingCount = records.filter((record) => !isTerminalOfflineSunStatus(record.status)).length;

  return (
    <main className="min-h-screen bg-[#050914] px-4 py-6 text-slate-100 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <BrandLockup size={42} variant="ripple" theme="dark" />
          <span className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-black uppercase tracking-[0.14em] ${connectivity === "online" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}>
            {connectivity === "online" ? <Wifi aria-hidden="true" size={16} /> : <WifiOff aria-hidden="true" size={16} />}
            {connectivity === "online" ? "Con conexión" : "Sin conexión"}
          </span>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-slate-950/80 shadow-2xl shadow-cyan-950/30">
          <div className="border-b border-white/10 bg-gradient-to-br from-cyan-400/10 via-slate-950 to-violet-500/10 p-6 sm:p-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-100">
              <ShieldAlert aria-hidden="true" size={14} /> Offline Level 1
            </span>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Verificación pendiente</h1>
            <code className="mt-3 inline-flex rounded-full border border-amber-300/25 bg-black/20 px-3 py-1.5 text-[10px] font-black tracking-[0.14em] text-amber-100">VERIFICATION_PENDING</code>
            <p className="mt-3 max-w-xl text-base leading-7 text-slate-300">{OFFLINE_PENDING_PUBLIC_COPY}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              El tap quedó guardado localmente. La aplicación pública no lleva material secreto y espera el veredicto del backend.
            </p>
          </div>

          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Guardados</span>
              <strong className="mt-2 block text-2xl text-white">{records.length}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Por sincronizar</span>
              <strong className="mt-2 block text-2xl text-white">{pendingCount}</strong>
            </div>
            <button
              type="button"
              onClick={() => void syncPending()}
              disabled={connectivity !== "online" || pendingCount === 0}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RefreshCw aria-hidden="true" size={17} /> Reintentar ahora
            </button>
          </div>
        </section>

        <section aria-live="polite" aria-busy={!storageReady} className="space-y-4">
          {!storageReady ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 text-slate-300">Abriendo la cola local…</div>
          ) : records.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
              <h2 className="text-xl font-black text-white">No hay lecturas pendientes</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Cuando una navegación SUN falle por conectividad, aparecerá acá sin exponer el payload técnico en pantalla.</p>
            </div>
          ) : records.map((record) => {
            const copy = STATUS_COPY[record.status];
            const StatusIcon = statusIcon(record.status);
            const product = record.publicProduct;
            return (
              <article key={record.id} className="rounded-3xl border border-white/10 bg-slate-950/80 p-5 shadow-xl shadow-black/20 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Lote público</span>
                    <h2 className="mt-1 break-words text-xl font-black text-white">{record.params.bid}</h2>
                    <p className="mt-1 text-xs text-slate-500">Capturado {formatCapturedAt(record.capturedAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(record.id)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-rose-300/30 hover:text-rose-200"
                    aria-label={`Eliminar lectura ${record.params.bid}`}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </div>

                <div className={`mt-4 flex gap-3 rounded-2xl border p-4 ${copy.tone}`}>
                  <StatusIcon aria-hidden="true" size={20} className={record.status === "SYNCING" ? "mt-0.5 shrink-0 animate-spin" : "mt-0.5 shrink-0"} />
                  <div>
                    <strong className="block text-sm">{copy.title}</strong>
                    <p className="mt-1 text-sm leading-6 opacity-90">{copy.body}</p>
                    <code className="mt-2 block text-[10px] font-bold tracking-wide opacity-70">{record.status}</code>
                  </div>
                </div>

                {product ? (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-200">Información pública guardada</span>
                    <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      {product.name ? <div><dt className="text-slate-500">Producto</dt><dd className="mt-0.5 font-bold text-slate-100">{product.name}</dd></div> : null}
                      {product.brand ? <div><dt className="text-slate-500">Marca</dt><dd className="mt-0.5 font-bold text-slate-100">{product.brand}</dd></div> : null}
                      {product.region ? <div><dt className="text-slate-500">Región declarada</dt><dd className="mt-0.5 font-bold text-slate-100">{product.region}</dd></div> : null}
                      {product.origin ? <div><dt className="text-slate-500">Origen declarado</dt><dd className="mt-0.5 font-bold text-slate-100">{product.origin}</dd></div> : null}
                      {product.storage ? <div className="sm:col-span-2"><dt className="text-slate-500">Conservación informada</dt><dd className="mt-0.5 font-bold text-slate-100">{product.storage}</dd></div> : null}
                      {product.notes ? <div className="sm:col-span-2"><dt className="text-slate-500">Información del producto</dt><dd className="mt-0.5 leading-6 text-slate-300">{product.notes}</dd></div> : null}
                    </dl>
                    {product.agro ? (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">Pasaporte agro disponible offline</span>
                        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                          {product.agro.crop ? <div><dt className="text-slate-500">Cultivo</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.crop}</dd></div> : null}
                          {product.agro.seedVariety ? <div><dt className="text-slate-500">Variedad</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.seedVariety}</dd></div> : null}
                          {product.agro.productFamily ? <div><dt className="text-slate-500">Familia</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.productFamily}</dd></div> : null}
                          {product.agro.registrationNumber ? <div><dt className="text-slate-500">Registro</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.registrationNumber}</dd></div> : null}
                          {product.agro.batchLot ? <div><dt className="text-slate-500">Lote</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.batchLot}</dd></div> : null}
                          {product.agro.authorizedChannel ? <div><dt className="text-slate-500">Canal autorizado</dt><dd className="mt-0.5 font-bold text-slate-100">{product.agro.authorizedChannel}</dd></div> : null}
                          {product.agro.ppeSummary ? <div className="sm:col-span-2"><dt className="text-slate-500">EPP</dt><dd className="mt-0.5 leading-6 text-slate-200">{product.agro.ppeSummary}</dd></div> : null}
                          {product.agro.ppeItems?.length ? <div className="sm:col-span-2"><dt className="text-slate-500">Elementos requeridos</dt><dd><ul className="mt-1 list-disc space-y-1 pl-5 text-slate-200">{product.agro.ppeItems.map((item) => <li key={item}>{item}</li>)}</ul></dd></div> : null}
                          {product.agro.stewardshipSummary ? <div className="sm:col-span-2"><dt className="text-slate-500">Uso responsable</dt><dd className="mt-0.5 leading-6 text-slate-200">{product.agro.stewardshipSummary}</dd></div> : null}
                        </dl>
                      </div>
                    ) : null}
                    <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-500">Datos informativos guardados; no constituyen un veredicto criptográfico.</p>
                  </div>
                ) : null}

                {record.duplicateCount > 0 ? (
                  <p className="mt-3 text-xs text-slate-500">La misma lectura se detectó {record.duplicateCount + 1} veces y se conservó una sola entrada.</p>
                ) : null}
              </article>
            );
          })}
        </section>

        <aside className="flex gap-3 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-5 text-sm leading-6 text-amber-50/85">
          <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={20} />
          <p>Si el resultado es inválido o repetido, descartá esta lectura y hacé un nuevo tap físico. No reutilices una URL guardada como prueba.</p>
        </aside>

        <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 transition hover:border-cyan-300/30 hover:text-white">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
