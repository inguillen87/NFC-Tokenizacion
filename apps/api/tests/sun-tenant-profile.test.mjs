import test from "node:test";
import assert from "node:assert/strict";

const { resolveSunTenantProfile } = await import("../src/lib/sun-tenant-profile.ts");

const ownershipPolicy = {
  requiresPurchaseProof: true,
  requiresFreshTap: true,
  requiresTenantMembership: true,
  allowsPublicClaim: false,
  antiReplayRequired: true,
};

const manifestPolicy = {
  acceptedFormats: ["csv", "txt"],
  requiredColumns: ["uid_hex"],
  rejectDuplicates: true,
};

test("demobodega resolves only when database passport/profile/product data is present", () => {
  const result = resolveSunTenantProfile({
    bid: "DEMO-2026-02",
    passport: {
      tenant_id: "00000000-0000-0000-0000-000000000001",
      tenant_slug: "demobodega",
      tenant_name: "Demo Bodega",
      sun_profile_vertical: "wine",
      sun_profile_club_name: "Club Terroir",
      sun_profile_product_label: "Vino premium",
      sun_profile_origin_label: "Valle de Uco, Mendoza",
      sun_profile_origin_address: "Finca Altamira, Mendoza, AR",
      sun_profile_origin_lat: -33.3667,
      sun_profile_origin_lng: -69.15,
      sun_profile_tokenization_mode: "valid_and_opened",
      sun_profile_claim_policy: "purchase_proof_required",
      sun_profile_ownership_policy: ownershipPolicy,
      sun_profile_manifest_policy: manifestPolicy,
      product_name: "Gran Reserva Malbec",
      winery: "Demo Bodega",
      region: "Valle de Uco, Mendoza",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.profile.tenantSlug, "demobodega");
  assert.equal(result.profile.vertical, "wine");
  assert.equal(result.profile.tokenizationMode, "valid_and_opened");
  assert.equal(result.profile.claimPolicy, "purchase_proof_required");
  assert.equal(result.profile.origin.coordinates.lat, -33.3667);
  assert.equal(result.profile.product.name, "Gran Reserva Malbec");
});

test("future tenant is resolved from explicit database passport/config without generic fallback", () => {
  const result = resolveSunTenantProfile({
    bid: "PHARMA-LOT-2026-01",
    passport: {
      tenant_id: "00000000-0000-0000-0000-000000000002",
      tenant_slug: "lab-sur",
      tenant_name: "Laboratorio Sur",
      batch_sdm_config: {
        sun: {
          product: { serving: "Uso profesional" },
        },
      },
      sun_profile_vertical: "pharma",
      sun_profile_club_name: "Patient Trust",
      sun_profile_product_label: "Medicamento serializado",
      sun_profile_origin_label: "Planta Pilar",
      sun_profile_origin_address: "Pilar, Buenos Aires",
      sun_profile_origin_lat: -34.45,
      sun_profile_origin_lng: -58.91,
      sun_profile_tokenization_mode: "valid_only",
      sun_profile_claim_policy: "retailer_attested",
      sun_profile_ownership_policy: ownershipPolicy,
      sun_profile_manifest_policy: manifestPolicy,
      product_name: "Ampolla Serie A",
      region: "Pilar, Argentina",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.profile.tenantSlug, "lab-sur");
  assert.equal(result.profile.tenantName, "Laboratorio Sur");
  assert.equal(result.profile.vertical, "pharma");
  assert.equal(result.profile.clubName, "Patient Trust");
  assert.equal(result.profile.productLabel, "Medicamento serializado");
  assert.equal(result.profile.tokenizationMode, "valid_only");
  assert.equal(result.profile.origin.coordinates.lng, -58.91);
  assert.equal(result.profile.product.name, "Ampolla Serie A");
});

test("product identity can come from explicit batch SUN config when manifest row is not enriched yet", () => {
  const result = resolveSunTenantProfile({
    bid: "DEMO-2026-02",
    passport: {
      tenant_id: "00000000-0000-0000-0000-000000000001",
      tenant_slug: "demobodega",
      tenant_name: "Demo Bodega",
      batch_sdm_config: {
        sun: {
          product: {
            name: "Gran Reserva Malbec",
            producer: "Demo Bodega",
            varietal: "Malbec",
            vintage: "2022",
            serving: "16C - decantar 20 min",
          },
          origin: {
            region: "Valle de Uco, Mendoza",
            altitude: "1,050 msnm",
          },
        },
      },
      sun_profile_vertical: "wine",
      sun_profile_club_name: "Club Terroir",
      sun_profile_product_label: "Vino premium",
      sun_profile_origin_label: "Valle de Uco, Mendoza",
      sun_profile_origin_address: "Finca Altamira, Mendoza, AR",
      sun_profile_origin_lat: -33.3667,
      sun_profile_origin_lng: -69.15,
      sun_profile_tokenization_mode: "valid_and_opened",
      sun_profile_claim_policy: "purchase_proof_required",
      sun_profile_ownership_policy: ownershipPolicy,
      sun_profile_manifest_policy: manifestPolicy,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.profile.product.name, "Gran Reserva Malbec");
  assert.equal(result.profile.product.winery, "Demo Bodega");
  assert.equal(result.profile.product.varietal, "Malbec");
});

test("unknown or incomplete tenant requires setup instead of generic/manual fallback", () => {
  const result = resolveSunTenantProfile({ bid: "ACME-2026-001" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "tenant_setup_required");
  assert.ok(result.missing.includes("tenant_id"));
  assert.ok(result.missing.includes("tenant_sun_profiles.vertical"));
  assert.ok(result.missing.includes("tag_profiles.product_name_or_sku"));
});
