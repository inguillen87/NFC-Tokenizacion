-- Durable, fail-closed tenant webhook delivery outbox.

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS endpoint_url text,
  ADD COLUMN IF NOT EXISTS event_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lock_token text;

UPDATE webhook_deliveries wd
SET endpoint_url = we.url
FROM webhook_endpoints we
WHERE wd.endpoint_id = we.id
  AND NULLIF(wd.endpoint_url, '') IS NULL;

-- Historical failures are not replayed automatically during rollout. Operators
-- can inspect them as dead letters and explicitly create a new event if needed.
UPDATE webhook_deliveries
SET event_id = COALESCE(NULLIF(payload->>'id', ''), 'legacy:' || id::text),
    status = CASE WHEN ok THEN 'delivered' ELSE 'dead_letter' END,
    next_attempt_at = NULL
WHERE NULLIF(event_id, '') IS NULL;

ALTER TABLE webhook_deliveries
  ALTER COLUMN endpoint_url SET NOT NULL,
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN next_attempt_at SET DEFAULT now();

ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'processing', 'retry_scheduled', 'delivered', 'dead_letter'));

DROP INDEX IF EXISTS uq_webhook_deliveries_endpoint_event;

CREATE UNIQUE INDEX uq_webhook_deliveries_endpoint_event
  ON webhook_deliveries(endpoint_id, event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_due
  ON webhook_deliveries(status, next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry_scheduled', 'processing');
