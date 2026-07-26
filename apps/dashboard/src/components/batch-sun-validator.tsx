"use client";

import { useMemo, useState } from "react";

import { Button } from "@product/ui";

type JsonRecord = Record<string, unknown>;

type BatchSunValidatorProps = {
  bid?: string;
  defaultBid?: string;
  canRepair?: boolean;
};

type RunMode = "validate" | "debug" | "repair";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordAt(value: unknown, key: string): JsonRecord {
  if (!isRecord(value)) return {};
  const nested = value[key];
  return isRecord(nested) ? nested : {};
}

function stringAt(value: unknown, key: string): string {
  if (!isRecord(value)) return "";
  const raw = value[key];
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return "";
}

function boolAt(value: unknown, key: string): boolean | null {
  if (!isRecord(value)) return null;
  const raw = value[key];
  return typeof raw === "boolean" ? raw : null;
}

function findFirstString(value: unknown, keys: string[]): string {
  if (!isRecord(value)) return "";
  for (const key of keys) {
    const direct = stringAt(value, key);
    if (direct) return direct;
  }
  return "";
}

function summarizePayload(payload: unknown, mode: RunMode): { tone: string; title: string; detail: string } {
  if (!isRecord(payload)) {
    return {
      tone: "neutral",
      title: "Sin respuesta estructurada",
      detail: "La API respondio, pero no devolvio un objeto JSON legible.",
    };
  }

  if (mode === "repair") {
    const ok = boolAt(payload, "ok");
    return {
      tone: ok === false ? "danger" : "success",
      title: ok === false ? "No se pudo aplicar el perfil" : "Perfil TTStatus aplicado",
      detail:
        ok === false
          ? "Revisa permisos SuperAdmin o conectividad con la API."
          : "El batch quedo con lectura TTStatus de 2 bytes desde enc_decrypted. No modifica keys ni manifest.",
    };
  }

  const verifySun = recordAt(payload, "verifySun");
  const result = findFirstString(payload, ["result", "verdict", "status"]);
  const reason =
    findFirstString(verifySun, ["reason", "crypto_error_reason"]) ||
    findFirstString(payload, ["reason", "crypto_error_reason", "message"]);
  const uid =
    findFirstString(verifySun, ["uid_hex", "uidMasked", "uid_masked"]) ||
    findFirstString(payload, ["uid_hex", "uidMasked", "uid_masked"]);
  const ttRaw =
    findFirstString(payload, ["tt_raw", "ttstatus_raw", "ttStatusRaw"]) ||
    findFirstString(recordAt(payload, "ttstatus"), ["raw", "tt_raw", "ttstatus_raw"]);
  const ok = boolAt(verifySun, "ok") ?? boolAt(payload, "ok");
  const cmac = boolAt(verifySun, "cmac_valid") ?? boolAt(payload, "cmac_valid");
  const uidDecoded = boolAt(verifySun, "uid_decoded") ?? boolAt(payload, "uid_decoded");

  if (result === "REPLAY_SUSPECT") {
    return {
      tone: "warning",
      title: "Replay detectado",
      detail: "La URL ya fue usada. La UX debe pedir un nuevo tap fisico antes de ownership, garantia o NFT.",
    };
  }

  if (result === "VALID_CLOSED" || ttRaw === "4343") {
    return {
      tone: "success",
      title: "Mensaje NFC válido · TT reporta cerrado",
      detail: `UID ${uid || "decodificado"} con TTStatus ${ttRaw || "4343"}. No certifica contenido, origen, custodia ni propiedad; las acciones dependen de policy.`,
    };
  }

  if (result === "VALID_OPENED" || result === "VALID_OPENED_PREVIOUSLY" || ttRaw === "4F4F" || ttRaw === "4F43") {
    return {
      tone: "warning",
      title: "Tap valido: sello abierto",
      detail: `UID ${uid || "decodificado"} con TTStatus ${ttRaw || result}. Ajustar garantia, reclamo y narrativa de apertura.`,
    };
  }

  if (ok === false && !uid) {
    return {
      tone: "danger",
      title: "Falla antes del manifest",
      detail: `El batch puede existir, pero no se decodifico UID. Revisar K_META, K_FILE/CMAC o layout SUN. Motivo: ${reason || "sin motivo estructurado"}.`,
    };
  }

  if (uidDecoded === false || cmac === false) {
    return {
      tone: "danger",
      title: "SUN crypto/layout no coincide",
      detail: `No busques primero el manifest. Primero hay que alinear keys, CMAC y ChangeFileSet. Motivo: ${reason || "sin motivo estructurado"}.`,
    };
  }

  if (result === "NOT_REGISTERED") {
    return {
      tone: "danger",
      title: "UID decodificado pero no registrado",
      detail: `Ahora si corresponde revisar manifest/importacion. UID: ${uid || "no informado"}.`,
    };
  }

  if (ok === true || result.startsWith("VALID")) {
    return {
      tone: "success",
      title: "Lectura valida",
      detail: `Resultado ${result || "OK"}. ${ttRaw ? `TTStatus ${ttRaw}.` : "Estado de apertura no informado por el lote."}`,
    };
  }

  return {
    tone: "neutral",
    title: result || "Respuesta recibida",
    detail: reason || "Revisa el JSON tecnico para decidir si es crypto, manifest, replay o estado fisico.",
  };
}

