export const verticalConsumerId = "20000000-0000-4000-8000-000000000001";
export const verticalProgramId = "30000000-0000-4000-8000-000000000001";
export function verticalWriterFixture(vertical = "wine", result = "VALID_CLOSED") {
  const tenant = { id: "10000000-0000-4000-8000-000000000001", slug: "synthetic-brand", name: "Synthetic brand", status: "active" };
  const batch = { id: "10000000-0000-4000-8000-000000000002", tenant_id: tenant.id, bid: "SYNTHETIC-VERTICAL", status: "active", sdm_config: {}, carrier_profile_code: "ntag424_dna_tt" };
  const tag = { id: "10000000-0000-4000-8000-000000000003", batch_id: batch.id, uid_hex: "04AABBCCDD0011", status: "active", lifecycle_state: "active" };
  const profile = { tenant_id: tenant.id, vertical, club_name: "Synthetic club", product_label: "Synthetic product", origin_label: "Synthetic origin", origin_address: "Synthetic address", origin_lat: -33, origin_lng: -69, tokenization_mode: "valid_and_opened", claim_policy: "purchase_proof_required", ownership_policy: { requiresFreshTap: true }, manifest_policy: { rejectDuplicates: true } };
  const product = { tag_id: tag.id, product_name: "Synthetic product", winery: "Synthetic brand", image_url: null };
  const state = result === "OPENED" ? "VALID_OPENED" : result === "OPENED_PREVIOUSLY" ? "VALID_OPENED_PREVIOUSLY" : result;
  const ttRaw = state === "VALID_OPENED" ? "4F4F" : state === "VALID_OPENED_PREVIOUSLY" ? "4F43" : "4343";
  const event = { id: "900001", tenant_id: tenant.id, batch_id: batch.id, uid_hex: tag.uid_hex, sdm_read_ctr: 1, result, reason: "verified_tt", source: "real", event_type: "TAP_VALID", verdict: "valid", cmac_ok: true, allowlisted: true, city: null, country_code: null,
    meta: { sun_tt_truth_receipt: { schema_version: "sun-tt-durable-truth-receipt/v1", binding_status: "BOUND", carrier_profile_code: "ntag424_dna_tt", canonical_product_state: state, tt_raw: ttRaw } } };
  return { snapshot: { event, batch, tenant, tag, profile, product, manual: null }, identity_count: 1, event_count: 1 };
}
export const verticalTestEnv = { NODE_ENV: "test", VERCEL_ENV: "test", NEXID_E2E_CONFIRMATION: "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE", NEXID_E2E_DATABASE_URL: "postgresql://nexid_e2e:synthetic@127.0.0.1/nexid_e2e_vertical" };
