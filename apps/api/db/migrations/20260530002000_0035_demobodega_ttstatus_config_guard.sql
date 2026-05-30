-- Keep the demobodega pilot aligned with the current NTAG 424 DNA TT contract.
-- This is intentionally config-only: never rewrite batch keys from a migration.
-- If the BID is duplicated, stop instead of updating multiple key/config rows.
DO $$
DECLARE
  matching_count integer;
BEGIN
  SELECT COUNT(*) INTO matching_count FROM batches WHERE bid = 'DEMO-2026-02';

  IF matching_count = 0 THEN
    RETURN;
  END IF;

  IF matching_count > 1 THEN
    RAISE EXCEPTION 'Duplicate DEMO-2026-02 batch rows exist. Resolve duplicates before applying TTStatus config.';
  END IF;

  UPDATE batches
  SET
    carrier_profile_code = COALESCE(carrier_profile_code, 'ntag424_dna_tt'),
    sdm_config = COALESCE(sdm_config, '{}'::jsonb) || '{
      "chip_model":"NTAG 424 DNA TT",
      "carrier_profile_code":"ntag424_dna_tt",
      "mac_input":"enc_plus_cmac_literal",
      "mac_input_candidates":["enc_plus_cmac_literal","enc_only_ascii","query_from_enc_to_cmac","query_from_picc_data_to_cmac"],
      "tagtamper_enabled":true,
      "tamper_status_enabled":true,
      "tamper_status_source":"enc_decrypted",
      "tamper_status_offset":0,
      "tamper_status_length":2,
      "tamper_closed_values":["4343"],
      "tamper_open_values":["4F4F","4F43"],
      "tamper_invalid_values":["4949"],
      "tamper_unknown_policy":"UNKNOWN",
      "ttstatus_enabled":true,
      "ttstatus_source":"enc_decrypted",
      "ttstatus_offset":0,
      "ttstatus_length":2,
      "ttstatus_closed_values":["4343"],
      "ttstatus_opened_values":["4F4F","4F43"],
      "ttstatus_invalid_values":["4949"],
      "ttstatus_notes":"DEMO-2026-02 reads full two-byte NTAG 424 DNA TT status from decrypted ENC: 4343 closed, 4F4F opened, 4F43 opened previously, 4949 invalid."
    }'::jsonb,
    updated_at = now()
  WHERE bid = 'DEMO-2026-02';
END $$;
