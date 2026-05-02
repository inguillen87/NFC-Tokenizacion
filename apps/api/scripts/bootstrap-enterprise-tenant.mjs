#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const usage = `
Usage:
  node scripts/bootstrap-enterprise-tenant.mjs \\
    --api-url=https://api.nexid.lat \\
    --tenant=<slug> \\
    --tenant-name="<legal/commercial name>" \\
    --vertical=wine|events|cosmetics|agro|pharma|luxury \\
    --club-name="<consumer club name>" \\
    --product-label="<public product label>" \\
    --origin-label="<origin short label>" \\
    --origin-address="<origin address>" \\
    --origin-lat=-33.36 \\
    --origin-lng=-69.15 \\
    --tokenization-mode=valid_and_opened|valid_only|manual \\
    --claim-policy=purchase_proof_required|retailer_attested|inside_pack_secret|admin_approved \\
    --batch-bid=<supplier BID> \\
    --mode=supplier|internal \\
    --security-profile=ntag424dna_tt \\
    --sku=<sku> \\
    --chip-model=NTAG424_DNA_TT \\
    --manifest=C:\\path\\manifest.csv \\
    --activate-imported=true \\
    --k-meta-hex=<32 hex chars for supplier mode> \\
    --k-file-hex=<32 hex chars for supplier mode>

Required env:
  ADMIN_API_KEY=<super-admin API key>

Notes:
  - This script never creates demo tenants by default.
  - Supplier mode requires explicit K_META and K_FILE values.
  - TXT manifests are converted to CSV with product label and SKU before import.
`;

function arg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : "";
}

function requireArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}\n${usage}`);
  return value;
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing env ${name}\n${usage}`);
  return value;
}

function parseNumberArg(name) {
  const parsed = Number(requireArg(name));
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a valid number`);
  return parsed;
}

function parseBooleanArg(name) {
  const value = requireArg(name).toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`--${name} must be true or false`);
}

function requireHex32(name) {
  const value = requireArg(name).toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(value)) {
    throw new Error(`--${name} must be exactly 32 hex characters`);
  }
  return value;
}

function normalizeApiUrl(value) {
  return value.replace(/\/+$/, "");
}

function claimPolicyTemplate(claimPolicy) {
  const strict = {
    requiresPurchaseProof: true,
    requiresFreshTap: true,
    requiresTenantMembership: true,
    allowsPublicClaim: false,
    antiReplayRequired: true,
  };
  if (claimPolicy === "purchase_proof_required") return strict;
  if (claimPolicy === "retailer_attested") return { ...strict, requiresPurchaseProof: false, requiresRetailerAttestation: true };
  if (claimPolicy === "inside_pack_secret") return { ...strict, requiresPurchaseProof: false, requiresInsidePackSecret: true };
  if (claimPolicy === "admin_approved") return { ...strict, requiresAdminApproval: true };
  throw new Error(`Unsupported --claim-policy=${claimPolicy}`);
}

function manifestPolicyTemplate() {
  return {
    acceptedFormats: ["csv", "txt"],
    requiredColumns: ["uid_hex"],
    csvOptionalColumns: ["batch_id", "product_name", "sku", "lot", "serial", "expires_at"],
    activateDefault: false,
    rejectDuplicates: true,
  };
}

