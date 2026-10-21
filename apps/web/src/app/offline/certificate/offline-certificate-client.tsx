"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck, WifiOff, XCircle } from "lucide-react";
import { productUrls } from "@product/config";
import { BrandHomeLink } from "../../../components/brand-home-link";
import styles from "./offline-certificate-client.module.css";
import {
  type OfflinePublicCertificateEnvelope,
  type OfflinePublicCertificatePayload,
  verifyOfflinePublicCertificate,
} from "../../../lib/offline-public-certificate";

const MAX_RESPONSE_BYTES = 32_768;
const STORAGE_PREFIX = "nexid:offline-public-certificate:v1:";
const REQUEST_TIMEOUT_MS = 10_000;
// Schedule a local recheck using the verifier's existing five-minute clock tolerance.
// Only the original verifier decides whether the certificate has actually expired.
const CERTIFICATE_CLOCK_TOLERANCE_MS = 300_000;

type StoredCertificate = {
  schemaVersion: 1;
  storedAt: string;
  envelope: OfflinePublicCertificateEnvelope;
  jwks: unknown;
};

type ViewState =
  | { status: "loading" }
  | { status: "verified"; payload: OfflinePublicCertificatePayload; kid: string; source: "network" | "device"; stored: StoredCertificate; notice?: string }
  | { status: "invalid"; reason: string }
  | { status: "unavailable"; failure: "offline" | "timeout" | "network"; cachedReason?: string };

