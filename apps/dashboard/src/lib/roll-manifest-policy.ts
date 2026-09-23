export const ROLL_MANIFEST_MAX_BYTES = 1024 * 1024;
export const ROLL_VALIDATION_TTL_MS = 5 * 60 * 1000;
export function inspectRollManifest(csv: string): string | null {
  if (!csv.trim()) return "Seleccioná un archivo CSV/TXT recibido del proveedor.";
  if (new TextEncoder().encode(csv).byteLength > ROLL_MANIFEST_MAX_BYTES) return "El archivo supera 1 MiB. Dividí el envío en rollos o usá el flujo industrial autorizado.";
  if (/[\u0000\uFFFD]/.test(csv)) return "El archivo no tiene texto UTF-8 válido. Pedí al proveedor que lo exporte nuevamente como CSV UTF-8.";
  const headers = csv.replace(/^\uFEFF/, "").split(/\r?\n/,1)[0].split(/[,;\t]/).map(h => h.trim().replace(/^\"|\"$/g, "").toLowerCase().replace(/[\s-]+/g, "_"));
  const secret = /^(?:k_?meta(?:_?hex)?|k_?file(?:_?hex)?|key_?(?:meta|file)|meta_?key(?:_?(?:hex|ct))?|file_?key(?:_?(?:hex|ct))?|master_?key|root_?key|private_?key|secret(?:_?key)?|client_?secret|access_?token|refresh_?token|bearer_?token|auth_?token|encryption_?key|decryption_?key|api_?key|password|passphrase|mnemonic(?:_?phrase)?|seed_?phrase|(?:wallet|signing|recovery|secret)_?seed)$/i;
  if (headers.some(h => secret.test(h)) || /-----BEGIN .*PRIVATE KEY-----/.test(csv)) return "El manifiesto contiene columnas o material de claves. No lo subas: solicitá un manifiesto de unidades sin secretos.";
  return null;
}
export type RollReceipt = { batch: string; rows: number; inserted: number; dryRun: boolean };
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const whole = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
export function rollReceipt(payload: unknown, bid: string, dryRun: boolean): RollReceipt | null {
  const p = record(payload);
  if (!p || p.ok !== true || p.batch !== bid || p.activated !== false || p.demo === true || p.demoMode === true || p.dataSource === "demo") return null;
  if (dryRun ? p.dryRun !== true : p.dryRun !== undefined && p.dryRun !== false) return null;
  if (!whole(p.importedRows) || p.importedRows === 0 || !whole(p.inserted) || p.inserted > p.importedRows) return null;
  if (!Array.isArray(p.duplicateUids) || p.duplicateUids.length) return null;
  if (p.reactivated !== undefined && p.reactivated !== 0 || p.ignored !== undefined && p.ignored !== 0) return null;
  if (p.supplier_gate !== undefined && p.supplier_gate !== null) {
    const gate = record(p.supplier_gate);
    if (!gate || gate.quantity_override || !whole(gate.expected_quantity) || gate.expected_quantity !== p.importedRows || gate.manifest_status !== (dryRun ? "would_import" : "imported")) return null;
  }
  return { batch: bid, rows: p.importedRows, inserted: p.inserted, dryRun };
}
export function rollValidationCurrent(currentCsv: string, checkedCsv: string, checkedAt: number, now: number) {
  return Boolean(currentCsv && currentCsv === checkedCsv && Number.isFinite(checkedAt) && Number.isFinite(now) && now >= checkedAt && now-checkedAt <= ROLL_VALIDATION_TTL_MS);
}
