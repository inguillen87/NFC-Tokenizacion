"use client";

import { useState } from "react";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import type { TenantVaultArtifact } from "../lib/tenant-vault-contract";

function idempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `vault-download:${crypto.randomUUID()}`;
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return `vault-download:${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
  }
  return "";
}

function safeFilename(value: string | null, artifactId: string | null) {
  const match = /filename="([^"\r\n]{1,180})"/i.exec(value || "");
  const candidate = String(match?.[1] || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 160);
  return candidate || `nexid-supplier-pack-${String(artifactId || "encrypted").slice(0, 16)}.enc`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function TenantVaultDownloadControl({ artifact }: { artifact: TenantVaultArtifact }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  if (!artifact.download.available || !artifact.download.href) return null;

  async function download() {
    const normalizedReason = reason.replace(/\s+/g, " ").trim();
    if (normalizedReason.length < 12 || normalizedReason.length > 240) {
      setStatus({ tone: "error", message: "Indicá un motivo operativo de 12 a 240 caracteres." });
      return;
    }
    const requestKey = idempotencyKey();
    if (!requestKey) {
      setStatus({ tone: "error", message: "El navegador no pudo generar el identificador seguro de la solicitud." });
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api${artifact.download.href}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": requestKey,
        },
        body: JSON.stringify({ reason: normalizedReason }),
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { reason?: string } | null;
        throw new Error(payload?.reason || `download_failed_${response.status}`);
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("download_empty");
      triggerDownload(blob, safeFilename(response.headers.get("content-disposition"), artifact.id));
      const receipt = response.headers.get("x-nexid-audit-receipt") || "recibo no proyectado";
      const count = response.headers.get("x-nexid-download-count") || "—";
      setStatus({
        tone: "ok",
        message: `Pack cifrado descargado. Solicitud auditada · #${count} · ${receipt.slice(0, 24)}…`,
      });
    } catch (error) {
      const reasonCode = error instanceof Error ? error.message : "download_failed";
      setStatus({ tone: "error", message: `No se descargó ningún pack: ${reasonCode}.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/5 p-3" data-testid="tenant-vault-download-control">
      <label className="block text-xs font-semibold text-emerald-100" htmlFor={`vault-reason-${artifact.id}`}>
        Motivo obligatorio de la entrega privilegiada
      </label>
      <input
        id={`vault-reason-${artifact.id}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={240}
        placeholder="Ej.: recuperación de entrega cifrada aprobada para fábrica"
        className="mt-2 min-h-11 w-full rounded-lg border border-white/15 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/60"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || reason.trim().length < 12}
          onClick={download}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? "Auditando…" : "Descargar pack cifrado"}
        </button>
        <span className="text-xs text-slate-400">Descargas registradas: {artifact.download.count}</span>
      </div>
      {status ? (
        <p className={`mt-3 flex items-start gap-2 text-xs ${status.tone === "ok" ? "text-emerald-100" : "text-rose-100"}`} role="status">
          {status.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