function isValidGtin14(gtin: string) {
  if (!/^\d{14}$/.test(gtin)) return false;
  let sum = 0;
  for (let index = 0; index < 13; index += 1) sum += Number(gtin[index]) * (index % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === Number(gtin[13]);
}

function validQualifier(value: string) {
  return !value || (/^[\x21-\x7e]{1,20}$/.test(value) && !/[\/?#]/.test(value));
}

function lookupFrom(search: URLSearchParams) {
  const gtin = String(search.get("gtin") || "").trim();
  const lot = String(search.get("lot") || "").trim();
  const serial = String(search.get("serial") || "").trim();
  if (!isValidGtin14(gtin) || !validQualifier(lot) || !validQualifier(serial)) return null;
  return { gtin, lot, serial };
}

function storageKey(lookup: NonNullable<ReturnType<typeof lookupFrom>>) {
  return `${STORAGE_PREFIX}${lookup.gtin}:${encodeURIComponent(lookup.lot)}:${encodeURIComponent(lookup.serial)}`;
}

async function readBoundedJson(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("response_too_large");
  if (!response.body) throw new Error("response_empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error("response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

function loadStored(key: string): StoredCertificate | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw || raw.length > MAX_RESPONSE_BYTES * 2) return null;
    const parsed = JSON.parse(raw) as StoredCertificate;
    return parsed?.schemaVersion === 1 && parsed.envelope && parsed.jwks ? parsed : null;
  } catch {
    return null;
  }
}

function saveStored(key: string, stored: StoredCertificate): boolean {
  const serialized = JSON.stringify(stored);
  if (serialized.length > MAX_RESPONSE_BYTES * 2) return false;
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch {
    // A valid certificate remains visible even if private browsing blocks storage.
    return false;
  }
}

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : "No disponible";
}

function publicText(payload: OfflinePublicCertificatePayload, key: string) {
  return typeof payload.public_data[key] === "string" ? payload.public_data[key] : "";
}

function verificationMessage(reason: string) {
  switch (reason) {
    case "expired": return "El certificado guardado venció. Conectate para obtener una versión vigente.";
    case "not_yet_valid": return "El certificado todavía no está vigente. Revisá la fecha y hora del dispositivo.";
    case "crypto_unavailable": return "Este navegador no pudo comprobar la firma. Probá con un navegador actualizado.";
    case "lookup_mismatch": return "El certificado no corresponde al producto, lote o serie que abriste.";
    case "signature_invalid": return "No pudimos comprobar la firma de este certificado. No lo mostramos como verificado.";
    default: return "No pudimos comprobar el certificado guardado o su clave pública. Conectate para obtener otra copia.";
  }
}

async function verifyForLookup(stored: StoredCertificate, lookup: NonNullable<ReturnType<typeof lookupFrom>>) {
  const verification = await verifyOfflinePublicCertificate(stored.envelope, stored.jwks);
  if (!verification.valid) return verification;
  // The public GS1 endpoint resolves this exact triple, including empty qualifiers.
  // A valid signature for another identity is not a result for this lookup.
  if (verification.payload.gtin !== lookup.gtin
    || (verification.payload.lot || "") !== lookup.lot
    || (verification.payload.serial || "") !== lookup.serial) {
    return { valid: false, reason: "lookup_mismatch" } as const;
  }
  return verification;
}

export function OfflineCertificateClient() {
  const searchParams = useSearchParams();
  const lookup = useMemo(() => lookupFrom(searchParams), [searchParams]);
  const key = lookup ? storageKey(lookup) : null;
  // The public cached shell has no query. SSR and the first client render must
  // stay identical until effects mount, even when the browser opens a GS1 URL.
  const [mounted, setMounted] = useState(false);
  const [result, setResult] = useState<{ key: string | null; view: ViewState }>({ key: null, view: { status: "loading" } });
  // After mount, a changed/removed query cannot display the previous product.
  const state: ViewState = !mounted
    ? { status: "loading" }
    : !lookup || !key
      ? { status: "invalid", reason: "Identificador GS1 inválido o incompleto." }
      : result.key === key ? result.view : { status: "loading" };
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const loadVersion = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const refresh = useCallback(async () => {
    if (!lookup || !key) {
      setRefreshing(false);
      return;
    }
    const version = ++loadVersion.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    const current = () => loadVersion.current === version;
    let deadline: number | undefined;
    let timedOut = false;
    let cachedReason: string | undefined;
    let cachedView: Extract<ViewState, { status: "verified" }> | undefined;
    setRefreshing(false);
    setResult({ key, view: { status: "loading" } });
    try {
      const cached = loadStored(key);
      if (cached) {
        const verification = await verifyForLookup(cached, lookup);
        if (!current()) return;
        if (verification.valid) {
          cachedView = { status: "verified", payload: verification.payload, kid: verification.kid, source: "device", stored: cached };
          setResult({ key, view: cachedView });
        } else {
          cachedReason = verification.reason;
        }
      }
      if (!current()) return;
      if (navigator.onLine === false) {
        setResult({ key, view: cachedView
          ? { ...cachedView, notice: "Sin conexión. La firma de esta copia se comprobó en este dispositivo." }
          : { status: "unavailable", failure: "offline", cachedReason } });
        return;
      }
      setRefreshing(true);
      deadline = window.setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
      const query = new URLSearchParams({ gtin: lookup.gtin });
      if (lookup.lot) query.set("lot", lookup.lot);
      if (lookup.serial) query.set("serial", lookup.serial);
      const certificateUrl = `${productUrls.api}/public/offline-certificates/gs1?${query.toString()}`;
      const jwksUrl = `${productUrls.api}/public/offline-certificates/jwks`;
      const [certificateResponse, jwksResponse] = await Promise.all([
        fetch(certificateUrl, { cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal, headers: { accept: "application/json" } }),
        fetch(jwksUrl, { cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal, headers: { accept: "application/json" } }),
      ]);
      if (!certificateResponse.ok || !jwksResponse.ok) throw new Error("certificate_unavailable");
      const [certificateResult, jwks] = await Promise.all([
        readBoundedJson(certificateResponse),
        readBoundedJson(jwksResponse),
      ]);
      if (!certificateResult || typeof certificateResult !== "object" || Array.isArray(certificateResult)) throw new Error("certificate_malformed");
      const envelope = (certificateResult as { certificate?: unknown }).certificate as OfflinePublicCertificateEnvelope;
      const stored: StoredCertificate = { schemaVersion: 1, storedAt: new Date().toISOString(), envelope, jwks };
      const verification = await verifyForLookup(stored, lookup);
      if (!current()) return;
      if (timedOut) throw new Error("certificate_timeout");
      if (!verification.valid) {
        setResult({ key, view: { status: "invalid", reason: verificationMessage(verification.reason) } });
        return;
      }
      const storedLocally = saveStored(key, stored);
      setResult({ key, view: { status: "verified", payload: verification.payload, kid: verification.kid, source: "network", stored, notice: storedLocally
        ? undefined
        : "El certificado es válido, pero no pudimos guardar esta versión en el navegador. Podés descargarlo." } });
    } catch {
      // A deadline is a current failure; unmount, a new lookup or a newer attempt
      // cancels this generation and cannot change the screen or write storage.
      if (!current()) return;
      const cached = loadStored(key);
      if (cached) {
        const verification = await verifyForLookup(cached, lookup);
        if (!current()) return;
        if (verification.valid) {
          setResult({ key, view: { status: "verified", payload: verification.payload, kid: verification.kid, source: "device", stored: cached, notice: timedOut
            ? "La actualización tardó demasiado. Seguís viendo la copia local vigente."
            : "No pudimos actualizar. Seguís viendo la copia local vigente; podés reintentar." } });
          return;
        }
        cachedReason = verification.reason;
      }
      if (current()) setResult({ key, view: { status: "unavailable", failure: navigator.onLine === false ? "offline" : timedOut ? "timeout" : "network", cachedReason } });
    } finally {
      if (deadline !== undefined) window.clearTimeout(deadline);
      controller.abort();
      if (current()) {
        requestController.current = null;
        setRefreshing(false);
      }
    }
  }, [key, lookup]);

  useEffect(() => {
    const updateConnectivity = () => setOnline(navigator.onLine !== false);
    updateConnectivity();
    window.addEventListener("online", updateConnectivity);
    window.addEventListener("offline", updateConnectivity);
    void refresh();
    return () => {
      loadVersion.current += 1;
      requestController.current?.abort();
      requestController.current = null;
      window.removeEventListener("online", updateConnectivity);
      window.removeEventListener("offline", updateConnectivity);
    };
  }, [refresh]);

  useEffect(() => {
    if (!lookup || !key || state.status !== "verified") return;
    let disposed = false;
    let timer: number | undefined;
    const version = loadVersion.current;
    const recheck = async () => {
      const verification = await verifyForLookup(state.stored, lookup);
      if (!disposed && loadVersion.current === version && !verification.valid) {
        setResult(previous => previous.key === key && previous.view.status === "verified" && previous.view.stored === state.stored
          ? { key, view: { status: "invalid", reason: verificationMessage(verification.reason) } }
          : previous);
      }
    };
    const schedule = () => {
      const remaining = Date.parse(state.payload.expires_at) + CERTIFICATE_CLOCK_TOLERANCE_MS + 1 - Date.now();
      timer = window.setTimeout(remaining > 2_147_483_647 ? schedule : () => void recheck(), Math.max(0, Math.min(remaining, 2_147_483_647)));
    };
    const checkVisible = () => { if (document.visibilityState === "visible") void recheck(); };
    schedule();
    document.addEventListener("visibilitychange", checkVisible);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkVisible);
    };
  }, [key, lookup, state]);

  const download = () => {
    if (state.status !== "verified") return;
    const blob = new Blob([JSON.stringify(state.stored.envelope, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `nexid-public-certificate-${state.payload.gtin}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <main className={`${styles.page} nexid-offline-certificate-page min-h-screen bg-[#050914] px-4 py-7 text-slate-100 sm:py-12`}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <BrandHomeLink size={42} className={styles.focusAction} />
          <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">Certificado público</span>
        </header>

        {state.status === "verified" ? (
          <section aria-busy={refreshing} className="overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-slate-950/85 shadow-2xl shadow-emerald-950/20">
            <div className="bg-gradient-to-br from-emerald-400/15 via-slate-950 to-cyan-400/10 p-6 sm:p-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                <CheckCircle2 aria-hidden="true" size={14} /> Firma digital válida
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Información pública verificada</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Comprobamos la firma y la vigencia de esta copia de la información publicada por la marca.
              </p>
            </div>
            <div className="v3-space-y-5 p-6 sm:p-8">
              <dl className="grid gap-4 sm:grid-cols-2">
                {publicText(state.payload, "display_name") ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Producto</dt><dd className="mt-1 font-black text-white">{publicText(state.payload, "display_name")}</dd></div> : null}
                {publicText(state.payload, "brand") ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Marca declarada</dt><dd className="mt-1 font-black text-white">{publicText(state.payload, "brand")}</dd></div> : null}
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">GTIN</dt><dd className="mt-1 break-all font-mono text-sm text-slate-100">{state.payload.gtin}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Lote nexID</dt><dd className="mt-1 break-all font-mono text-sm text-slate-100">{state.payload.batch_id}</dd></div>
                {state.payload.lot ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Lote GS1</dt><dd className="mt-1 font-mono text-sm text-slate-100">{state.payload.lot}</dd></div> : null}
                {state.payload.serial ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Serie GS1</dt><dd className="mt-1 font-mono text-sm text-slate-100">{state.payload.serial}</dd></div> : null}
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Emitido</dt><dd className="mt-1 text-sm text-slate-200">{displayDate(state.payload.issued_at)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Vence</dt><dd className="mt-1 text-sm text-slate-200">{displayDate(state.payload.expires_at)}</dd></div>
              </dl>
              {publicText(state.payload, "description") ? <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{publicText(state.payload, "description")}</p> : null}
              <div className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-50/90">
                <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
                <p>La firma cubre esta información publicada. No comprueba el estado físico del producto ni una nueva lectura NFC. Las acciones que requieren verificar el producto se habilitan por separado.</p>
              </div>
              <p className="text-xs leading-5 text-slate-400">Fuente: {state.source === "device" ? "guardada en este dispositivo" : "actualizada desde nexID"}.</p>
              <details className="rounded-2xl border border-white/10 bg-white/[0.035] px-4">
                <summary className={`${styles.focusAction} flex min-h-11 cursor-pointer items-center text-sm font-bold text-slate-200`}>Cómo se verificó</summary>
                <p className="pb-4 text-xs leading-5 text-slate-300">La firma digital usa ES256 y la clave pública {state.kid}. No evalúa una nueva lectura NFC, su reutilización ni la autenticidad física del producto.</p>
              </details>
              <p role="status" aria-live="polite" className="text-sm leading-6 text-slate-300">{refreshing ? "Buscando una versión actualizada…" : state.notice || (!online ? "Sin conexión. Podés volver a comprobar la copia local." : "")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={download} className={`${styles.focusAction} inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 text-sm font-black text-emerald-100 hover:bg-emerald-300/15`}>
                  <Download aria-hidden="true" size={17} /> Descargar certificado
                </button>
                <button type="button" onClick={() => void refresh()} disabled={refreshing} className={`${styles.focusAction} inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 hover:border-cyan-300/25 disabled:opacity-50`}>
                  <RefreshCw aria-hidden="true" size={17} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Actualizando…" : online ? "Actualizar online" : "Comprobar copia local"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section aria-busy={state.status === "loading" || refreshing} className="rounded-[2rem] border border-amber-300/20 bg-slate-950/85 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              {state.status === "loading" ? <RefreshCw aria-hidden="true" className="mt-1 shrink-0 animate-spin text-cyan-200" /> : state.status === "unavailable" ? <WifiOff aria-hidden="true" className="mt-1 shrink-0 text-amber-200" /> : <XCircle aria-hidden="true" className="mt-1 shrink-0 text-rose-200" />}
              <div>
                <h1 className="text-3xl font-black text-white">{state.status === "loading" ? "Comprobando certificado" : "No verificado"}</h1>
                <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-slate-300">
                  {state.status === "loading"
                    ? "Estamos comprobando la firma digital y la vigencia del certificado."
                    : state.status === "unavailable"
                      ? `${state.failure === "offline"
                        ? "No hay conexión ni un certificado local vigente para este producto. Cuando vuelvas a conectarte, elegí Reintentar."
                        : state.failure === "timeout"
                          ? "La consulta tardó demasiado. No pudimos obtener un certificado vigente; podés reintentar."
                          : "No pudimos obtener un certificado vigente. Revisá la conexión y volvé a intentar."}${state.cachedReason ? ` ${verificationMessage(state.cachedReason)}` : ""}`
                      : state.reason}
                </p>
              </div>
            </div>
            {state.status !== "loading" && lookup ? (
              <button type="button" onClick={() => void refresh()} disabled={refreshing} className={`${styles.focusAction} mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 text-sm font-black text-cyan-100 disabled:opacity-50`}>
                <RefreshCw aria-hidden="true" size={17} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Consultando…" : online ? "Reintentar" : "Volver a comprobar"}
              </button>
            ) : null}
          </section>
        )}

        <aside className="flex gap-3 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 text-sm leading-6 text-slate-300">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-200" size={20} />
          <p>La verificación usa solo la clave pública y puede repetirse sin conexión mientras el certificado guardado siga vigente. No se guarda ni distribuye ninguna clave NFC.</p>
        </aside>

        <a href="/offline" className={`${styles.focusAction} inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 hover:border-cyan-300/25`}>Volver al centro offline</a>
      </div>
    </main>
  );
}
