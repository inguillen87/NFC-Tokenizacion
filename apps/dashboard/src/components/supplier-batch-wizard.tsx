"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Card } from "@product/ui";
import { productUrls } from "@product/config";
import { DEMO_SUPPLIER_BATCH_ID, DEMO_SUPPLIER_UIDS } from "../lib/demo-uids";

type AppLocale = "es-AR" | "pt-BR" | "en";
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;
type BatchMode = "supplier" | "internal";
type ManifestMode = "paste" | "file";
type Vertical = "wine" | "events" | "cosmetics" | "agro" | "pharma" | "luxury";
type TokenizationMode = "valid_only" | "valid_and_opened" | "manual";
type ClaimPolicy = "purchase_proof_required" | "retailer_attested" | "inside_pack_secret" | "admin_approved";

type BatchSummary = {
  bid: string;
  status: string;
  tenant_slug: string;
  chip_model: string | null;
  sku: string | null;
  requested_quantity: number;
  imported_tags: number;
  active_tags: number;
  inactive_tags: number;
  has_meta_key: boolean;
  has_file_key: boolean;
};

type ManifestRow = {
  uidHex: string;
  batchId: string;
  productName: string;
  sku: string;
  lot: string;
  serial: string;
  expiresAt: string;
};

type ManifestIssue = {
  row: number;
  reason: string;
  value?: string;
};

const verticalOptions: Array<{ value: Vertical; label: string; hint: string }> = [
  { value: "wine", label: "Vino", hint: "Botellas, sellos, cajas premium" },
  { value: "events", label: "Eventos", hint: "Pulseras, tickets, credenciales" },
  { value: "cosmetics", label: "Cosmetica", hint: "Perfumes, skincare, lujo" },
  { value: "agro", label: "Agro", hint: "Semillas, lotes, insumos" },
  { value: "pharma", label: "Pharma", hint: "Trazabilidad regulada" },
  { value: "luxury", label: "Luxury", hint: "Activos de alto valor" },
];

const claimPolicies: Array<{ value: ClaimPolicy; label: string; hint: string }> = [
  { value: "purchase_proof_required", label: "Compra verificada", hint: "Factura, ticket, order id o comprobante antes de ownership." },
  { value: "retailer_attested", label: "Retailer attested", hint: "El comercio valida la venta y habilita el claim." },
  { value: "inside_pack_secret", label: "Codigo interno", hint: "El cliente abre el producto y usa un codigo dentro del pack." },
  { value: "admin_approved", label: "Aprobacion admin", hint: "El tenant aprueba manualmente claims sensibles." },
];

function normalizeHex(value: string) {
  return value.trim().toUpperCase();
}

function isHex32(value: string) {
  return /^[0-9A-F]{32}$/.test(normalizeHex(value));
}

function normalizeUid(value: string) {
  return value.trim().toUpperCase();
}

function splitCsvLine(line: string) {
  const columns: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if ((char === "," || char === ";") && !inQuotes) {
      columns.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  columns.push(current.trim());
  return columns;
}

function getColumn(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = row[name.toLowerCase()];
    if (value) return value.trim();
  }
  return "";
}

function parseManifestInput(raw: string, expectedBid: string, productLabel: string, fallbackSku: string) {
  const content = raw.replace(/^\uFEFF/, "").trim();
  const issues: ManifestIssue[] = [];
  if (!content) return { rows: [] as ManifestRow[], issues, type: "txt" as "txt" | "csv" };

  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] || "";
  const looksCsv = firstLine.includes(",") || firstLine.includes(";");
  const uidRe = /^[0-9A-F]{8,32}$/;
  const seen = new Set<string>();
  const rows: ManifestRow[] = [];

  if (looksCsv) {
    const header = splitCsvLine(firstLine).map((column) => column.toLowerCase().trim());
    const uidIndex = header.findIndex((column) => ["uid_hex", "uid", "uidhex"].includes(column));
    if (uidIndex < 0) {
      return { rows, issues: [{ row: 1, reason: "uid_hex column required" }], type: "csv" as const };
    }

    for (let index = 1; index < lines.length; index += 1) {
      const cells = splitCsvLine(lines[index]);
      const record = Object.fromEntries(header.map((key, cellIndex) => [key, cells[cellIndex] || ""]));
      const uidHex = normalizeUid(cells[uidIndex] || "");
      const batchId = getColumn(record, ["batch_id", "bid", "batchid"]);
      const rowNumber = index + 1;
      if (!uidRe.test(uidHex)) {
        issues.push({ row: rowNumber, reason: "invalid_uid_hex", value: uidHex });
        continue;
      }
      if (batchId && expectedBid && batchId !== expectedBid) {
        issues.push({ row: rowNumber, reason: "batch_id_mismatch", value: batchId });
        continue;
      }
      if (seen.has(uidHex)) {
        issues.push({ row: rowNumber, reason: "duplicate_uid", value: uidHex });
        continue;
      }
      seen.add(uidHex);
      const productName = getColumn(record, ["product_name", "productname", "name"]) || productLabel.trim();
      const sku = getColumn(record, ["sku"]) || fallbackSku.trim();
      if (!productName && !sku) {
        issues.push({ row: rowNumber, reason: "product_name_or_sku_required", value: uidHex });
        continue;
      }
      rows.push({
        uidHex,
        batchId: batchId || expectedBid,
        productName,
        sku,
        lot: getColumn(record, ["lot", "lote", "lot_id"]),
        serial: getColumn(record, ["serial", "serial_number"]),
        expiresAt: getColumn(record, ["expires_at", "expiry", "expiration"]),
      });
    }
    return { rows, issues, type: "csv" as const };
  }

  const tokens = content
    .split(/[\r\n,;\t ]+/)
    .map((token) => normalizeUid(token))
    .filter((token) => token && !["UID", "UID_HEX"].includes(token));

  tokens.forEach((uidHex, index) => {
    const rowNumber = index + 1;
    if (!uidRe.test(uidHex)) {
      issues.push({ row: rowNumber, reason: "invalid_uid_hex", value: uidHex });
      return;
    }
    if (seen.has(uidHex)) {
      issues.push({ row: rowNumber, reason: "duplicate_uid", value: uidHex });
      return;
    }
    seen.add(uidHex);
    rows.push({
      uidHex,
      batchId: expectedBid,
      productName: productLabel.trim(),
      sku: fallbackSku.trim(),
      lot: "",
      serial: "",
      expiresAt: "",
    });
  });

  if (rows.some((row) => !row.productName && !row.sku)) {
    issues.push({ row: 0, reason: "product_identity_required_for_txt", value: "Set product label or SKU before importing TXT." });
  }

  return { rows, issues, type: "txt" as const };
}

