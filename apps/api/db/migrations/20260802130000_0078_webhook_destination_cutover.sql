-- Durable webhook destination identity and fail-closed destination cutover.
--
-- The endpoint URL is part of each delivery's immutable identity. A URL change
-- creates a new endpoint destination version; it never rebinds an existing
-- delivery to another network destination. The runner owns the transaction
-- boundary. Webhook signing secrets remain software-envelope encrypted and
-- this migration makes no KMS/HSM or physical-NFC custody claim.

ALTER TABLE webhook_endpoints
  ADD COLUMN IF NOT EXISTS destination_version bigint;

UPDATE webhook_endpoints
SET destination_version = 1
WHERE destination_version IS NULL;

ALTER TABLE webhook_endpoints
  ALTER COLUMN destination_version SET DEFAULT 1,
  ALTER COLUMN destination_version SET NOT NULL;

ALTER TABLE webhook_endpoints
  DROP CONSTRAINT IF EXISTS webhook_endpoints_destination_version_check;

ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_destination_version_check
  CHECK (destination_version >= 1) NOT VALID;

ALTER TABLE webhook_endpoints
  VALIDATE CONSTRAINT webhook_endpoints_destination_version_check;

CREATE OR REPLACE FUNCTION public.nexid_webhook_destination_version_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.destination_version := 1;
    RETURN NEW;
  END IF;

  IF NEW.url IS DISTINCT FROM OLD.url THEN
    IF EXISTS (
      SELECT 1
      FROM webhook_deliveries delivery
      WHERE delivery.endpoint_id = OLD.id
        AND delivery.status = 'processing'
        AND COALESCE(delivery.locked_at, delivery.last_attempt_at, delivery.created_at)
          > now() - interval '10 minutes'
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'webhook_destination_has_fresh_lease';
    END IF;

    IF OLD.destination_version >= 9223372036854775807 THEN
      RAISE EXCEPTION USING
        ERRCODE = '22003',
        MESSAGE = 'webhook_destination_version_exhausted';
    END IF;
    NEW.destination_version := OLD.destination_version + 1;
  ELSE
    -- The version is database-owned; callers cannot forge or rewind it.
    NEW.destination_version := OLD.destination_version;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_destination_version_insert
  ON webhook_endpoints;

CREATE TRIGGER trg_webhook_destination_version_insert
BEFORE INSERT ON webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.nexid_webhook_destination_version_v1();

DROP TRIGGER IF EXISTS trg_webhook_destination_version_update
  ON webhook_endpoints;

CREATE TRIGGER trg_webhook_destination_version_update
BEFORE UPDATE OF url, destination_version ON webhook_endpoints
FOR EACH ROW
EXECUTE FUNCTION public.nexid_webhook_destination_version_v1();

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS destination_version bigint;

-- A legacy row whose snapshotted URL still matches can be identified as the
-- initial version. A mismatched historical row cannot be safely attributed to
-- the endpoint's current version, so version zero records "legacy unknown"
-- without rewriting its destination identity.
UPDATE webhook_deliveries delivery
SET destination_version = CASE
  WHEN delivery.endpoint_url = endpoint.url THEN endpoint.destination_version
  ELSE 0
END
FROM webhook_endpoints endpoint
WHERE endpoint.id = delivery.endpoint_id
  AND delivery.destination_version IS NULL;

-- Never replay an open legacy delivery after an endpoint URL changed. This is
-- classification only: endpoint_url is deliberately not rebound.
UPDATE webhook_deliveries delivery
SET status = 'dead_letter',
    ok = false,
    status_code = NULL,
    next_attempt_at = NULL,
    last_error = 'webhook_destination_mismatch_legacy',
    delivered_at = NULL,
    locked_at = NULL,
    lock_token = NULL
FROM webhook_endpoints endpoint
WHERE endpoint.id = delivery.endpoint_id
  AND delivery.endpoint_url IS DISTINCT FROM endpoint.url
  AND delivery.status IN ('pending', 'retry_scheduled', 'processing');

ALTER TABLE webhook_deliveries
  ALTER COLUMN destination_version SET NOT NULL;

ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_destination_version_check;

ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_destination_version_check
  CHECK (destination_version >= 0) NOT VALID;

ALTER TABLE webhook_deliveries
  VALIDATE CONSTRAINT webhook_deliveries_destination_version_check;

CREATE OR REPLACE FUNCTION public.nexid_webhook_delivery_destination_snapshot_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_endpoint public.webhook_endpoints%ROWTYPE;
BEGIN
  -- FOR SHARE conflicts with an ordinary UPDATE/NO KEY UPDATE of the endpoint.
  -- The insert and destination cutover therefore serialize in either order.
  SELECT endpoint.*
  INTO v_endpoint
  FROM webhook_endpoints endpoint
  WHERE endpoint.id = NEW.endpoint_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'webhook_delivery_endpoint_not_found';
  END IF;

  IF v_endpoint.enabled IS DISTINCT FROM true OR v_endpoint.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'webhook_delivery_endpoint_not_eligible';
  END IF;

  NEW.endpoint_url := v_endpoint.url;
  NEW.destination_version := v_endpoint.destination_version;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_delivery_destination_snapshot
  ON webhook_deliveries;

CREATE TRIGGER trg_webhook_delivery_destination_snapshot
BEFORE INSERT ON webhook_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.nexid_webhook_delivery_destination_snapshot_v1();

CREATE OR REPLACE FUNCTION public.nexid_webhook_delivery_identity_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.endpoint_id IS DISTINCT FROM OLD.endpoint_id
    OR NEW.endpoint_url IS DISTINCT FROM OLD.endpoint_url
    OR NEW.destination_version IS DISTINCT FROM OLD.destination_version
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.event_name IS DISTINCT FROM OLD.event_name
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'webhook_delivery_identity_is_immutable';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_delivery_identity_immutable
  ON webhook_deliveries;

CREATE TRIGGER trg_webhook_delivery_identity_immutable
BEFORE UPDATE OF endpoint_id, endpoint_url, destination_version, event_id, event_name, payload, created_at
ON webhook_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.nexid_webhook_delivery_identity_immutable_v1();

ALTER TABLE webhook_endpoint_audit_events
  DROP CONSTRAINT IF EXISTS webhook_endpoint_audit_event_type_check;

ALTER TABLE webhook_endpoint_audit_events
  ADD CONSTRAINT webhook_endpoint_audit_event_type_check CHECK (event_type IN (
    'webhook_endpoint_created',
    'webhook_endpoint_updated',
    'webhook_endpoint_disabled',
    'webhook_endpoint_reactivated',
    'webhook_endpoint_deleted',
    'webhook_secret_rotated',
    'webhook_destination_changed'
  )) NOT VALID;

ALTER TABLE webhook_endpoint_audit_events
  VALIDATE CONSTRAINT webhook_endpoint_audit_event_type_check;

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_destination_identity
  ON webhook_deliveries(endpoint_id, destination_version, status, created_at);

REVOKE ALL ON FUNCTION public.nexid_webhook_destination_version_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_webhook_delivery_destination_snapshot_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_webhook_delivery_identity_immutable_v1() FROM PUBLIC;