function parseTxtManifest(content) {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = String(lines[0] || "").toLowerCase();
  const start = first === "uid" || first === "uid_hex" ? 1 : 0;
  return lines.slice(start);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function prepareManifest(content, bid, productLabel, sku) {
  const header = content.split(/\r?\n/)[0] || "";
  if (header.includes(",") || header.includes(";")) return content;
  const rows = parseTxtManifest(content);
  return [
    "batch_id,uid_hex,product_name,sku",
    ...rows.map((uid) => [bid, uid.toUpperCase(), productLabel, sku].map(csvEscape).join(",")),
  ].join("\n");
}

async function apiFetch(apiUrl, apiKey, method, pathname, body) {
  const res = await fetch(`${apiUrl}${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
      "x-admin-api-key": apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${pathname} failed (${res.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

const apiUrl = normalizeApiUrl(requireArg("api-url"));
const apiKey = String(arg("admin-api-key") || process.env.ADMIN_API_KEY || "").trim() || requireEnv("ADMIN_API_KEY");
const tenant = requireArg("tenant").toLowerCase();
const tenantName = requireArg("tenant-name");
const vertical = requireArg("vertical");
const clubName = requireArg("club-name");
const productLabel = requireArg("product-label");
const originLabel = requireArg("origin-label");
const originAddress = requireArg("origin-address");
const originLat = parseNumberArg("origin-lat");
const originLng = parseNumberArg("origin-lng");
const tokenizationMode = requireArg("tokenization-mode");
const claimPolicy = requireArg("claim-policy");
const bid = requireArg("batch-bid");
const mode = requireArg("mode").toLowerCase();
const securityProfile = requireArg("security-profile");
const sku = requireArg("sku");
const chipModel = requireArg("chip-model");
const manifestPath = path.resolve(requireArg("manifest"));
const activateImported = parseBooleanArg("activate-imported");

if (!["supplier", "internal"].includes(mode)) throw new Error("--mode must be supplier or internal");
if (!fs.existsSync(manifestPath)) throw new Error(`Manifest file not found: ${manifestPath}`);

const batchPayload = {
  tenant_slug: tenant,
  bid,
  mode,
  security_profile: securityProfile,
  sku,
  chip_model: chipModel,
  quantity: Number(arg("quantity") || 0) || undefined,
  notes: arg("notes") || undefined,
};

if (mode === "supplier") {
  batchPayload.k_meta_hex = requireHex32("k-meta-hex");
  batchPayload.k_file_hex = requireHex32("k-file-hex");
}

const tenantPayload = {
  slug: tenant,
  name: tenantName,
  sun_profile: {
    vertical,
    club_name: clubName,
    product_label: productLabel,
    origin_label: originLabel,
    origin_address: originAddress,
    origin_lat: originLat,
    origin_lng: originLng,
    tokenization_mode: tokenizationMode,
    claim_policy: claimPolicy,
    ownership_policy: claimPolicyTemplate(claimPolicy),
    manifest_policy: manifestPolicyTemplate(),
    theme: {
      accent: arg("theme-accent") || "cyan",
      secondary: arg("theme-secondary") || "violet",
      mapStyle: arg("map-style") || "luxury",
    },
    metadata: {
      onboardingSource: "enterprise_cli",
      manifestFile: path.basename(manifestPath),
      importedAt: new Date().toISOString(),
    },
  },
};

const rawManifest = fs.readFileSync(manifestPath, "utf8");
const csv = prepareManifest(rawManifest, bid, productLabel, sku);

console.log(`Creating/updating tenant ${tenant} through ${apiUrl}...`);
const tenantResult = await apiFetch(apiUrl, apiKey, "POST", "/admin/tenants", tenantPayload);
console.log(`Tenant ready: ${tenantResult.slug || tenant}`);

console.log(`Registering batch ${bid} (${mode})...`);
const batchResult = await apiFetch(apiUrl, apiKey, "POST", "/admin/batches/register", batchPayload);
console.log(`Batch ready: ${batchResult.batch?.bid || bid}`);

console.log(`Importing manifest ${path.basename(manifestPath)}...`);
const manifestResult = await apiFetch(apiUrl, apiKey, "POST", `/admin/batches/${encodeURIComponent(bid)}/import-manifest`, {
  csv,
  activateImported,
});

console.log(JSON.stringify({
  ok: true,
  tenant: tenantResult.slug || tenant,
  batch: batchResult.batch?.bid || bid,
  manifest: {
    importedRows: manifestResult.importedRows,
    inserted: manifestResult.inserted,
    reactivated: manifestResult.reactivated,
    activated: manifestResult.activated,
  },
  next: {
    dashboard: `/batches/${encodeURIComponent(bid)}`,
    validateSun: "/admin/sun/validate",
  },
}, null, 2));
