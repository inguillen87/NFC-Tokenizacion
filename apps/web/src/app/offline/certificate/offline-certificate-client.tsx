"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck, WifiOff, XCircle } from "lucide-react";
import { productUrls } from "@product/config";
import { BrandLockup } from "@product/ui";
import {
  type OfflinePublicCertificateEnvelope,
  type OfflinePublicCertificatePayload,
  verifyOfflinePublicCertificate,
} from "../../../lib/offline-public-certificate";

const MAX_RESPONSE_BYTES = 32_768;
const STORAGE_PREFIX = "nexid:offline-public-certificate:v1:";

type StoredCertificate = {
  schemaVersion: 1;
  storedAt: string;
  envelope: OfflinePublicCertificateEnvelope;
  jwks: unknown;
};

type ViewState =
  | { status: "loading" }
  | { status: "verified"; payload: OfflinePublicCertificatePayload; kid: string; source: "network" | "device"; stored: StoredCertificate }
  | { status: "invalid"; reason: string }
  | { status: "unavailable"; cachedReason?: string };

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

function saveStored(key: string, stored: StoredCertificate) {
  const serialized = JSON.stringify(stored);
  if (serialized.length > MAX_RESPONSE_BYTES * 2) return;
  try {
    localStorage.setItem(key, serialized);
  } catch {
    // A valid certificate remains visible even if private browsing blocks storage.
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

export function OfflineCertificateClient() {
  const searchParams = useSearchParams();
  const lookup = useMemo(() => lookupFrom(searchParams), [searchParams]);
  const [state, setState] = useState<ViewState>(lookup ? { status: "loading" } : { status: "invalid", reason: "Identificador GS1 inválido o incompleto." });
  const [refreshing, setRefreshing] = useState(false);

  const verifyStored = useCallback(async (stored: StoredCertificate, source: "network" | "device") => {
    const verification = await verifyOfflinePublicCertificate(stored.envelope, stored.jwks);
    if (!verification.valid) return verification.reason;
    setState({ status: "verified", payload: verification.payload, kid: verification.kid, source, stored });
    return null;
  }, []);

  const refresh = useCallback(async () => {
    if (!lookup) return;
    setRefreshing(true);
    const key = storageKey(lookup);
    try {
      const query = new URLSearchParams({ gtin: lookup.gtin });
      if (lookup.lot) query.set("lot", lookup.lot);
      if (lookup.serial) query.set("serial", lookup.serial);
      const certificateUrl = `${productUrls.api}/public/offline-certificates/gs1?${query.toString()}`;
      const jwksUrl = `${productUrls.api}/public/offline-certificates/jwks`;
      const [certificateResponse, jwksResponse] = await Promise.all([
        fetch(certificateUrl, { cache: "no-store", headers: { accept: "application/json" } }),
        fetch(jwksUrl, { cache: "no-store", headers: { accept: "application/json" } }),
      ]);
      if (!certificateResponse.ok || !jwksResponse.ok) throw new Error("certificate_unavailable");
      const [certificateResult, jwks] = await Promise.all([
        readBoundedJson(certificateResponse),
        readBoundedJson(jwksResponse),
      ]);
      if (!certificateResult || typeof certificateResult !== "object" || Array.isArray(certificateResult)) throw new Error("certificate_malformed");
      const envelope = (certificateResult as { certificate?: unknown }).certificate as OfflinePublicCertificateEnvelope;
      const stored: StoredCertificate = { schemaVersion: 1, storedAt: new Date().toISOString(), envelope, jwks };
      const invalidReason = await verifyStored(stored, "network");
      if (invalidReason) {
        setState({ status: "invalid", reason: `La firma no pudo validarse (${invalidReason}).` });
        return;
      }
      saveStored(key, stored);
    } catch {
      const cached = loadStored(key);
      if (cached) {
        const cachedReason = await verifyStored(cached, "device");
        if (!cachedReason) return;
        setState({ status: "unavailable", cachedReason });
      } else {
        setState({ status: "unavailable" });
      }
    } finally {
      setRefreshing(false);
    }
  }, [lookup, verifyStored]);

  useEffect(() => {
    if (!lookup) return;
    const cached = loadStored(storageKey(lookup));
    void (async () => {
      if (cached) await verifyStored(cached, "device");
      await refresh();
    })();
  }, [lookup, refresh, verifyStored]);

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
    <main className="min-h-screen bg-[#050914] px-4 py-7 text-slate-100 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <header className="flex items-center justify-between gap-4">
          <BrandLockup size={42} variant="ripple" theme="dark" />
          <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">Offline Level 4</span>
        </header>

        {state.status === "verified" ? (
          <section className="overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-slate-950/85 shadow-2xl shadow-emerald-950/20">
            <div className="bg-gradient-to-br from-emerald-400/15 via-slate-950 to-cyan-400/10 p-6 sm:p-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
                <CheckCircle2 aria-hidden="true" size={14} /> Firma ES256 válida
              </span>
              <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">Información pública verificada</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                La firma se comprobó localmente con una clave pública. Este resultado cubre la instantánea informativa; no reemplaza una validación SUN/SDM en línea.
              </p>
            </div>
            <div className="space-y-5 p-6 sm:p-8">
              <dl className="grid gap-4 sm:grid-cols-2">
                {publicText(state.payload, "display_name") ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Producto</dt><dd className="mt-1 font-black text-white">{publicText(state.payload, "display_name")}</dd></div> : null}
                {publicText(state.payload, "brand") ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Marca declarada</dt><dd className="mt-1 font-black text-white">{publicText(state.payload, "brand")}</dd></div> : null}
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">GTIN</dt><dd className="mt-1 break-all font-mono text-sm text-slate-100">{state.payload.gtin}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Lote nexID</dt><dd className="mt-1 break-all font-mono text-sm text-slate-100">{state.payload.batch_id}</dd></div>
                {state.payload.lot ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Lote GS1</dt><dd className="mt-1 font-mono text-sm text-slate-100">{state.payload.lot}</dd></div> : null}
                {state.payload.serial ? <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Serie GS1</dt><dd className="mt-1 font-mono text-sm text-slate-100">{state.payload.serial}</dd></div> : null}
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Emitido</dt><dd className="mt-1 text-sm text-slate-200">{displayDate(state.payload.issued_at)}</dd></div>
                <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-500">Vence</dt><dd className="mt-1 text-sm text-slate-200">{displayDate(state.payload.expires_at)}</dd></div>
              </dl>
              {publicText(state.payload, "description") ? <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">{publicText(state.payload, "description")}</p> : null}
              <div className="flex gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-50/90">
                <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={19} />
                <p>SUN/SDM y replay no fueron evaluados por este certificado. Para habilitar claim, garantía o tokenización hace falta una lectura validada por el backend.</p>
              </div>
              <p className="text-xs leading-5 text-slate-500">Clave pública: {state.kid} · Fuente: {state.source === "device" ? "guardada en este dispositivo" : "actualizada desde nexID"}.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={download} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 text-sm font-black text-emerald-100 hover:bg-emerald-300/15">
                  <Download aria-hidden="true" size={17} /> Descargar certificado
                </button>
                <button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 hover:border-cyan-300/25 disabled:opacity-50">
                  <RefreshCw aria-hidden="true" size={17} className={refreshing ? "animate-spin" : ""} /> Actualizar online
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-amber-300/20 bg-slate-950/85 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              {state.status === "loading" ? <RefreshCw aria-hidden="true" className="mt-1 shrink-0 animate-spin text-cyan-200" /> : state.status === "unavailable" ? <WifiOff aria-hidden="true" className="mt-1 shrink-0 text-amber-200" /> : <XCircle aria-hidden="true" className="mt-1 shrink-0 text-rose-200" />}
              <div>
                <h1 className="text-3xl font-black text-white">{state.status === "loading" ? "Verificando firma pública" : "No verificado"}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {state.status === "loading"
                    ? "Estamos comprobando el certificado y su clave pública."
                    : state.status === "unavailable"
                      ? `No hay un certificado local válido y no fue posible obtener uno nuevo.${state.cachedReason ? ` Estado local: ${state.cachedReason}.` : ""}`
                      : state.reason}
                </p>
              </div>
            </div>
            {state.status !== "loading" && lookup ? (
              <button type="button" onClick={() => void refresh()} disabled={refreshing} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-5 text-sm font-black text-cyan-100 disabled:opacity-50">
                <RefreshCw aria-hidden="true" size={17} className={refreshing ? "animate-spin" : ""} /> Reintentar
              </button>
            ) : null}
          </section>
        )}

        <aside className="flex gap-3 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5 text-sm leading-6 text-slate-300">
          <ShieldCheck aria-hidden="true" className="mt-0.5 shrink-0 text-cyan-200" size={20} />
          <p>La verificación usa solo la clave pública y puede repetirse sin conexión mientras el certificado guardado siga vigente. No se guarda ni distribuye ninguna clave NFC.</p>
        </aside>

        <Link href="/offline" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-5 text-sm font-black text-slate-200 hover:border-cyan-300/25">Volver al centro offline</Link>
      </div>
    </main>
  );
}
