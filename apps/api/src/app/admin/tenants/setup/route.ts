export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { sql } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { upsertTenantSunProfile, type TenantSunProfileInput } from '../../../../lib/tenant-onboarding';
import {
  type SunVertical,
  type SunTokenizationMode,
  type SunClaimPolicy,
} from '../../../../lib/sun-tenant-profile';

const EXTENDED_MANIFEST_COLUMNS = [
  "batch_id",
  "product_name",
  "sku",
  "lot",
  "serial",
  "serial_number",
  "external_unit_id",
  "bottle_number",
  "label_number",
  "case_id",
  "pallet_id",
  "roll_id",
  "supplier_lot",
  "expires_at",
  "image_url",
  "label_image_url",
  "model_url",
  "gallery_urls",
  "sensor_json",
  "iot_json",
  "telemetry_json",
  "sensor_at",
  "sensor_id",
  "temperature_c",
  "humidity_pct",
  "light_exposure",
  "transit_shock",
  "storage_zone",
];

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const expected = String(process.env.ADMIN_API_KEY || "").trim();

  if (!expected || token !== expected) {
    return json({ ok: false, reason: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({})) as {
    tenantSlug?: string;
    tenantName?: string;
    vertical?: string;
    clubName?: string;
    productLabel?: string;
    originLabel?: string;
    originAddress?: string;
    originLat?: number;
    originLng?: number;
  };

  const tenantSlug = req.headers.get("x-nexid-tenant-slug") || body.tenantSlug;
  if (!tenantSlug) {
    return json({ ok: false, reason: "x-nexid-tenant-slug header or tenantSlug in body required" }, 400);
  }

  const tenantRows = await sql`SELECT id FROM tenants WHERE slug = ${tenantSlug} LIMIT 1`;
  if (tenantRows.length === 0) {
    return json({ ok: false, reason: "tenant not found" }, 404);
  }
  const tenantId = tenantRows[0].id;

  const tenantName = body.tenantName ? String(body.tenantName).trim() : null;
  if (tenantName) {
    await sql`UPDATE tenants SET name = ${tenantName} WHERE id = ${tenantId}::uuid`;
  }

  // Determine vertical configuration parameters
  const inputVertical = String(body.vertical || 'wine').trim().toLowerCase();
  let vertical: SunVertical = 'wine';
  let tokenizationMode: SunTokenizationMode = 'valid_and_opened';
  let claimPolicy: SunClaimPolicy = 'purchase_proof_required';
  let ownershipPolicy: Record<string, unknown> = {};
  let manifestPolicy: Record<string, unknown> = {};
  let theme: Record<string, unknown> = {};

  if (inputVertical === 'pharma' || inputVertical === 'farmacia') {
    vertical = 'pharma';
    tokenizationMode = 'valid_only';
    claimPolicy = 'inside_pack_secret';
    ownershipPolicy = {
      requiresPurchaseProof: false,
      requiresFreshTap: false,
      requiresTenantMembership: false,
      allowsPublicClaim: true,
      antiReplayRequired: true,
    };
    manifestPolicy = {
      acceptedFormats: ["csv"],
      requiredColumns: ["uid_hex"],
      csvOptionalColumns: EXTENDED_MANIFEST_COLUMNS,
      activateDefault: true,
      rejectDuplicates: true,
    };
    theme = { accent: 'emerald', secondary: 'cyan', mapStyle: 'pharma' };
  } else if (inputVertical === 'luxury' || inputVertical === 'lujo') {
    vertical = 'luxury';
    tokenizationMode = 'valid_only';
    claimPolicy = 'admin_approved';
    ownershipPolicy = {
      requiresPurchaseProof: true,
      requiresFreshTap: true,
      requiresTenantMembership: true,
      allowsPublicClaim: false,
      antiReplayRequired: true,
    };
    manifestPolicy = {
      acceptedFormats: ["csv", "txt"],
      requiredColumns: ["uid_hex"],
      csvOptionalColumns: EXTENDED_MANIFEST_COLUMNS,
      activateDefault: false,
      rejectDuplicates: true,
    };
    theme = { accent: 'amber', secondary: 'violet', mapStyle: 'luxury' };
  } else if (inputVertical === 'agro' || inputVertical === 'agroindustrial') {
    vertical = 'agro';
    tokenizationMode = 'manual';
    claimPolicy = 'retailer_attested';
    ownershipPolicy = {
      requiresPurchaseProof: false,
      requiresFreshTap: false,
      requiresTenantMembership: false,
      allowsPublicClaim: true,
      antiReplayRequired: false,
    };
    manifestPolicy = {
      acceptedFormats: ["csv", "txt"],
      requiredColumns: ["uid_hex"],
      csvOptionalColumns: EXTENDED_MANIFEST_COLUMNS,
      activateDefault: true,
      rejectDuplicates: true,
    };
    theme = { accent: 'emerald', secondary: 'amber', mapStyle: 'agro' };
  } else if (inputVertical === 'documents' || inputVertical === 'credenciales' || inputVertical === 'credential') {
    vertical = 'documents';
    tokenizationMode = 'valid_only';
    claimPolicy = 'admin_approved';
    ownershipPolicy = {
      requiresPurchaseProof: false,
      requiresFreshTap: false,
      requiresTenantMembership: false,
      allowsPublicClaim: true,
      antiReplayRequired: true,
    };
    manifestPolicy = {
      acceptedFormats: ["csv", "txt"],
      requiredColumns: ["uid_hex"],
      csvOptionalColumns: EXTENDED_MANIFEST_COLUMNS,
      activateDefault: true,
      rejectDuplicates: true,
    };
    theme = { accent: 'blue', secondary: 'slate', mapStyle: 'documents' };
  } else {
    // Default/wine
    vertical = 'wine';
    tokenizationMode = 'valid_and_opened';
    claimPolicy = 'purchase_proof_required';
    ownershipPolicy = {
      requiresPurchaseProof: true,
      requiresFreshTap: true,
      requiresTenantMembership: true,
      allowsPublicClaim: false,
      antiReplayRequired: true,
    };
    manifestPolicy = {
      acceptedFormats: ["csv", "txt"],
      requiredColumns: ["uid_hex"],
      csvOptionalColumns: EXTENDED_MANIFEST_COLUMNS,
      activateDefault: false,
      rejectDuplicates: true,
    };
    theme = { accent: 'cyan', secondary: 'violet', mapStyle: 'luxury' };
  }

  const clubName = body.clubName ? String(body.clubName).trim() : 'Default Club';
  const productLabel = body.productLabel ? String(body.productLabel).trim() : 'Premium Asset';
  const originLabel = body.originLabel ? String(body.originLabel).trim() : 'Winery Origin';
  const originAddress = body.originAddress ? String(body.originAddress).trim() : 'Unknown Address';
  const originLat = typeof body.originLat === 'number' ? body.originLat : 0.0;
  const originLng = typeof body.originLng === 'number' ? body.originLng : 0.0;

  const profileInput: TenantSunProfileInput = {
    vertical,
    clubName,
    productLabel,
    originLabel,
    originAddress,
    originLat,
    originLng,
    tokenizationMode,
    claimPolicy,
    ownershipPolicy,
    manifestPolicy,
    theme,
    metadata: { setup_completed: true },
  };

  const updatedProfile = await upsertTenantSunProfile(tenantId, profileInput);

  return json({
    ok: true,
    tenantId,
    tenantSlug,
    profile: updatedProfile,
  });
}
