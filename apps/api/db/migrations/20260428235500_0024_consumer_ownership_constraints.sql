ALTER TABLE consumer_product_ownerships
  ADD CONSTRAINT uq_consumer_product_ownerships_tenant_event_consumer
  UNIQUE (tenant_id, event_id, consumer_id);

CREATE INDEX IF NOT EXISTS idx_consumer_product_ownerships_event_status
  ON consumer_product_ownerships(event_id, status);
