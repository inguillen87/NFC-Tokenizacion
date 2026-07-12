UPDATE tokenization_requests
SET status = 'simulated',
    network = 'simulation',
    tx_hash = NULL,
    token_id = NULL,
    anchor_hash = NULL,
    external_ref = COALESCE(NULLIF(external_ref, ''), 'simulation:legacy-normalized'),
    meta = COALESCE(meta, '{}'::jsonb) || '{"legacy_simulation_normalized":true}'::jsonb
WHERE status = 'anchored'
  AND lower(COALESCE(meta->>'simulated', 'false')) = 'true';

CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant_asset
ON tokenization_requests(tenant_id, batch_id, uid_hex, requested_at DESC);
