-- Stable tenant-bound keyset pagination for the offline verifier history.
-- The API projects operational metadata only; raw NFC/SUN payloads and key
-- material are intentionally absent from both this index and the read model.

CREATE INDEX IF NOT EXISTS idx_offline_scan_events_tenant_history
  ON offline_scan_events (tenant_id, received_at DESC, id DESC);