function manifestRowsToCsv(rows: ManifestRow[]) {
  const escape = (value: string) => {
    if (!value.includes(",") && !value.includes("\"") && !value.includes("\n")) return value;
    return `"${value.replace(/"/g, "\"\"")}"`;
  };
  const header = "batch_id,uid_hex,product_name,sku,lot,serial,expires_at";
  const body = rows.map((row) => [
    row.batchId,
    row.uidHex,
    row.productName,
    row.sku,
    row.lot,
    row.serial,
    row.expiresAt,
  ].map(escape).join(","));
  return `${[header, ...body].join("\n")}\n`;
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function buildOwnershipPolicy(claimPolicy: ClaimPolicy, requireFreshTap: boolean, requireAntiReplay: boolean) {
  return {
    claim_policy: claimPolicy,
    require_purchase_proof: claimPolicy === "purchase_proof_required",
    require_retailer_attestation: claimPolicy === "retailer_attested",
    require_inside_pack_secret: claimPolicy === "inside_pack_secret",
    require_admin_approval: claimPolicy === "admin_approved",
    require_fresh_tap: requireFreshTap,
    require_tenant_membership: true,
    require_anti_replay_clear: requireAntiReplay,
    public_claim_enabled: false,
  };
}

function buildManifestPolicy() {
  return {
    accepted_formats: ["csv", "txt"],
    required_columns_csv: ["uid_hex"],
    recommended_columns_csv: ["batch_id", "product_name", "sku", "lot", "serial", "expires_at"],
    txt_requires_product_identity_from_wizard: true,
    reject_duplicates: true,
    reject_batch_mismatch: true,
    audit_manifest_hash: true,
  };
}

function generatePassword() {
  const base = Math.random().toString(36).slice(-6);
  return `NexID!${base}A1`;
}

export function SupplierBatchWizard({ locale }: { locale: AppLocale }) {
  const copy = locale === "en"
    ? {
        title: "Real tenant and supplier batch onboarding",
        subtitle: "Create a tenant passport, register supplier keys, validate a manifest and activate tags without hidden defaults.",
        quickAction: "Provision checked intake",
      }
    : locale === "pt-BR"
      ? {
          title: "Onboarding real de tenant e lote fornecedor",
          subtitle: "Crie o passaporte do tenant, registre chaves, valide manifesto e ative tags sem defaults ocultos.",
          quickAction: "Provisionar intake validado",
        }
      : {
          title: "Onboarding real de tenant y batch proveedor",
          subtitle: "Crea el pasaporte del tenant, registra llaves, valida manifiesto y activa tags sin defaults ocultos.",
          quickAction: "Provisionar intake validado",
        };

  const [activeStep, setActiveStep] = useState<WizardStep>(1);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("Arranca con un tenant vacio o carga el piloto demobodega de forma explicita.");
  const [responseText, setResponseText] = useState("{}");

  const [tenantSlug, setTenantSlug] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [clubName, setClubName] = useState("");
  const [productLabel, setProductLabel] = useState("");
  const [originLabel, setOriginLabel] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [originLat, setOriginLat] = useState("");
  const [originLng, setOriginLng] = useState("");
  const [tokenizationMode, setTokenizationMode] = useState<TokenizationMode>("valid_and_opened");
  const [claimPolicy, setClaimPolicy] = useState<ClaimPolicy>("purchase_proof_required");
  const [requireFreshTap, setRequireFreshTap] = useState(true);
  const [requireAntiReplay, setRequireAntiReplay] = useState(true);

  const [batchMode, setBatchMode] = useState<BatchMode>("supplier");
  const [bid, setBid] = useState("");
  const [chipModel, setChipModel] = useState("");
  const [securityProfile, setSecurityProfile] = useState("");
  const [sku, setSku] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [kMeta, setKMeta] = useState("");
  const [kFile, setKFile] = useState("");

  const [manifestMode, setManifestMode] = useState<ManifestMode>("paste");
  const [manifestText, setManifestText] = useState("");
  const [manifestFileName, setManifestFileName] = useState("");
  const [manifestActivated, setManifestActivated] = useState(true);

  const [adminEnabled, setAdminEnabled] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [tenantReady, setTenantReady] = useState(false);
  const [batchReady, setBatchReady] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [supplierUrl, setSupplierUrl] = useState("");
  const [validationCode, setValidationCode] = useState("PENDING");
  const [validationDetail, setValidationDetail] = useState("Pega una URL SUN real del proveedor o de una tag fisica.");
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);

  const manifest = useMemo(
    () => parseManifestInput(manifestText, bid.trim(), productLabel.trim(), sku.trim()),
    [manifestText, bid, productLabel, sku],
  );

  const uniqueUidCount = manifest.rows.length;
  const firstUid = manifest.rows[0]?.uidHex || "";
  const keysReady = batchMode === "internal" || (isHex32(kMeta) && isHex32(kFile));
  const tenantProfileReady = Boolean(
    tenantSlug.trim()
    && tenantName.trim()
    && clubName.trim()
    && productLabel.trim()
    && originLabel.trim()
    && originAddress.trim()
    && Number.isFinite(Number(originLat))
    && Number.isFinite(Number(originLng)),
  );
  const batchIdentityReady = Boolean(bid.trim() && chipModel.trim() && securityProfile.trim() && sku.trim());
  const manifestReady = manifest.rows.length > 0 && manifest.issues.length === 0;
  const provisionReady = tenantProfileReady && batchIdentityReady && keysReady && manifestReady;

  const steps = [
    "Tenant passport",
    "Batch security",
    "Manifest intake",
    "Provision",
    "SUN pretest",
    "Handoff",
  ];
  const stepReady = {
    1: tenantProfileReady,
    2: batchIdentityReady && keysReady,
    3: manifestReady,
    4: tenantReady && batchReady && importedCount > 0 && (manifestActivated ? activeCount > 0 : true),
    5: validationCode !== "PENDING",
    6: Boolean(batchSummary),
  } as const;
  const progress = Math.round(((activeStep - 1) / (steps.length - 1)) * 100);
  const manifestCsvForServer = useMemo(() => manifestRowsToCsv(manifest.rows), [manifest.rows]);
  const expectedNdefTemplate = `${productUrls.api}/sun?v=1&bid=${encodeURIComponent(bid || "<BID>")}&picc_data=<dynamic>&enc=<dynamic>&cmac=<dynamic>`;
  const nextAction = !stepReady[1]
    ? "Completa identidad, origen y politica de ownership del tenant."
    : !stepReady[2]
      ? "Carga BID, perfil, SKU, chip y llaves de proveedor."
      : !stepReady[3]
        ? "Pega TXT/CSV o sube archivo y corrige conflictos antes de importar."
        : !stepReady[4]
          ? "Ejecuta Provision: tenant, batch, manifest y activacion."
          : !stepReady[5]
            ? "Valida una URL SUN real para confirmar keys y estado."
            : "Carga resumen y entrega el acceso operativo al tenant/reseller.";

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("supplier_wizard_pro_v2");
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Record<string, string | boolean | number>>;
      if (typeof draft.tenantSlug === "string") setTenantSlug(draft.tenantSlug);
      if (typeof draft.tenantName === "string") setTenantName(draft.tenantName);
      if (typeof draft.vertical === "string" && verticalOptions.some((option) => option.value === draft.vertical)) setVertical(draft.vertical as Vertical);
      if (typeof draft.clubName === "string") setClubName(draft.clubName);
      if (typeof draft.productLabel === "string") setProductLabel(draft.productLabel);
      if (typeof draft.originLabel === "string") setOriginLabel(draft.originLabel);
      if (typeof draft.originAddress === "string") setOriginAddress(draft.originAddress);
      if (typeof draft.originLat === "string") setOriginLat(draft.originLat);
      if (typeof draft.originLng === "string") setOriginLng(draft.originLng);
      if (typeof draft.bid === "string") setBid(draft.bid);
      if (typeof draft.chipModel === "string") setChipModel(draft.chipModel);
      if (typeof draft.securityProfile === "string") setSecurityProfile(draft.securityProfile);
      if (typeof draft.sku === "string") setSku(draft.sku);
      if (typeof draft.quantity === "string") setQuantity(draft.quantity);
      if (typeof draft.notes === "string") setNotes(draft.notes);
      if (typeof draft.manifestText === "string") setManifestText(draft.manifestText);
      if (typeof draft.supplierUrl === "string") setSupplierUrl(draft.supplierUrl);
      if (typeof draft.adminEmail === "string") setAdminEmail(draft.adminEmail);
      if (typeof draft.adminName === "string") setAdminName(draft.adminName);
    } catch {
      // Ignore local draft corruption; server remains source of truth.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem("supplier_wizard_pro_v2", JSON.stringify({
        tenantSlug,
        tenantName,
        vertical,
        clubName,
        productLabel,
        originLabel,
        originAddress,
        originLat,
        originLng,
        bid,
        chipModel,
        securityProfile,
        sku,
        quantity,
        notes,
        manifestText,
        supplierUrl,
        adminEmail,
        adminName,
      }));
    } catch {
      // Ignore storage write failures.
    }
  }, [tenantSlug, tenantName, vertical, clubName, productLabel, originLabel, originAddress, originLat, originLng, bid, chipModel, securityProfile, sku, quantity, notes, manifestText, supplierUrl, adminEmail, adminName]);

  async function run(path: string, init?: RequestInit) {
    const response = await fetch(path, {
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      ...init,
    });
    const data = await parseJsonSafe(response);
    setResponseText(JSON.stringify(data, null, 2));
    if (!response.ok || (data && typeof data === "object" && "ok" in data && (data as { ok?: unknown }).ok === false)) {
      const reason = typeof data === "object" && data && "reason" in data
        ? String((data as { reason?: unknown }).reason || response.statusText)
        : response.statusText;
      const missing = typeof data === "object" && data && "missing" in data
        ? ` (${((data as { missing?: unknown }).missing as string[] | undefined)?.join(", ") || ""})`
        : "";
      throw new Error(`${reason}${missing}`);
    }
    return data as Record<string, unknown>;
  }

  function applyDemobodegaPilot() {
    setTenantSlug("demobodega");
    setTenantName("Demo Bodega");
    setVertical("wine");
    setClubName("Club Gran Reserva");
    setProductLabel("Gran Reserva Malbec");
    setOriginLabel("Valle de Uco, Argentina");
    setOriginAddress("Valle de Uco, Mendoza, Argentina");
    setOriginLat("-33.597");
    setOriginLng("-69.118");
    setTokenizationMode("valid_and_opened");
    setClaimPolicy("purchase_proof_required");
    setRequireFreshTap(true);
    setRequireAntiReplay(true);
    setBatchMode("supplier");
    setBid(DEMO_SUPPLIER_BATCH_ID);
    setChipModel("NTAG 424 DNA TagTamper");
    setSecurityProfile("NTAG424_DNA_TT_WINE");
    setSku("wine-secure");
    setQuantity(String(DEMO_SUPPLIER_UIDS.length));
    setNotes("Piloto fisico demobodega: proveedor China, tags NTAG 424 DNA TT, manifest auditado.");
    setKMeta("c2a462e6ab434828153d73ce440704ac");
    setKFile("bfce6c576540c04c840f1cfd457bf213");
    setManifestText(manifestRowsToCsv(DEMO_SUPPLIER_UIDS.map((uid, index) => ({
      uidHex: uid,
      batchId: DEMO_SUPPLIER_BATCH_ID,
      productName: "Gran Reserva Malbec",
      sku: "wine-secure",
      lot: "MZA-2026-0424",
      serial: `DEMO-${String(index + 1).padStart(3, "0")}`,
      expiresAt: "",
    }))));
    setManifestFileName("demobodega-pilot-manifest.csv");
    setAdminEnabled(false);
    setStatus("Piloto demobodega cargado de forma explicita. Revisalo y ejecuta provision si corresponde.");
  }

  function resetRealIntake() {
    setTenantSlug("");
    setTenantName("");
    setClubName("");
    setProductLabel("");
    setOriginLabel("");
    setOriginAddress("");
    setOriginLat("");
    setOriginLng("");
    setBid("");
    setChipModel("");
    setSecurityProfile("");
    setSku("");
    setQuantity("");
    setNotes("");
    setKMeta("");
    setKFile("");
    setManifestText("");
    setManifestFileName("");
    setTenantReady(false);
    setBatchReady(false);
    setImportedCount(0);
    setActiveCount(0);
    setBatchSummary(null);
    setResponseText("{}");
    setStatus("Nuevo intake limpio. No hay datos demo ni defaults escondidos.");
  }

  async function onManifestFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    setManifestMode("file");
    setManifestFileName(file.name);
    setManifestText(raw);
    setStatus(`Archivo cargado: ${file.name}. Revisar preview antes de importar.`);
  }

  function downloadCsvTemplate() {
    downloadText(
      `${bid.trim() || "batch"}-manifest-template.csv`,
      "batch_id,uid_hex,product_name,sku,lot,serial,expires_at\n",
      "text/csv;charset=utf-8",
    );
  }

  function downloadTxtTemplate() {
    downloadText(`${bid.trim() || "batch"}-uids-template.txt`, "uid_hex\n");
  }

  async function createTenantIfMissing() {
    if (!tenantProfileReady) throw new Error("Tenant profile incompleto.");
    const data = await run("/api/admin/tenants", {
      method: "POST",
      body: JSON.stringify({
        slug: tenantSlug.trim().toLowerCase(),
        name: tenantName.trim(),
        vertical,
        club_name: clubName.trim(),
        product_label: productLabel.trim(),
        origin_label: originLabel.trim(),
        origin_address: originAddress.trim(),
        origin_lat: Number(originLat),
        origin_lng: Number(originLng),
        tokenization_mode: tokenizationMode,
        claim_policy: claimPolicy,
        ownership_policy: buildOwnershipPolicy(claimPolicy, requireFreshTap, requireAntiReplay),
        manifest_policy: buildManifestPolicy(),
        metadata: {
          loyalty: {
            pointsName: "Puntos",
            rewards: [],
            rules: {
              validTap: 10,
              openedSealBonus: 30,
              marketplaceClick: 5,
            },
          },
        },
      }),
    });
    setTenantReady(true);
    return data;
  }

  async function registerBatch() {
    if (!batchIdentityReady) throw new Error("Completa BID, perfil, SKU y chip.");
    if (!keysReady) throw new Error("K_META y K_FILE deben ser hex de 32 caracteres para supplier mode.");
    const data = await run("/api/admin/batches/register", {
      method: "POST",
      body: JSON.stringify({
        tenant_slug: tenantSlug.trim().toLowerCase(),
        mode: batchMode,
        bid: bid.trim(),
        profile: securityProfile.trim(),
        chip_model: chipModel.trim(),
        sku: sku.trim(),
        quantity: Math.max(0, Math.trunc(Number(quantity || manifest.rows.length || 0))),
        notes: notes.trim(),
        k_meta_hex: normalizeHex(kMeta),
        k_file_hex: normalizeHex(kFile),
        sdm_config: {
          source: manifestFileName || "dashboard-manifest",
          url_template: expectedNdefTemplate,
          vertical,
          claim_policy: claimPolicy,
        },
      }),
    });
    setBatchReady(true);
    return data;
  }

  async function importManifest() {
    if (!manifestReady) throw new Error("Manifest con errores. Corregilo antes de importar.");
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/import-manifest`, {
      method: "POST",
      body: JSON.stringify({ csv: manifestCsvForServer, activateImported: manifestActivated }),
    });
    setImportedCount(Number(data.importedRows || data.inserted || manifest.rows.length));
    if (manifestActivated) setActiveCount(Number(data.importedRows || data.inserted || manifest.rows.length));
    return data;
  }

  async function activateAll() {
    if (!bid.trim()) throw new Error("Falta BID.");
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/activate-all`, {
      method: "POST",
      body: JSON.stringify({ limit: manifest.rows.length || undefined }),
    });
    setActiveCount(Number(data.activated || 0));
    return data;
  }

  async function refreshBatchSummary() {
    if (!bid.trim()) return;
    const data = await run(`/api/admin/batches/${encodeURIComponent(bid.trim())}/summary`);
    if (data.batch && typeof data.batch === "object") setBatchSummary(data.batch as BatchSummary);
  }

  async function createTenantAdmin() {
    if (!adminEnabled) return null;
    if (!adminEmail.trim() || adminPassword.length < 8) throw new Error("Admin email y password 8+ requeridos.");
    return run("/api/iam/users", {
      method: "POST",
      body: JSON.stringify({
        email: adminEmail.trim().toLowerCase(),
        fullName: adminName.trim() || "Tenant Operator",
        password: adminPassword,
        role: "tenant-admin",
        tenantSlug: tenantSlug.trim().toLowerCase(),
        permissions: ["batches:write", "events:read", "analytics:read", "users:manage"],
      }),
    });
  }

  async function runAll() {
    if (!provisionReady) {
      setStatus(nextAction);
      return;
    }
    setPending(true);
    setStatus("Provisionando intake validado...");
    try {
      await createTenantIfMissing();
      await registerBatch();
      await importManifest();
      if (!manifestActivated) await activateAll();
      if (adminEnabled) await createTenantAdmin();
      await refreshBatchSummary();
      setStatus("READY TO SCAN: tenant, perfil SUN, batch, manifest y tags activadas.");
      setActiveStep(5);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Provision failed");
    } finally {
      setPending(false);
    }
  }

  async function validateNow() {
    if (!supplierUrl.trim()) {
      setStatus("Pega una URL SUN completa.");
      return;
    }
    setPending(true);
    setStatus("Validando URL SUN...");
    try {
      const data = await run("/api/admin/sun/validate", {
        method: "POST",
        body: JSON.stringify({ url: supplierUrl.trim() }),
      });
      const reason = String(data.reason || "");
      const normalized = reason.toUpperCase();
      if (normalized.includes("REPLAY")) {
        setValidationCode("REPLAY_SUSPECT");
        setValidationDetail("Replay detectado. No habilitar ownership hasta revisar riesgo.");
      } else if (normalized.includes("VALID") || normalized.includes("OK") || normalized.includes("OPENED")) {
        setValidationCode("VALID");
        setValidationDetail("Tap valido. La tag, el batch y las llaves son consistentes.");
      } else {
        setValidationCode(normalized || "UNKNOWN");
        setValidationDetail(reason || "Respuesta no mapeada. Revisar JSON tecnico.");
      }
      setStatus("Validacion SUN completa.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "validation failed";
      setValidationCode("ERROR");
      setValidationDetail(message);
      setStatus(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6 supplier-batch-wizard">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Operacion multi-tenant real</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{copy.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={resetRealIntake}>Nuevo intake limpio</Button>
            <Button variant="secondary" onClick={applyDemobodegaPilot}>Cargar piloto demobodega</Button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-100">Fast lane con control previo</p>
              <p className="mt-1 text-xs leading-5 text-cyan-100/85">El boton final solo se habilita cuando tenant, batch, keys y manifest estan completos. Asi un reseller o empleado puede operar sin tocar consola.</p>
            </div>
            <Button disabled={pending || !provisionReady} onClick={() => void runAll()}>{pending ? "Procesando..." : copy.quickAction}</Button>
          </div>
          <p className="mt-3 rounded-xl border border-cyan-300/20 bg-slate-950/45 px-3 py-2 text-xs text-cyan-100">Siguiente accion: <b>{nextAction}</b></p>
        </div>

        <div className="mt-5 h-2 rounded-full bg-slate-800">
          <div className="h-2 rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          {steps.map((step, index) => {
            const stepNumber = (index + 1) as WizardStep;
            const ready = stepReady[stepNumber];
            return (
              <button
                suppressHydrationWarning
                key={step}
                type="button"
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${activeStep === stepNumber ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100" : ready ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900/65 text-slate-300"}`}
                onClick={() => setActiveStep(stepNumber)}
              >
                <span className="block text-[10px] uppercase tracking-[0.14em] opacity-70">Paso {stepNumber}</span>
                {step}
              </button>
            );
          })}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <Metric label="Tenant profile" value={tenantProfileReady ? "Ready" : "Missing"} tone={tenantProfileReady ? "good" : "warn"} />
          <Metric label="Keys" value={keysReady ? "Ready" : "Required"} tone={keysReady ? "good" : "warn"} />
          <Metric label="Manifest rows" value={String(uniqueUidCount)} tone={manifestReady ? "good" : "neutral"} />
          <Metric label="Issues" value={String(manifest.issues.length)} tone={manifest.issues.length ? "bad" : "good"} />
          <Metric label="Active tags" value={String(activeCount)} tone={activeCount ? "good" : "neutral"} />
        </div>
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 1 ? "" : "hidden"}`}>
        <StepHeader step="1" title="Tenant passport obligatorio" description="Cada tenant nace con rubro, origen, politicas de claim y reglas de manifiesto. Sin esto /sun queda bloqueado en setup requerido." />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tenant slug" value={tenantSlug} onChange={setTenantSlug} placeholder="bodega-los-andes" />
            <Field label="Nombre visible" value={tenantName} onChange={setTenantName} placeholder="Bodega Los Andes" />
            <Field label="Club / portal consumidor" value={clubName} onChange={setClubName} placeholder="Club Reserva Privada" />
            <Field label="Producto principal" value={productLabel} onChange={setProductLabel} placeholder="Gran Reserva Malbec" />
            <Field label="Origen corto" value={originLabel} onChange={setOriginLabel} placeholder="Valle de Uco, Argentina" />
            <Field label="Direccion de origen" value={originAddress} onChange={setOriginAddress} placeholder="Valle de Uco, Mendoza, Argentina" />
            <Field label="Latitud origen" value={originLat} onChange={setOriginLat} placeholder="-33.597" />
            <Field label="Longitud origen" value={originLng} onChange={setOriginLng} placeholder="-69.118" />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Rubro</p>
              <div className="mt-3 grid gap-2">
                {verticalOptions.map((option) => (
                  <button
                    suppressHydrationWarning
                    key={option.value}
                    type="button"
                    className={`rounded-xl border px-3 py-2 text-left text-xs transition ${vertical === option.value ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-slate-900/55 text-slate-300"}`}
                    onClick={() => setVertical(option.value)}
                  >
                    <span className="font-semibold">{option.label}</span>
                    <span className="mt-0.5 block opacity-75">{option.hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">Ownership</p>
              <select suppressHydrationWarning className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" value={claimPolicy} onChange={(event) => setClaimPolicy(event.target.value as ClaimPolicy)}>
                {claimPolicies.map((policy) => <option key={policy.value} value={policy.value}>{policy.label}</option>)}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-400">{claimPolicies.find((policy) => policy.value === claimPolicy)?.hint}</p>
              <label className="mt-3 flex items-center gap-2 text-xs text-slate-200">
                <input suppressHydrationWarning type="checkbox" checked={requireFreshTap} onChange={(event) => setRequireFreshTap(event.target.checked)} />
                Exigir tap fresco para reclamar ownership
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-200">
                <input suppressHydrationWarning type="checkbox" checked={requireAntiReplay} onChange={(event) => setRequireAntiReplay(event.target.checked)} />
                Bloquear claim si hay replay o riesgo tamper
              </label>
              <select suppressHydrationWarning className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white" value={tokenizationMode} onChange={(event) => setTokenizationMode(event.target.value as TokenizationMode)}>
                <option value="valid_only">Tokenizar taps validos</option>
                <option value="valid_and_opened">Tokenizar validos o sello abierto</option>
                <option value="manual">Tokenizacion manual/admin</option>
              </select>
            </div>
          </div>
        </div>
        <StepNav activeStep={activeStep} setActiveStep={setActiveStep} nextDisabled={!stepReady[1]} />
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 2 ? "" : "hidden"}`}>
        <StepHeader step="2" title="Batch security y llaves del proveedor" description="Supplier mode exige K_META y K_FILE reales. Internal mode queda para lotes generados por nexID." />
        <div className="mt-4 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Modo de batch</p>
            <div className="mt-3 grid gap-2">
              <ChoiceButton active={batchMode === "supplier"} title="Supplier batch" body="Tags programadas por proveedor. Llaves obligatorias." onClick={() => setBatchMode("supplier")} />
              <ChoiceButton active={batchMode === "internal"} title="Internal batch" body="nexID genera llaves. Usar solo para emision interna." onClick={() => setBatchMode("internal")} />
            </div>
            <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">Para tags que llegan de China, usar supplier batch y pegar exactamente las llaves del proveedor.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="BID / Batch ID" value={bid} onChange={setBid} placeholder="BODEGA-2026-001" />
            <Field label="Chip model" value={chipModel} onChange={setChipModel} placeholder="NTAG 424 DNA TagTamper" />
            <Field label="Security profile" value={securityProfile} onChange={setSecurityProfile} placeholder="NTAG424_DNA_TT_WINE" />
            <Field label="SKU operativo" value={sku} onChange={setSku} placeholder="wine-secure" />
            <Field label="Cantidad planificada" value={quantity} onChange={setQuantity} placeholder="10000" />
            <Field label="K_META hex" value={kMeta} onChange={setKMeta} placeholder="32 hex chars" secret />
            <Field label="K_FILE hex" value={kFile} onChange={setKFile} placeholder="32 hex chars" secret />
            <textarea suppressHydrationWarning className="min-h-24 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas operativas: proveedor, orden de compra, shipment, responsable..." />
          </div>
        </div>
        <p className="mt-4 overflow-x-auto rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">NDEF esperado: {expectedNdefTemplate}</p>
        <StepNav activeStep={activeStep} setActiveStep={setActiveStep} nextDisabled={!stepReady[2]} />
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 3 ? "" : "hidden"}`}>
        <StepHeader step="3" title="Manifest intake con preflight" description="Pega UIDs, sube TXT/CSV o descarga una plantilla. El sistema valida formato, duplicados, batch mismatch e identidad de producto antes de tocar la DB." />
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <ChoicePill active={manifestMode === "paste"} onClick={() => setManifestMode("paste")}>Pegar bulk</ChoicePill>
              <ChoicePill active={manifestMode === "file"} onClick={() => setManifestMode("file")}>Subir archivo</ChoicePill>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200" onClick={downloadCsvTemplate}>Descargar CSV</button>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200" onClick={downloadTxtTemplate}>Descargar TXT</button>
            </div>
            <textarea
              suppressHydrationWarning
              className="mt-3 min-h-60 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-xs leading-5 text-white"
              value={manifestText}
              onChange={(event) => {
                setManifestMode("paste");
                setManifestText(event.target.value);
              }}
              placeholder={"CSV recomendado:\nbatch_id,uid_hex,product_name,sku,lot,serial,expires_at\nBODEGA-2026-001,04A7FFFF1090,Gran Reserva Malbec,wine-secure,MZA-2026-01,0001,\n\nTXT permitido:\n04A7FFFF1090\n04B8FFFF1090"}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input suppressHydrationWarning type="file" accept=".txt,.csv,text/plain,text/csv" className="block w-full max-w-md text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20" onChange={(event) => void onManifestFile(event)} />
              {manifestFileName ? <span className="text-xs text-cyan-100">Archivo: {manifestFileName}</span> : null}
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Rows validas" value={String(manifest.rows.length)} tone={manifest.rows.length ? "good" : "neutral"} />
              <Metric label="Issues" value={String(manifest.issues.length)} tone={manifest.issues.length ? "bad" : "good"} />
              <Metric label="Tipo" value={manifest.type.toUpperCase()} tone="neutral" />
              <Metric label="Producto" value={productLabel || sku || "Pendiente"} tone={productLabel || sku ? "good" : "warn"} />
            </div>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs text-slate-200">
              <input suppressHydrationWarning type="checkbox" checked={manifestActivated} onChange={(event) => setManifestActivated(event.target.checked)} />
              Activar tags importadas automaticamente
            </label>
            {manifest.issues.length ? (
              <div className="max-h-56 overflow-auto rounded-2xl border border-rose-300/25 bg-rose-500/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-100">Errores a corregir</p>
                <div className="mt-2 space-y-2">
                  {manifest.issues.slice(0, 12).map((issue, index) => (
                    <p key={`${issue.row}-${issue.reason}-${index}`} className="rounded-xl border border-rose-200/15 bg-slate-950/45 px-3 py-2 text-xs text-rose-100">
                      Row {issue.row}: {issue.reason}{issue.value ? ` (${issue.value})` : ""}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 p-3 text-xs leading-5 text-emerald-100">
                Manifest listo para importar. En TXT, el wizard genera CSV auditado con product_name/SKU del tenant para que /sun no quede sin identidad de producto.
              </div>
            )}
            <div className="max-h-64 overflow-auto rounded-2xl border border-white/10 bg-slate-950/55 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">Preview</p>
              <div className="mt-2 space-y-2">
                {manifest.rows.slice(0, 8).map((row) => (
                  <div key={row.uidHex} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-200">
                    <b className="text-white">{row.uidHex}</b>
                    <span className="mt-1 block text-slate-400">{row.productName || row.sku} / {row.batchId}</span>
                  </div>
                ))}
                {!manifest.rows.length ? <p className="text-xs text-slate-400">Sin rows validas todavia.</p> : null}
              </div>
            </div>
          </div>
        </div>
        <StepNav activeStep={activeStep} setActiveStep={setActiveStep} nextDisabled={!stepReady[3]} />
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 4 ? "" : "hidden"}`}>
        <StepHeader step="4" title="Provision controlado" description="Ejecuta paso por paso o todo junto. Si algo falla, queda claro que campo falta y no se importan datos incompletos." />
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <ActionCard title="1. Tenant" body="Crea o actualiza SUN profile, origen, claim policy y manifest policy." ready={tenantReady} action={<Button disabled={pending || !tenantProfileReady} onClick={() => void createTenantIfMissing().then(() => setStatus("Tenant listo.")).catch((error) => setStatus(error instanceof Error ? error.message : "tenant failed"))}>Crear tenant</Button>} />
          <ActionCard title="2. Batch" body="Registra BID, chip, perfil, SKU y llaves." ready={batchReady} action={<Button disabled={pending || !tenantProfileReady || !stepReady[2]} onClick={() => void registerBatch().then(() => setStatus("Batch listo.")).catch((error) => setStatus(error instanceof Error ? error.message : "batch failed"))}>Registrar batch</Button>} />
          <ActionCard title="3. Manifest" body="Importa CSV auditado y crea identidad por tag." ready={importedCount > 0} action={<Button disabled={pending || !batchReady || !manifestReady} onClick={() => void importManifest().then(() => setStatus("Manifest importado.")).catch((error) => setStatus(error instanceof Error ? error.message : "manifest failed"))}>Importar manifest</Button>} />
          <ActionCard title="4. Activacion" body="Activa tags importadas para taps reales." ready={activeCount > 0} action={<Button disabled={pending || !importedCount} onClick={() => void activateAll().then(() => setStatus("Tags activadas.")).catch((error) => setStatus(error instanceof Error ? error.message : "activation failed"))}>Activar tags</Button>} />
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-white">
            <input suppressHydrationWarning type="checkbox" checked={adminEnabled} onChange={(event) => setAdminEnabled(event.target.checked)} />
            Crear usuario operador para tenant/reseller
          </label>
          {adminEnabled ? (
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="Email operador" value={adminEmail} onChange={setAdminEmail} placeholder="ops@cliente.com" />
              <Field label="Nombre operador" value={adminName} onChange={setAdminName} placeholder="Operacion Cliente" />
              <div>
                <Field label="Password inicial" value={adminPassword} onChange={setAdminPassword} placeholder="Minimo 8 chars" />
                <button suppressHydrationWarning type="button" className="mt-2 rounded-lg border border-white/15 px-3 py-1 text-xs text-slate-200" onClick={() => setAdminPassword(generatePassword())}>Generar password</button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button disabled={pending || !provisionReady} onClick={() => void runAll()}>{pending ? "Procesando..." : "Provisionar todo"}</Button>
          <Button variant="secondary" disabled={pending || !bid.trim()} onClick={() => void refreshBatchSummary()}>Refrescar resumen</Button>
        </div>
        <StepNav activeStep={activeStep} setActiveStep={setActiveStep} nextDisabled={!stepReady[4]} />
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 5 ? "" : "hidden"}`}>
        <StepHeader step="5" title="SUN pretest y anti-replay" description="Antes de entregar el batch, pega una URL SUN real de una tag fisica y revisa si valida, si detecta replay o si el tenant sigue incompleto." />
        <textarea suppressHydrationWarning className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white" value={supplierUrl} onChange={(event) => setSupplierUrl(event.target.value)} placeholder="https://api.nexid.lat/sun?v=1&bid=...&picc_data=...&enc=...&cmac=..." />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={pending} onClick={() => void validateNow()}>Validar SUN</Button>
          {firstUid ? <a className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200" href={`/demo-lab/mobile/${encodeURIComponent(tenantSlug.trim())}/${encodeURIComponent(firstUid)}?pack=${encodeURIComponent(sku.trim())}&bid=${encodeURIComponent(bid.trim())}&demoMode=consumer_tap`}>Preview consumer</a> : null}
        </div>
        <div className={`mt-4 rounded-2xl border p-4 ${validationCode === "VALID" ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100" : validationCode === "REPLAY_SUSPECT" ? "border-amber-300/25 bg-amber-500/10 text-amber-100" : "border-white/10 bg-slate-950/55 text-slate-200"}`}>
          <p className="text-sm font-semibold">Estado: {validationCode}</p>
          <p className="mt-1 text-sm opacity-90">{validationDetail}</p>
        </div>
        <StepNav activeStep={activeStep} setActiveStep={setActiveStep} nextDisabled={!stepReady[5]} />
      </Card>

      <Card className={`p-5 sm:p-6 ${activeStep === 6 ? "" : "hidden"}`}>
        <StepHeader step="6" title="Handoff operativo" description="Resumen para entregar a tenant admin, reseller o empleado: batch, portal, eventos, tags y auditoria." />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={pending || !bid.trim()} onClick={() => void refreshBatchSummary()}>Cargar resumen</Button>
          <a href={`/batches/${encodeURIComponent(bid.trim())}`} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200">Detalle batch</a>
          <a href={`/events?bid=${encodeURIComponent(bid.trim())}`} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200">Eventos</a>
          <a href={`/tags?bid=${encodeURIComponent(bid.trim())}`} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200">Tags</a>
          <a href="/consumer-network/overview" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100">Consumer network</a>
        </div>
        {batchSummary ? (
          <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-200 md:grid-cols-2">
            <p>Batch: <b className="text-white">{batchSummary.bid}</b></p>
            <p>Tenant: <b className="text-white">{batchSummary.tenant_slug}</b></p>
            <p>SKU: <b className="text-white">{batchSummary.sku || "Sin SKU"}</b></p>
            <p>Chip: <b className="text-white">{batchSummary.chip_model || "Sin chip"}</b></p>
            <p>Planificadas: <b className="text-white">{batchSummary.requested_quantity}</b></p>
            <p>Importadas: <b className="text-white">{batchSummary.imported_tags}</b></p>
            <p>Activas: <b className="text-white">{batchSummary.active_tags}</b></p>
            <p>Pendientes: <b className="text-white">{batchSummary.inactive_tags}</b></p>
          </div>
        ) : (
          <p className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm text-amber-100">Todavia no hay resumen cargado. Ejecuta provision y refresca.</p>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm text-slate-200">{status}</p>
        <pre className="mt-3 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">{responseText}</pre>
      </Card>
    </div>
  );
}

function StepHeader({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Paso {step}</p>
      <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-300">{description}</p>
    </div>
  );
}

function StepNav({ activeStep, setActiveStep, nextDisabled }: { activeStep: WizardStep; setActiveStep: (step: WizardStep) => void; nextDisabled: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap justify-between gap-3">
      <Button variant="secondary" disabled={activeStep <= 1} onClick={() => setActiveStep(Math.max(1, activeStep - 1) as WizardStep)}>Anterior</Button>
      <Button disabled={nextDisabled || activeStep >= 6} onClick={() => setActiveStep(Math.min(6, activeStep + 1) as WizardStep)}>Siguiente</Button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, secret = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; secret?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input suppressHydrationWarning type={secret ? "password" : "text"} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ChoiceButton({ active, title, body, onClick }: { active: boolean; title: string; body: string; onClick: () => void }) {
  return (
    <button suppressHydrationWarning type="button" className={`rounded-xl border px-3 py-3 text-left transition ${active ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-slate-900/55 text-slate-300"}`} onClick={onClick}>
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-1 block text-xs opacity-75">{body}</span>
    </button>
  );
}

function ChoicePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button suppressHydrationWarning type="button" className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${active ? "border-cyan-300/45 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-slate-900/55 text-slate-300"}`} onClick={onClick}>
      {children}
    </button>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const toneClass = tone === "good"
    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
    : tone === "warn"
      ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
      : tone === "bad"
        ? "border-rose-300/25 bg-rose-500/10 text-rose-100"
        : "border-white/10 bg-slate-950/55 text-slate-200";
  return (
    <div className={`rounded-xl border p-3 text-xs ${toneClass}`}>
      <span className="block uppercase tracking-[0.12em] opacity-75">{label}</span>
      <b className="mt-1 block text-base">{value}</b>
    </div>
  );
}

function ActionCard({ title, body, ready, action }: { title: string; body: string; ready: boolean; action: ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${ready ? "border-emerald-300/25 bg-emerald-500/10" : "border-white/10 bg-slate-950/55"}`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 min-h-12 text-xs leading-5 text-slate-300">{body}</p>
      <div className="mt-4">{action}</div>
      <p className={`mt-3 text-xs font-semibold ${ready ? "text-emerald-200" : "text-slate-500"}`}>{ready ? "Listo" : "Pendiente"}</p>
    </div>
  );
}
