export const ROLL_MANIFEST_MAX_BYTES = 1024 * 1024;
export const ROLL_VALIDATION_TTL_MS = 5 * 60 * 1000;
export function inspectRollManifest(csv: string): string | null {
  if (!csv.trim()) return "Seleccioná un archivo CSV/TXT recibido del proveedor.";
  if (new TextEncoder().encode(csv).byteLength > ROLL_MANIFEST_MAX_BYTES) return "El archivo supera 1 MiB. Dividí el envío en rollos o usá el flujo industrial autorizado.";
  const headers = csv.replace(/^\uFEFF/, "").split(/\r?\n/,1)[0].split(/[,;\t]/).map(h => h.trim().replace(/^\"|\"$/g, "").toLowerCase().replace(/[\s-]+/g, "_"));
  const secret = /^(?:k_?meta(?:_?hex)?|k_?file(?:_?hex)?|key_?(?:meta|file)|meta_?key(?:_?(?:hex|ct))?|file_?key(?:_?(?:hex|ct))?|master_?key|root_?key|private_?key|secret(?:_?key)?|client_?secret|access_?token|refresh_?token|bearer_?token|auth_?token|encryption_?key|decryption_?key|api_?key|password|passphrase|mnemonic(?:_?phrase)?|seed_?phrase|(?:wallet|signing|recovery|secret)_?seed)$/i;
  if (headers.some(h => secret.test(h)) || /-----BEGIN .*PRIVATE KEY-----/.test(csv)) return "El manifiesto contiene columnas o material de claves. No lo subas: solicitá un manifiesto de unidades sin secretos.";
  return null;
}
export type RollReceipt = { batch: string; rows: number; inserted: number; dryRun: boolean };
export function rollReceipt(payload: unknown, bid: string, dryRun: boolean): RollReceipt | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.ok !== true || p.batch !== bid || p.activated !== false || (dryRun ? p.dryRun !== true : p.dryRun === true)) return null;
  if (!Number.isInteger(p.importedRows) || Number(p.importedRows) <= 0 || !Number.isInteger(p.inserted) || Number(p.inserted) < 0 || Number(p.inserted) > Number(p.importedRows)) return null;
  if (!Array.isArray(p.duplicateUids) || p.duplicateUids.length) return null;
  const gate = p.supplier_gate as Record<string, unknown> | null;
  if (gate?.quantity_override || (dryRun && gate?.manifest_status === "already_imported")) return null;
  return { batch: bid, rows: Number(p.importedRows), inserted: Number(p.inserted), dryRun };
}
export function rollValidationCurrent(currentCsv: string, checkedCsv: string, checkedAt: number, now: number) {
  return Boolean(currentCsv && currentCsv === checkedCsv && now >= checkedAt && now-checkedAt <= ROLL_VALIDATION_TTL_MS);
}
