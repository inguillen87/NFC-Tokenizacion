import { inspectRollManifest, rollReceipt, type RollReceipt } from "./roll-manifest-policy";
export const ROLL_RESPONSE_MAX_BYTES = 256 * 1024;
export class RollManifestError extends Error {
  constructor(readonly code: "rejected" | "invalid_receipt" | "unavailable", readonly status = 0, readonly uncertain = false) { super(code); }
}
async function readPayload(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > ROLL_RESPONSE_MAX_BYTES) { await response.body?.cancel(); return null; }
  if (!response.body) return null;
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > ROLL_RESPONSE_MAX_BYTES) { await reader.cancel(); return null; }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of chunks) { bytes.set(part,offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)); } catch { return null; }
}
export async function rollManifestCall(input: { bid: string; csv: string; dryRun: boolean; activateImported: false; signal?: AbortSignal }, fetcher: typeof fetch = fetch): Promise<RollReceipt> {
  if (!input.bid.trim() || input.bid.length > 128 || inspectRollManifest(input.csv) || input.activateImported !== false) throw new RollManifestError("rejected");
  const controller = new AbortController(), abort = () => controller.abort();
  if (input.signal?.aborted) abort(); else input.signal?.addEventListener("abort",abort,{once:true});
  const timer = setTimeout(abort,45_000);
  try {
    const response = await fetcher(`/api/admin/batches/${encodeURIComponent(input.bid)}/import-manifest`, {
      method:"POST", credentials:"same-origin", cache:"no-store", signal:controller.signal,
      headers:{"content-type":"application/json", Accept:"application/json"},
      body:JSON.stringify({csv:input.csv,dryRun:input.dryRun,activateImported:false}),
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      const negative = payload !== null && typeof payload === "object" && !Array.isArray(payload) && "ok" in payload && payload.ok === false;
      const rejected = negative && [400,401,403,404,409,413,422,429].includes(response.status);
      throw new RollManifestError(rejected ? "rejected" : "unavailable",response.status,!input.dryRun && !rejected);
    }
    const mode = response.headers.get("x-nexid-data-mode");
    const receipt = mode && mode !== "production" ? null : rollReceipt(payload,input.bid,input.dryRun);
    if (!receipt) throw new RollManifestError("invalid_receipt",response.status,!input.dryRun);
    return receipt;
  } catch (issue) {
    if (issue instanceof RollManifestError) throw issue;
    throw new RollManifestError("unavailable",0,!input.dryRun);
  } finally { clearTimeout(timer); input.signal?.removeEventListener("abort",abort); }
}
export function rollManifestErrorCopy(issue: RollManifestError): string {
  if (issue.uncertain) return "Resultado sin confirmar. La importación pudo haberse guardado. No reenvíes el archivo: consultá el estado del lote antes de continuar.";
  if ([401,403].includes(issue.status)) return "Tu sesión ya no autoriza esta operación. Volvé a consultar el lote con un acceso vigente.";
  if (issue.status === 409) return "El lote cambió o el archivo entra en conflicto con unidades registradas. Consultá el estado actual antes de volver a validar.";
  if (issue.code === "rejected") return "El servidor no aprobó el archivo. Revisá el BID, las unidades, duplicados y cantidad con el proveedor. No se confirmó una importación.";
  if (issue.code === "invalid_receipt") return "No llegó un comprobante coherente con este lote y esta operación. No se habilita la importación.";
  return "No se pudo confirmar la validación. Conservamos el archivo en esta pestaña; podés validarlo nuevamente.";
}