export function BatchSunValidator({ bid, defaultBid = "DEMO-2026-02", canRepair = false }: BatchSunValidatorProps) {
  const initialBid = bid || defaultBid;
  const [batchId, setBatchId] = useState(initialBid);
  const [sunUrl, setSunUrl] = useState("");
  const [pending, setPending] = useState<RunMode | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<RunMode>("validate");

  const summary = useMemo(() => summarizePayload(result, lastMode), [lastMode, result]);
  const cleanBid = batchId.trim();
  const cleanUrl = sunUrl.trim();

  async function runRequest(mode: RunMode) {
    setError(null);
    setPending(mode);
    setLastMode(mode);

    try {
      let response: Response;

      if (mode === "repair") {
        if (!cleanBid) throw new Error("Ingresa un batch_id antes de aplicar TTStatus.");
        response = await fetch(`/api/admin/batches/${encodeURIComponent(cleanBid)}/ttstatus-config`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
      } else {
        if (!cleanUrl) throw new Error("Pega una URL /sun recien escaneada desde una tag fisica.");
        response = await fetch(mode === "debug" ? "/api/admin/sun/debug-verify" : "/api/admin/sun/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url: cleanUrl }),
        });
      }

      const payload = await response.json().catch(() => ({ ok: false, message: "Respuesta no JSON" }));
      setResult(payload);

      if (!response.ok) {
        const message = isRecord(payload) ? stringAt(payload, "error") || stringAt(payload, "message") : "";
        throw new Error(message || `La API respondio ${response.status}.`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo ejecutar la accion.");
    } finally {
      setPending(null);
    }
  }

  const toneClass =
    summary.tone === "success"
      ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100"
      : summary.tone === "warning"
        ? "border-amber-300/35 bg-amber-300/10 text-amber-50"
        : summary.tone === "danger"
          ? "border-rose-400/35 bg-rose-400/10 text-rose-50"
          : "border-cyan-300/25 bg-cyan-300/10 text-cyan-50";

  return (
    <section className="rounded-3xl border border-cyan-300/15 bg-slate-950/65 p-6 shadow-2xl shadow-cyan-950/20">
      <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">Operacion de lotes</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-white">SUN, TTStatus y recepcion de batches</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Usa esto antes de romper mas etiquetas: primero alinear el perfil del batch, despues validar una URL recien
              escaneada y finalmente diagnosticar si falla antes del manifest.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4">
            <label className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-200" htmlFor="batch-id">
              Batch operativo
            </label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="batch-id"
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                className="min-h-11 flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 text-sm font-bold text-white outline-none transition focus:border-cyan-300"
                placeholder="DEMO-2026-02"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => runRequest("repair")}
                disabled={!canRepair || pending !== null || !cleanBid}
                title={canRepair ? "Aplicar perfil TTStatus seguro al batch" : "Solo SuperAdmin puede reparar batch config"}
              >
                {pending === "repair" ? "Aplicando..." : "Aplicar TTStatus"}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Este boton no toca keys ni manifest. Solo deja el batch preparado para leer TTStatus 424 TT desde
              enc_decrypted.
            </p>
          </div>

          <div className={`rounded-2xl border p-4 ${toneClass}`}>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] opacity-80">Lectura ejecutiva</p>
            <h3 className="mt-2 text-xl font-black">{summary.title}</h3>
            <p className="mt-2 text-sm leading-6 opacity-90">{summary.detail}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-cyan-200" htmlFor="sun-url">
              URL /sun recien escaneada
            </label>
            <textarea
              id="sun-url"
              value={sunUrl}
              onChange={(event) => setSunUrl(event.target.value)}
              className="mt-3 min-h-32 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
              placeholder="Pega aca la URL completa que genero el tap fisico: https://api.nexid.lat/sun?v=1&bid=..."
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" onClick={() => runRequest("validate")} disabled={pending !== null || !cleanUrl}>
              {pending === "validate" ? "Validando..." : "Validar decision"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => runRequest("debug")}
              disabled={pending !== null || !cleanUrl}
            >
              {pending === "debug" ? "Diagnosticando..." : "Debug SUN"}
            </Button>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/35 bg-rose-400/10 p-4 text-sm font-bold text-rose-50">
              {error}
            </div>
          ) : null}

          <pre className="max-h-96 overflow-auto rounded-2xl border border-slate-800 bg-black/45 p-4 text-xs leading-5 text-slate-300">
            {result ? JSON.stringify(result, null, 2) : "Todavia no hay resultado. Ejecuta validar o debug con una URL real."}
          </pre>
        </div>
      </div>
    </section>
  );
}
