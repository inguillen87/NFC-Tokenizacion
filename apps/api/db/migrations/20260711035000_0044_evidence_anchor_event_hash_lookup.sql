CREATE INDEX IF NOT EXISTS idx_evidence_anchors_event_hashes_gin
  ON evidence_anchors USING gin (event_hashes_json jsonb_ops);
