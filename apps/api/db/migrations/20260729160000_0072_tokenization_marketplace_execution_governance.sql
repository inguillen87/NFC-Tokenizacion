-- 0072 is expand-only governance for tokenization execution and marketplace
-- attribution. It does not change SUN/SDM verification, NFC keys, or custody.
-- Software controls in this migration are not an HSM claim.

ALTER TABLE tokenization_requests
  ADD COLUMN IF NOT EXISTS tag_id uuid,
  ADD COLUMN IF NOT EXISTS source_event_id bigint,
  ADD COLUMN IF NOT EXISTS source_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS execution_class text DEFAULT 'legacy_unclassified',
  ADD COLUMN IF NOT EXISTS lease_id uuid,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_acquired_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

ALTER TABLE marketplace_offers
  ADD COLUMN IF NOT EXISTS resale_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS resale_currency text,
  ADD COLUMN IF NOT EXISTS ownership_id uuid;

ALTER TABLE marketplace_order_requests
  ADD COLUMN IF NOT EXISTS source_uid_hex text,
  ADD COLUMN IF NOT EXISTS source_batch_id uuid,
  ADD COLUMN IF NOT EXISTS source_tag_id uuid,
  ADD COLUMN IF NOT EXISTS source_bid text,
  ADD COLUMN IF NOT EXISTS source_tap_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_context_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fee_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS fee_currency text;

ALTER TABLE order_requests
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- This attribution column was previously created only by runtime compatibility
-- DDL. Own it in the canonical ledger before using it to backfill commercial
-- request scope so clean environments and existing deployments converge.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_tenant_created_at
  ON leads (tenant_id, created_at DESC);

-- Only exact, non-ambiguous historical identities are materialized. Anything
-- uncertain remains legacy_unclassified or NULL and therefore cannot execute.
WITH event_candidates AS (
  SELECT
    request.id AS request_id,
    event.id AS event_id,
    event.created_at AS event_created_at,
    count(*) OVER (PARTITION BY request.id) AS match_count
  FROM tokenization_requests request
  JOIN batches batch
    ON batch.id = request.batch_id
   AND batch.tenant_id = request.tenant_id
   AND upper(batch.bid) = upper(request.bid)
  JOIN events event
    ON event.id = COALESCE(
      request.source_event_id,
      CASE
        WHEN COALESCE(request.meta->>'event_id', '') ~ '^[0-9]{1,18}$'
          THEN (request.meta->>'event_id')::bigint
        ELSE NULL
      END
    )
   AND event.tenant_id = request.tenant_id
   AND event.batch_id = request.batch_id
   AND upper(event.uid_hex) = upper(request.uid_hex)
   AND upper(event.bid) = upper(request.bid)
)
UPDATE tokenization_requests request
SET source_event_id = candidate.event_id,
    source_event_created_at = candidate.event_created_at
FROM event_candidates candidate
WHERE request.id = candidate.request_id
  AND candidate.match_count = 1
  AND (request.source_event_id IS NULL OR request.source_event_created_at IS NULL);

WITH tag_candidates AS (
  SELECT
    request.id AS request_id,
    tag.id AS tag_id,
    count(*) OVER (PARTITION BY request.id) AS match_count
  FROM tokenization_requests request
  JOIN batches batch
    ON batch.id = request.batch_id
   AND batch.tenant_id = request.tenant_id
   AND upper(batch.bid) = upper(request.bid)
  JOIN tags tag
    ON tag.batch_id = batch.id
   AND upper(tag.uid_hex) = upper(request.uid_hex)
  WHERE request.tag_id IS NULL
)
UPDATE tokenization_requests request
SET tag_id = candidate.tag_id
FROM tag_candidates candidate
WHERE request.id = candidate.request_id
  AND candidate.match_count = 1;

UPDATE tokenization_requests
SET execution_class = 'legacy_unclassified'
WHERE execution_class IS NULL;

UPDATE tokenization_requests
SET execution_class = 'simulation'
WHERE execution_class = 'legacy_unclassified'
  AND (
    status = 'simulated'
    OR lower(COALESCE(network, '')) = 'simulation'
    OR lower(COALESCE(meta->>'simulated', 'false')) = 'true'
  );

-- A legacy row presented as both simulation and anchored is contradictory.
-- Keep its evidence for investigation, but never expose it as a chain finality
-- receipt or make it retryable.
UPDATE tokenization_requests request
SET execution_class = 'legacy_unclassified',
    status = 'reconciling',
    next_attempt_at = NULL,
    last_error = 'tokenization_simulation_anchor_reconciliation_required',
    meta = COALESCE(request.meta, '{}'::jsonb) || jsonb_build_object(
      'automatic_retry_blocked', true,
      'reconciliation_required', true,
      'historical_status', 'anchored',
      'historical_execution_class', 'simulation'
    )
WHERE request.execution_class = 'simulation'
  AND request.status = 'anchored';

UPDATE tokenization_requests request
SET execution_class = 'testnet_trial'
WHERE request.execution_class = 'legacy_unclassified'
  AND request.tag_id IS NOT NULL
  AND request.source_event_id IS NOT NULL
  AND request.source_event_created_at IS NOT NULL
  AND lower(COALESCE(request.network, '')) IN ('polygon-amoy', 'ethereum-sepolia', 'base-sepolia')
  AND lower(COALESCE(request.meta->>'simulated', 'false')) <> 'true'
  AND (
    request.status <> 'anchored'
    OR (
      lower(COALESCE(request.meta->>'evidence_verified', 'false')) = 'true'
      AND NULLIF(trim(request.tx_hash), '') IS NOT NULL
      AND NULLIF(trim(request.token_id), '') IS NOT NULL
    )
  )
  AND EXISTS (
    SELECT 1
    FROM batches batch
    JOIN tags tag
     ON tag.id = request.tag_id
     AND tag.batch_id = batch.id
     AND upper(tag.uid_hex) = upper(request.uid_hex)
     AND tag.status::text = 'active'
     AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
    JOIN events event
      ON event.id = request.source_event_id
     AND event.created_at = request.source_event_created_at
     AND event.tenant_id = request.tenant_id
     AND event.batch_id = batch.id
     AND event.tag_id::text = tag.id::text
     AND upper(event.uid_hex) = upper(request.uid_hex)
     AND upper(event.bid) = upper(request.bid)
     AND event.cmac_ok IS TRUE
     AND event.allowlisted IS TRUE
     AND upper(COALESCE(event.result, '')) = 'VALID'
    WHERE batch.id = request.batch_id
      AND batch.tenant_id = request.tenant_id
      AND upper(batch.bid) = upper(request.bid)
      AND batch.status::text IN ('active', 'active_in_market')
  );

UPDATE tokenization_requests request
SET execution_class = 'live_chain'
WHERE request.execution_class = 'legacy_unclassified'
  AND request.status = 'anchored'
  AND request.tag_id IS NOT NULL
  AND request.source_event_id IS NOT NULL
  AND request.source_event_created_at IS NOT NULL
  AND lower(COALESCE(request.network, '')) IN ('polygon', 'ethereum-mainnet', 'base-mainnet')
  AND lower(COALESCE(request.meta->>'simulated', 'false')) <> 'true'
  AND lower(COALESCE(request.meta->>'evidence_verified', 'false')) = 'true'
  AND NULLIF(trim(request.tx_hash), '') IS NOT NULL
  AND NULLIF(trim(request.token_id), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM batches batch
    JOIN tags tag
     ON tag.id = request.tag_id
     AND tag.batch_id = batch.id
     AND upper(tag.uid_hex) = upper(request.uid_hex)
     AND tag.status::text = 'active'
     AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
    JOIN events event
      ON event.id = request.source_event_id
     AND event.created_at = request.source_event_created_at
     AND event.tenant_id = request.tenant_id
     AND event.batch_id = batch.id
     AND event.tag_id::text = tag.id::text
     AND upper(event.uid_hex) = upper(request.uid_hex)
     AND upper(event.bid) = upper(request.bid)
     AND event.cmac_ok IS TRUE
     AND event.allowlisted IS TRUE
     AND upper(COALESCE(event.result, '')) = 'VALID'
    WHERE batch.id = request.batch_id
      AND batch.tenant_id = request.tenant_id
      AND upper(batch.bid) = upper(request.bid)
      AND batch.status::text IN ('active', 'active_in_market')
      AND batch.supplier_order_id IS NULL
      AND batch.supplier_sub_batch_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM supplier_sub_batches sub_batch
        WHERE sub_batch.batch_id = batch.id
           OR (sub_batch.tenant_id = batch.tenant_id AND upper(sub_batch.bid) = upper(batch.bid))
      )
  );

-- A historical anchor which cannot be proven to belong to an exact verified
-- asset tuple is not a final chain receipt. Preserve all transaction metadata
-- for investigation, but block automatic retry and all live presentation.
UPDATE tokenization_requests request
SET status = 'reconciling',
    next_attempt_at = NULL,
    last_error = 'tokenization_historical_anchor_scope_unverified',
    meta = COALESCE(request.meta, '{}'::jsonb) || jsonb_build_object(
      'automatic_retry_blocked', true,
      'reconciliation_required', true,
      'historical_status', 'anchored'
    )
WHERE request.execution_class = 'legacy_unclassified'
  AND request.status = 'anchored'
  AND lower(COALESCE(request.network, '')) <> 'simulation'
  AND lower(COALESCE(request.meta->>'simulated', 'false')) <> 'true';

-- A historical failed/processing row may have crossed the external-call
-- boundary. It is not safe to make it retryable merely because a lease is
-- absent. Reconciliation is conservative and preserves all evidence.
UPDATE tokenization_requests
SET status = 'reconciling',
    next_attempt_at = NULL,
    last_error = 'tokenization_execution_reconciliation_required',
    meta = COALESCE(meta, '{}'::jsonb)
      || '{"automatic_retry_blocked":true,"reconciliation_required":true}'::jsonb
WHERE execution_class IN ('testnet_trial', 'live_chain')
  AND (
    (status = 'failed' AND COALESCE(attempt_count, 0) > 0)
    OR (status = 'processing' AND lease_id IS NULL)
  );

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, tag_id, execution_class, lower(network)
      ORDER BY
        CASE status
          WHEN 'anchored' THEN 0
          WHEN 'processing' THEN 1
          WHEN 'pending' THEN 2
          WHEN 'reconciling' THEN 3
          ELSE 4
        END,
        requested_at,
        id
    ) AS position
  FROM tokenization_requests
  WHERE tenant_id IS NOT NULL
    AND tag_id IS NOT NULL
    AND execution_class IN ('testnet_trial', 'live_chain')
)
UPDATE tokenization_requests request
SET status = 'reconciling',
    execution_class = 'legacy_unclassified',
    next_attempt_at = NULL,
    last_error = 'tokenization_duplicate_asset_requires_reconciliation',
    meta = COALESCE(request.meta, '{}'::jsonb)
      || '{"automatic_retry_blocked":true,"duplicate_asset_reconciliation_required":true}'::jsonb
FROM ranked
WHERE request.id = ranked.id
  AND ranked.position > 1;

WITH ownership_candidates AS (
  SELECT
    offer.id AS offer_id,
    ownership.id AS ownership_id,
    count(*) OVER (PARTITION BY offer.id) AS match_count
  FROM marketplace_offers offer
  JOIN consumer_product_ownerships ownership
    ON ownership.tenant_id = offer.tenant_id
   AND ownership.consumer_id = offer.seller_consumer_id
   AND upper(ownership.uid_hex) = upper(offer.resale_uid_hex)
   AND ownership.status = 'claimed'
  JOIN tags tag
    ON tag.id = ownership.tag_id
   AND tag.batch_id = ownership.batch_id
   AND upper(tag.uid_hex) = upper(ownership.uid_hex)
   AND tag.status::text = 'active'
   AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
  JOIN batches batch
    ON batch.id = ownership.batch_id
   AND batch.tenant_id = ownership.tenant_id
   AND batch.status::text IN ('active', 'active_in_market')
   AND batch.supplier_order_id IS NULL
   AND batch.supplier_sub_batch_id IS NULL
  JOIN events event
    ON event.id = ownership.event_id
   AND event.tenant_id = ownership.tenant_id
   AND event.batch_id = ownership.batch_id
   AND event.tag_id::text = ownership.tag_id::text
   AND upper(event.uid_hex) = upper(ownership.uid_hex)
   AND upper(event.bid) = upper(batch.bid)
   AND event.cmac_ok IS TRUE
   AND event.allowlisted IS TRUE
   AND upper(COALESCE(event.result, '')) = 'VALID'
  WHERE offer.type = 'p2p_resale'
    AND offer.ownership_id IS NULL
    AND offer.seller_consumer_id IS NOT NULL
    AND NULLIF(trim(offer.resale_uid_hex), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM supplier_sub_batches sub_batch
      WHERE sub_batch.batch_id = batch.id
         OR (sub_batch.tenant_id = batch.tenant_id AND upper(sub_batch.bid) = upper(batch.bid))
    )
)
UPDATE marketplace_offers offer
SET ownership_id = candidate.ownership_id
FROM ownership_candidates candidate
WHERE offer.id = candidate.offer_id
  AND candidate.match_count = 1;

-- NOT VALID constraints protect future writes only. Quarantine every legacy
-- active resale which is not backed by one unambiguous, currently eligible,
-- cryptographically valid ownership tuple. The row and its evidence remain.
UPDATE marketplace_offers offer
SET status = 'inactive',
    updated_at = now(),
    eligibility_json = COALESCE(offer.eligibility_json, '{}'::jsonb) || jsonb_build_object(
      'inactive_reason', 'ownership_scope_not_currently_eligible',
      'inactive_by_migration', '0072'
    )
WHERE offer.type = 'p2p_resale'
  AND offer.status = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM consumer_product_ownerships ownership
    JOIN tags tag
      ON tag.id = ownership.tag_id
     AND tag.batch_id = ownership.batch_id
     AND upper(tag.uid_hex) = upper(ownership.uid_hex)
     AND tag.status::text = 'active'
     AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
    JOIN batches batch
      ON batch.id = ownership.batch_id
     AND batch.tenant_id = ownership.tenant_id
     AND batch.status::text IN ('active', 'active_in_market')
     AND batch.supplier_order_id IS NULL
     AND batch.supplier_sub_batch_id IS NULL
    WHERE ownership.id = offer.ownership_id
      AND ownership.tenant_id = offer.tenant_id
      AND ownership.consumer_id = offer.seller_consumer_id
      AND ownership.status = 'claimed'
      AND upper(ownership.uid_hex) = upper(offer.resale_uid_hex)
      AND NOT EXISTS (
        SELECT 1
        FROM supplier_sub_batches sub_batch
        WHERE sub_batch.batch_id = batch.id
           OR (sub_batch.tenant_id = batch.tenant_id AND upper(sub_batch.bid) = upper(batch.bid))
      )
      AND (
        SELECT count(*)
        FROM events event
        WHERE event.id = ownership.event_id
          AND event.tenant_id = ownership.tenant_id
          AND event.batch_id = ownership.batch_id
          AND event.tag_id::text = ownership.tag_id::text
          AND upper(event.uid_hex) = upper(ownership.uid_hex)
          AND upper(event.bid) = upper(batch.bid)
          AND event.cmac_ok IS TRUE
          AND event.allowlisted IS TRUE
          AND upper(COALESCE(event.result, '')) = 'VALID'
      ) = 1
  );

WITH attribution_candidates AS (
  SELECT
    request.id AS request_id,
    tag.id AS tag_id,
    event.created_at AS event_created_at,
    count(*) OVER (PARTITION BY request.id) AS match_count
  FROM marketplace_order_requests request
  JOIN batches batch
    ON batch.id = request.source_batch_id
   AND batch.tenant_id = request.tenant_id
   AND upper(batch.bid) = upper(request.source_bid)
  JOIN tags tag
    ON tag.batch_id = batch.id
   AND upper(tag.uid_hex) = upper(request.source_uid_hex)
  JOIN events event
    ON event.id = request.source_tap_event_id
   AND event.tenant_id = request.tenant_id
   AND event.batch_id = batch.id
   AND upper(event.bid) = upper(request.source_bid)
   AND upper(event.uid_hex) = upper(request.source_uid_hex)
   AND event.tag_id::text = tag.id::text
  WHERE request.source_tap_event_id IS NOT NULL
    AND request.source_batch_id IS NOT NULL
    AND NULLIF(trim(request.source_bid), '') IS NOT NULL
    AND NULLIF(trim(request.source_uid_hex), '') IS NOT NULL
)
UPDATE marketplace_order_requests request
SET source_tag_id = candidate.tag_id,
    source_tap_event_created_at = candidate.event_created_at
FROM attribution_candidates candidate
WHERE request.id = candidate.request_id
  AND candidate.match_count = 1
  AND (request.source_tag_id IS NULL OR request.source_tap_event_created_at IS NULL);

UPDATE order_requests request
SET tenant_id = lead.tenant_id
FROM leads lead
WHERE request.tenant_id IS NULL
  AND request.lead_id = lead.id
  AND lead.tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tokenization_request_asset_execution
  ON tokenization_requests (tenant_id, tag_id, execution_class, lower(network))
  WHERE tenant_id IS NOT NULL
    AND tag_id IS NOT NULL
    AND execution_class IN ('testnet_trial', 'live_chain');

CREATE INDEX IF NOT EXISTS idx_tokenization_request_source_event
  ON tokenization_requests (source_event_id, source_event_created_at);
CREATE INDEX IF NOT EXISTS idx_tokenization_request_lease
  ON tokenization_requests (status, lease_expires_at)
  WHERE status IN ('processing', 'reconciling');
CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_active_p2p_ownership
  ON marketplace_offers (tenant_id, ownership_id)
  WHERE type = 'p2p_resale' AND status = 'active' AND ownership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_request_source_asset
  ON marketplace_order_requests (tenant_id, source_batch_id, source_tag_id, source_tap_event_id);
CREATE INDEX IF NOT EXISTS idx_order_requests_tenant_created_at
  ON order_requests (tenant_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_execution_class_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_execution_class_check
      CHECK (execution_class IN ('legacy_unclassified', 'simulation', 'testnet_trial', 'live_chain')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_execution_status_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_execution_status_check
      CHECK (status IN ('pending', 'processing', 'reconciling', 'anchored', 'failed', 'simulated', 'blocked')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_source_event_identity_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_source_event_identity_check
      CHECK ((source_event_id IS NULL) = (source_event_created_at IS NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_lease_identity_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_lease_identity_check CHECK (
      (lease_id IS NULL AND lease_owner IS NULL AND lease_acquired_at IS NULL AND lease_expires_at IS NULL)
      OR (
        lease_id IS NOT NULL AND NULLIF(trim(lease_owner), '') IS NOT NULL
        AND lease_acquired_at IS NOT NULL AND lease_expires_at > lease_acquired_at
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_execution_tuple_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_execution_tuple_check CHECK (
      execution_class = 'legacy_unclassified'
      OR (
        tenant_id IS NOT NULL AND batch_id IS NOT NULL
        AND NULLIF(trim(bid), '') IS NOT NULL AND NULLIF(trim(uid_hex), '') IS NOT NULL
        AND source_event_id IS NOT NULL AND source_event_created_at IS NOT NULL
        AND (execution_class = 'simulation' OR tag_id IS NOT NULL)
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_network_class_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_network_class_check CHECK (
      execution_class = 'legacy_unclassified'
      OR (execution_class = 'simulation' AND lower(network) = 'simulation')
      OR (execution_class = 'testnet_trial' AND lower(network) IN ('polygon-amoy', 'ethereum-sepolia', 'base-sepolia'))
      OR (execution_class = 'live_chain' AND lower(network) IN ('polygon', 'ethereum-mainnet', 'base-mainnet'))
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_simulation_truth_check') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_simulation_truth_check CHECK (
      execution_class <> 'simulation'
      OR (
        status <> 'anchored'
        AND tx_hash IS NULL AND token_id IS NULL AND anchor_hash IS NULL
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_tag_fkey') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_tag_fkey
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tokenization_source_event_fkey') THEN
    ALTER TABLE tokenization_requests ADD CONSTRAINT tokenization_source_event_fkey
      FOREIGN KEY (source_event_id, source_event_created_at)
      REFERENCES events(id, created_at) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_offer_seller_fkey') THEN
    ALTER TABLE marketplace_offers ADD CONSTRAINT marketplace_offer_seller_fkey
      FOREIGN KEY (seller_consumer_id) REFERENCES consumers(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_offer_ownership_fkey') THEN
    ALTER TABLE marketplace_offers ADD CONSTRAINT marketplace_offer_ownership_fkey
      FOREIGN KEY (ownership_id) REFERENCES consumer_product_ownerships(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_p2p_active_scope_check') THEN
    ALTER TABLE marketplace_offers ADD CONSTRAINT marketplace_p2p_active_scope_check CHECK (
      type <> 'p2p_resale' OR status <> 'active'
      OR (
        ownership_id IS NOT NULL AND seller_consumer_id IS NOT NULL
        AND NULLIF(trim(resale_uid_hex), '') IS NOT NULL
        AND resale_price > 0 AND resale_currency IN ('ARS', 'BRL', 'EUR', 'USD')
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_request_source_tuple_check') THEN
    ALTER TABLE marketplace_order_requests ADD CONSTRAINT marketplace_request_source_tuple_check CHECK (
      (
        source_tap_event_id IS NULL AND source_tap_event_created_at IS NULL
        AND source_batch_id IS NULL AND source_tag_id IS NULL
        AND source_uid_hex IS NULL AND source_bid IS NULL
      )
      OR (
        source_tap_event_id IS NOT NULL AND source_tap_event_created_at IS NOT NULL
        AND source_batch_id IS NOT NULL AND source_tag_id IS NOT NULL
        AND NULLIF(trim(source_uid_hex), '') IS NOT NULL
        AND NULLIF(trim(source_bid), '') IS NOT NULL
      )
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_request_source_batch_fkey') THEN
    ALTER TABLE marketplace_order_requests ADD CONSTRAINT marketplace_request_source_batch_fkey
      FOREIGN KEY (source_batch_id) REFERENCES batches(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_request_source_tag_fkey') THEN
    ALTER TABLE marketplace_order_requests ADD CONSTRAINT marketplace_request_source_tag_fkey
      FOREIGN KEY (source_tag_id) REFERENCES tags(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_request_source_event_fkey') THEN
    ALTER TABLE marketplace_order_requests ADD CONSTRAINT marketplace_request_source_event_fkey
      FOREIGN KEY (source_tap_event_id, source_tap_event_created_at)
      REFERENCES events(id, created_at) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_request_tenant_fkey') THEN
    ALTER TABLE order_requests ADD CONSTRAINT order_request_tenant_fkey
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_crm_request_tenant_check') THEN
    ALTER TABLE order_requests ADD CONSTRAINT marketplace_crm_request_tenant_check
      CHECK (source <> 'marketplace' OR tenant_id IS NOT NULL) NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.nexid_tokenization_execution_scope_guard_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch record;
  v_tag record;
  v_event record;
  v_supplier_purpose text;
  v_supplier_sub_batch_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'processing' THEN
      IF NEW.status NOT IN ('processing', 'anchored', 'reconciling') THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_processing_transition_invalid';
      END IF;
      IF OLD.lease_id IS NULL OR NEW.lease_id IS DISTINCT FROM OLD.lease_id THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_processing_lease_changed';
      END IF;
    ELSIF OLD.status = 'reconciling' THEN
      IF NEW.status NOT IN ('reconciling', 'anchored') THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_reconciliation_retry_forbidden';
      END IF;
      IF NEW.status = 'anchored'
        AND (OLD.lease_id IS NULL OR NEW.lease_id IS DISTINCT FROM OLD.lease_id) THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_reconciliation_lease_required';
      END IF;
    ELSIF OLD.status IN ('anchored', 'simulated') AND (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
      OR NEW.tag_id IS DISTINCT FROM OLD.tag_id
      OR NEW.source_event_id IS DISTINCT FROM OLD.source_event_id
      OR NEW.source_event_created_at IS DISTINCT FROM OLD.source_event_created_at
      OR NEW.bid IS DISTINCT FROM OLD.bid
      OR NEW.uid_hex IS DISTINCT FROM OLD.uid_hex
      OR NEW.execution_class IS DISTINCT FROM OLD.execution_class
      OR NEW.network IS DISTINCT FROM OLD.network
      OR NEW.tx_hash IS DISTINCT FROM OLD.tx_hash
      OR NEW.token_id IS DISTINCT FROM OLD.token_id
      OR NEW.anchor_hash IS DISTINCT FROM OLD.anchor_hash
      OR NEW.external_ref IS DISTINCT FROM OLD.external_ref
      OR NEW.meta IS DISTINCT FROM OLD.meta
      OR NEW.lease_id IS DISTINCT FROM OLD.lease_id
      OR NEW.lease_owner IS DISTINCT FROM OLD.lease_owner
      OR NEW.lease_acquired_at IS DISTINCT FROM OLD.lease_acquired_at
      OR NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_terminal_state_immutable';
    END IF;

    IF (OLD.tx_hash IS NOT NULL AND NEW.tx_hash IS DISTINCT FROM OLD.tx_hash)
      OR (OLD.token_id IS NOT NULL AND NEW.token_id IS DISTINCT FROM OLD.token_id)
      OR (OLD.anchor_hash IS NOT NULL AND NEW.anchor_hash IS DISTINCT FROM OLD.anchor_hash)
      OR (OLD.external_ref IS NOT NULL AND NEW.external_ref IS DISTINCT FROM OLD.external_ref)
      OR (OLD.lease_id IS NOT NULL AND NEW.lease_id IS DISTINCT FROM OLD.lease_id)
      OR (OLD.lease_owner IS NOT NULL AND NEW.lease_owner IS DISTINCT FROM OLD.lease_owner)
      OR (OLD.lease_acquired_at IS NOT NULL AND NEW.lease_acquired_at IS DISTINCT FROM OLD.lease_acquired_at)
      OR (OLD.lease_expires_at IS NOT NULL AND NEW.lease_expires_at IS DISTINCT FROM OLD.lease_expires_at)
      OR (
        COALESCE(OLD.meta, '{}'::jsonb) ? 'dispatch_started_at'
        AND (
          NOT (COALESCE(NEW.meta, '{}'::jsonb) ? 'dispatch_started_at')
          OR NEW.meta->'dispatch_started_at' IS DISTINCT FROM OLD.meta->'dispatch_started_at'
        )
      ) THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_execution_evidence_immutable';
    END IF;
  END IF;

  NEW.execution_class := COALESCE(NULLIF(trim(NEW.execution_class), ''), 'legacy_unclassified');
  IF NEW.status NOT IN ('pending', 'processing', 'reconciling', 'anchored', 'failed', 'simulated', 'blocked') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tokenization_execution_status_invalid';
  END IF;
  IF NEW.execution_class NOT IN ('legacy_unclassified', 'simulation', 'testnet_trial', 'live_chain') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tokenization_execution_class_invalid';
  END IF;
  IF NEW.execution_class = 'legacy_unclassified' THEN
    IF NEW.status IN ('processing', 'anchored') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_execution_class_unclassified';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.execution_class = 'simulation' THEN
    IF lower(COALESCE(NEW.network, '')) <> 'simulation'
      OR NEW.status = 'anchored'
      OR NEW.tx_hash IS NOT NULL OR NEW.token_id IS NOT NULL OR NEW.anchor_hash IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_simulation_live_claim_forbidden';
    END IF;
  ELSIF NEW.execution_class = 'testnet_trial' THEN
    IF lower(COALESCE(NEW.network, '')) NOT IN ('polygon-amoy', 'ethereum-sepolia', 'base-sepolia') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_testnet_network_invalid';
    END IF;
  ELSIF lower(COALESCE(NEW.network, '')) NOT IN ('polygon', 'ethereum-mainnet', 'base-mainnet') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_live_network_invalid';
  END IF;

  IF NEW.status = 'anchored' THEN
    IF TG_OP <> 'UPDATE' OR OLD.status NOT IN ('processing', 'reconciling', 'anchored') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_anchor_transition_invalid';
    END IF;
    IF NEW.execution_class NOT IN ('testnet_trial', 'live_chain')
      OR lower(COALESCE(NEW.meta->>'evidence_verified', 'false')) <> 'true'
      OR NULLIF(trim(NEW.tx_hash), '') IS NULL
      OR NULLIF(trim(NEW.token_id), '') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_anchor_evidence_required';
    END IF;
  END IF;

  IF NEW.tenant_id IS NULL OR NEW.batch_id IS NULL
    OR NULLIF(trim(NEW.bid), '') IS NULL OR NULLIF(trim(NEW.uid_hex), '') IS NULL
    OR NEW.source_event_id IS NULL OR NEW.source_event_created_at IS NULL
    OR (NEW.execution_class <> 'simulation' AND NEW.tag_id IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'tokenization_execution_scope_required';
  END IF;
  SELECT batch.status::text, batch.supplier_order_id, batch.supplier_sub_batch_id
    INTO v_batch
  FROM batches batch
  WHERE batch.id = NEW.batch_id
    AND batch.tenant_id = NEW.tenant_id
    AND upper(batch.bid) = upper(NEW.bid)
  FOR KEY SHARE OF batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tokenization_batch_scope_invalid';
  END IF;
  IF NEW.tag_id IS NOT NULL THEN
    SELECT tag.status::text, tag.lifecycle_state
      INTO v_tag
    FROM tags tag
    WHERE tag.id = NEW.tag_id
      AND tag.batch_id = NEW.batch_id
      AND upper(tag.uid_hex) = upper(NEW.uid_hex)
    FOR KEY SHARE OF tag;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tokenization_tag_scope_invalid';
    END IF;
  END IF;
  SELECT event.cmac_ok, event.allowlisted, event.result, event.tag_id
    INTO v_event
  FROM events event
  WHERE event.id = NEW.source_event_id
    AND event.created_at = NEW.source_event_created_at
    AND event.tenant_id = NEW.tenant_id
    AND event.batch_id = NEW.batch_id
    AND upper(event.uid_hex) = upper(NEW.uid_hex)
    AND upper(event.bid) = upper(NEW.bid)
  FOR KEY SHARE OF event;
  IF NOT FOUND
    OR (NEW.tag_id IS NOT NULL AND v_event.tag_id::text IS DISTINCT FROM NEW.tag_id::text) THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'tokenization_event_scope_invalid';
  END IF;
  IF NEW.execution_class IN ('testnet_trial', 'live_chain')
    AND (
      v_event.cmac_ok IS DISTINCT FROM true
      OR v_event.allowlisted IS DISTINCT FROM true
      OR upper(COALESCE(v_event.result, '')) <> 'VALID'
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_verified_event_required';
  END IF;
  IF NEW.execution_class IN ('testnet_trial', 'live_chain')
    AND NEW.status IN ('pending', 'processing', 'anchored') THEN
    IF v_batch.status NOT IN ('active', 'active_in_market')
      OR v_tag.status IS DISTINCT FROM 'active'
      OR (v_tag.lifecycle_state IS NOT NULL AND v_tag.lifecycle_state <> 'active') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_asset_not_execution_eligible';
    END IF;
  END IF;
  IF NEW.execution_class = 'testnet_trial'
    AND NEW.status IN ('pending', 'processing', 'anchored') THEN
    SELECT count(*)::integer
      INTO v_supplier_sub_batch_count
    FROM supplier_sub_batches sub_batch
    WHERE sub_batch.batch_id = NEW.batch_id
       OR (v_batch.supplier_sub_batch_id IS NOT NULL AND sub_batch.id = v_batch.supplier_sub_batch_id)
       OR (sub_batch.tenant_id = NEW.tenant_id AND upper(sub_batch.bid) = upper(NEW.bid));
    IF v_batch.supplier_order_id IS NULL
      AND v_batch.supplier_sub_batch_id IS NULL
      AND v_supplier_sub_batch_count = 0 THEN
      NULL;
    ELSIF v_batch.supplier_order_id IS NULL
      OR v_batch.supplier_sub_batch_id IS NULL
      OR v_supplier_sub_batch_count <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_testnet_trial_scope_required';
    ELSE
      v_supplier_purpose := public.nexid_effective_supplier_pack_purpose_v1(v_batch.supplier_order_id);
      IF v_supplier_purpose IS DISTINCT FROM 'trial_integration' THEN
        RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_testnet_trial_scope_required';
      END IF;
    END IF;
  ELSIF NEW.execution_class = 'live_chain'
    AND NEW.status IN ('pending', 'processing', 'anchored') THEN
    PERFORM public.nexid_assert_supplier_commercial_release_v1(NEW.batch_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_tokenization_execution_scope_v1 ON tokenization_requests;
CREATE TRIGGER trg_nexid_tokenization_execution_scope_v1
  BEFORE INSERT OR UPDATE OF tenant_id, batch_id, tag_id, source_event_id,
    source_event_created_at, bid, uid_hex, execution_class, status, network,
    tx_hash, token_id, anchor_hash, external_ref, meta,
    lease_id, lease_owner, lease_acquired_at, lease_expires_at
  ON tokenization_requests
  FOR EACH ROW EXECUTE FUNCTION public.nexid_tokenization_execution_scope_guard_v1();

CREATE OR REPLACE FUNCTION public.nexid_marketplace_request_asset_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_any boolean;
BEGIN
  v_any := NEW.source_tap_event_id IS NOT NULL OR NEW.source_tap_event_created_at IS NOT NULL
    OR NEW.source_batch_id IS NOT NULL OR NEW.source_tag_id IS NOT NULL
    OR NEW.source_uid_hex IS NOT NULL OR NEW.source_bid IS NOT NULL;
  IF NOT v_any THEN
    RETURN NEW;
  END IF;
  IF NEW.source_tap_event_id IS NULL OR NEW.source_tap_event_created_at IS NULL
    OR NEW.source_batch_id IS NULL OR NEW.source_tag_id IS NULL
    OR NULLIF(trim(NEW.source_uid_hex), '') IS NULL OR NULLIF(trim(NEW.source_bid), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'marketplace_request_source_tuple_incomplete';
  END IF;
  PERFORM 1
  FROM batches batch
  JOIN tags tag
    ON tag.id = NEW.source_tag_id
   AND tag.batch_id = batch.id
   AND upper(tag.uid_hex) = upper(NEW.source_uid_hex)
  JOIN events event
    ON event.id = NEW.source_tap_event_id
   AND event.created_at = NEW.source_tap_event_created_at
   AND event.tenant_id = NEW.tenant_id
   AND event.batch_id = batch.id
   AND event.tag_id::text = tag.id::text
   AND upper(event.uid_hex) = upper(NEW.source_uid_hex)
   AND upper(event.bid) = upper(NEW.source_bid)
  WHERE batch.id = NEW.source_batch_id
    AND batch.tenant_id = NEW.tenant_id
    AND upper(batch.bid) = upper(NEW.source_bid)
  FOR KEY SHARE OF batch, tag, event;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'marketplace_request_source_scope_invalid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_marketplace_request_asset_scope_v1 ON marketplace_order_requests;
CREATE TRIGGER trg_nexid_marketplace_request_asset_scope_v1
  BEFORE INSERT OR UPDATE OF tenant_id, source_tap_event_id, source_tap_event_created_at,
    source_batch_id, source_tag_id, source_uid_hex, source_bid
  ON marketplace_order_requests
  FOR EACH ROW EXECUTE FUNCTION public.nexid_marketplace_request_asset_scope_v1();

CREATE OR REPLACE FUNCTION public.nexid_marketplace_offer_asset_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_batch_id uuid;
BEGIN
  IF NEW.type <> 'p2p_resale' OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  IF NEW.ownership_id IS NULL OR NEW.seller_consumer_id IS NULL
    OR NULLIF(trim(NEW.resale_uid_hex), '') IS NULL
    OR NEW.resale_price IS NULL OR NEW.resale_price <= 0
    OR NEW.resale_currency NOT IN ('ARS', 'BRL', 'EUR', 'USD') THEN
    RAISE EXCEPTION USING ERRCODE = '23502', MESSAGE = 'marketplace_p2p_ownership_scope_required';
  END IF;
  SELECT ownership.batch_id
    INTO v_batch_id
  FROM consumer_product_ownerships ownership
  JOIN tags tag
    ON tag.id = ownership.tag_id
   AND tag.batch_id = ownership.batch_id
   AND upper(tag.uid_hex) = upper(ownership.uid_hex)
   AND tag.status::text = 'active'
   AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
  JOIN batches batch
    ON batch.id = ownership.batch_id
    AND batch.tenant_id = ownership.tenant_id
   AND batch.status::text IN ('active', 'active_in_market')
  WHERE ownership.id = NEW.ownership_id
    AND ownership.tenant_id = NEW.tenant_id
    AND ownership.consumer_id = NEW.seller_consumer_id
    AND ownership.status = 'claimed'
    AND upper(ownership.uid_hex) = upper(NEW.resale_uid_hex)
    AND (
      SELECT count(*)
      FROM events event
      WHERE event.id = ownership.event_id
        AND event.tenant_id = ownership.tenant_id
        AND event.batch_id = ownership.batch_id
        AND event.tag_id::text = ownership.tag_id::text
        AND upper(event.uid_hex) = upper(ownership.uid_hex)
        AND upper(event.bid) = upper(batch.bid)
        AND event.cmac_ok IS TRUE
        AND event.allowlisted IS TRUE
        AND upper(COALESCE(event.result, '')) = 'VALID'
    ) = 1
  FOR KEY SHARE OF ownership, tag, batch;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'marketplace_p2p_ownership_scope_invalid';
  END IF;
  PERFORM public.nexid_assert_supplier_commercial_release_v1(v_batch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_marketplace_offer_asset_scope_v1 ON marketplace_offers;
CREATE TRIGGER trg_nexid_marketplace_offer_asset_scope_v1
  BEFORE INSERT OR UPDATE OF tenant_id, ownership_id, seller_consumer_id,
    resale_uid_hex, resale_price, resale_currency, type, status
  ON marketplace_offers
  FOR EACH ROW EXECUTE FUNCTION public.nexid_marketplace_offer_asset_scope_v1();

CREATE OR REPLACE FUNCTION public.nexid_marketplace_ownership_offer_invalidation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'claimed' AND (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.tag_id IS DISTINCT FROM OLD.tag_id
    OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
    OR NEW.consumer_id IS DISTINCT FROM OLD.consumer_id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.uid_hex IS DISTINCT FROM OLD.uid_hex
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
  ) THEN
    UPDATE marketplace_offers offer
    SET status = 'inactive',
        updated_at = now(),
        eligibility_json = COALESCE(offer.eligibility_json, '{}'::jsonb) || jsonb_build_object(
          'inactive_reason', 'ownership_no_longer_claimed',
          'ownership_id', OLD.id
        )
    WHERE offer.ownership_id = OLD.id
      AND offer.type = 'p2p_resale'
      AND offer.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_marketplace_ownership_offer_invalidation_v1 ON consumer_product_ownerships;
CREATE TRIGGER trg_nexid_marketplace_ownership_offer_invalidation_v1
  AFTER UPDATE OF status, tag_id, batch_id, consumer_id, tenant_id, uid_hex, event_id
  ON consumer_product_ownerships
  FOR EACH ROW EXECUTE FUNCTION public.nexid_marketplace_ownership_offer_invalidation_v1();

CREATE OR REPLACE FUNCTION public.nexid_marketplace_tag_offer_invalidation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text <> 'active'
    OR (NEW.lifecycle_state IS NOT NULL AND NEW.lifecycle_state <> 'active') THEN
    UPDATE marketplace_offers offer
    SET status = 'inactive',
        updated_at = now(),
        eligibility_json = COALESCE(offer.eligibility_json, '{}'::jsonb) || jsonb_build_object(
          'inactive_reason', 'tag_no_longer_marketplace_eligible',
          'tag_id', NEW.id,
          'tag_status', NEW.status::text,
          'tag_lifecycle_state', NEW.lifecycle_state
        )
    FROM consumer_product_ownerships ownership
    WHERE ownership.tag_id = NEW.id
      AND ownership.batch_id = NEW.batch_id
      AND ownership.status = 'claimed'
      AND offer.ownership_id = ownership.id
      AND offer.tenant_id = ownership.tenant_id
      AND offer.type = 'p2p_resale'
      AND offer.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_marketplace_tag_offer_invalidation_v1 ON tags;
CREATE TRIGGER trg_nexid_marketplace_tag_offer_invalidation_v1
  AFTER UPDATE OF status, lifecycle_state
  ON tags
  FOR EACH ROW EXECUTE FUNCTION public.nexid_marketplace_tag_offer_invalidation_v1();

CREATE OR REPLACE FUNCTION public.nexid_marketplace_batch_offer_invalidation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status::text NOT IN ('active', 'active_in_market') THEN
    UPDATE marketplace_offers offer
    SET status = 'inactive',
        updated_at = now(),
        eligibility_json = COALESCE(offer.eligibility_json, '{}'::jsonb) || jsonb_build_object(
          'inactive_reason', 'batch_no_longer_marketplace_eligible',
          'batch_id', NEW.id,
          'batch_status', NEW.status::text
        )
    FROM consumer_product_ownerships ownership
    WHERE ownership.batch_id = NEW.id
      AND ownership.tenant_id = NEW.tenant_id
      AND ownership.status = 'claimed'
      AND offer.ownership_id = ownership.id
      AND offer.tenant_id = ownership.tenant_id
      AND offer.type = 'p2p_resale'
      AND offer.status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nexid_marketplace_batch_offer_invalidation_v1 ON batches;
CREATE TRIGGER trg_nexid_marketplace_batch_offer_invalidation_v1
  AFTER UPDATE OF status
  ON batches
  FOR EACH ROW EXECUTE FUNCTION public.nexid_marketplace_batch_offer_invalidation_v1();

CREATE OR REPLACE FUNCTION public.nexid_prepare_tokenization_execution_v1(
  p_tenant_id uuid,
  p_request_id uuid,
  p_lease_id uuid,
  p_processor text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  request_id uuid,
  tenant_id uuid,
  disposition text,
  execution_class text,
  network text,
  status text,
  lease_id uuid,
  lease_expires_at timestamptz,
  batch_id uuid,
  tag_id uuid,
  bid text,
  uid_hex text,
  source_event_id bigint,
  source_event_created_at timestamptz,
  commercial_disposition text,
  external_call_allowed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request tokenization_requests%ROWTYPE;
  v_supplier_order_id uuid;
  v_supplier_sub_batch_id uuid;
  v_supplier_sub_batch_count integer;
  v_supplier_purpose text;
  v_supplier_scope_present boolean := false;
  v_current_asset_eligible boolean := false;
  v_now timestamptz := clock_timestamp();
  v_commercial_disposition text;
BEGIN
  IF p_tenant_id IS NULL OR p_request_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tokenization_execution_identity_required';
  END IF;
  IF p_processor IS NULL OR p_processor !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tokenization_execution_processor_invalid';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 30 OR p_lease_seconds > 300 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'tokenization_execution_lease_invalid';
  END IF;

  SELECT request.* INTO v_request
  FROM tokenization_requests request
  WHERE request.id = p_request_id
    AND request.tenant_id = p_tenant_id
  FOR UPDATE OF request;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'tokenization_execution_request_not_found';
  END IF;

  IF v_request.execution_class = 'simulation' OR v_request.status = 'simulated' THEN
    RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'simulation_only'::text,
      v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
      v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
      v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
      'NON_SELLABLE'::text, false;
    RETURN;
  END IF;
  IF v_request.status = 'processing' THEN
    IF v_request.lease_id = p_lease_id AND v_request.lease_expires_at > v_now THEN
      RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'lease_replay'::text,
        v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
        v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
        v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
        CASE WHEN v_request.execution_class = 'testnet_trial' THEN 'NON_SELLABLE' ELSE 'commercial_release' END,
        false;
      RETURN;
    END IF;
    IF v_request.lease_expires_at > v_now THEN
      RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'busy'::text,
        v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
        v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
        v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
        CASE WHEN v_request.execution_class = 'testnet_trial' THEN 'NON_SELLABLE' ELSE 'commercial_release' END,
        false;
      RETURN;
    END IF;
    UPDATE tokenization_requests request
    SET status = 'reconciling', next_attempt_at = NULL,
        last_error = 'tokenization_execution_reconciliation_required',
        meta = COALESCE(request.meta, '{}'::jsonb)
          || jsonb_build_object('reconciliation_required', true, 'expired_lease_id', request.lease_id)
    WHERE request.id = v_request.id AND request.tenant_id = v_request.tenant_id;
    v_request.status := 'reconciling';
  END IF;
  IF v_request.status IN ('reconciling', 'failed')
    OR (v_request.status = 'pending' AND (
      COALESCE(v_request.attempt_count, 0) > 0
      OR v_request.external_ref IS NOT NULL OR v_request.tx_hash IS NOT NULL OR v_request.token_id IS NOT NULL
      OR v_request.meta ? 'failed_at' OR v_request.meta ? 'dispatch_started_at'
    )) THEN
    IF v_request.status <> 'reconciling' THEN
      UPDATE tokenization_requests request
      SET status = 'reconciling', next_attempt_at = NULL,
          last_error = 'tokenization_execution_reconciliation_required',
          meta = COALESCE(request.meta, '{}'::jsonb) || '{"reconciliation_required":true}'::jsonb
      WHERE request.id = v_request.id AND request.tenant_id = v_request.tenant_id;
      v_request.status := 'reconciling';
    END IF;
    RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'reconcile_required'::text,
      v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
      v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
      v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
      CASE WHEN v_request.execution_class = 'testnet_trial' THEN 'NON_SELLABLE' ELSE 'commercial_release' END,
      false;
    RETURN;
  END IF;
  IF v_request.status NOT IN ('pending', 'anchored') THEN
    RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'already_final'::text,
      v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
      v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
      v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
      CASE WHEN v_request.execution_class = 'testnet_trial' THEN 'NON_SELLABLE' ELSE 'commercial_release' END,
      false;
    RETURN;
  END IF;
  IF v_request.execution_class NOT IN ('testnet_trial', 'live_chain') THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_execution_class_unclassified';
  END IF;
  IF v_request.status = 'anchored' AND (
    lower(COALESCE(v_request.meta->>'evidence_verified', 'false')) <> 'true'
    OR NULLIF(trim(v_request.tx_hash), '') IS NULL
    OR NULLIF(trim(v_request.token_id), '') IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_anchor_evidence_required';
  END IF;

  -- This first lookup proves the immutable historical identity and SUN verdict.
  -- Current lifecycle eligibility is projected separately so revocation cannot
  -- erase a valid, already-anchored proof or authorize a new external call.
  SELECT batch.supplier_order_id, batch.supplier_sub_batch_id,
         COALESCE(batch.status::text IN ('active', 'active_in_market'), false)
           AND COALESCE(tag.status::text = 'active', false)
           AND (tag.lifecycle_state IS NULL OR tag.lifecycle_state = 'active')
    INTO v_supplier_order_id, v_supplier_sub_batch_id, v_current_asset_eligible
  FROM batches batch
  JOIN tags tag
    ON tag.id = v_request.tag_id
   AND tag.batch_id = batch.id
   AND upper(tag.uid_hex) = upper(v_request.uid_hex)
  JOIN events event
    ON event.id = v_request.source_event_id
   AND event.created_at = v_request.source_event_created_at
   AND event.tenant_id = v_request.tenant_id
   AND event.batch_id = batch.id
   AND event.tag_id::text = tag.id::text
   AND upper(event.uid_hex) = upper(v_request.uid_hex)
   AND upper(event.bid) = upper(v_request.bid)
   AND event.cmac_ok IS TRUE
   AND event.allowlisted IS TRUE
   AND upper(COALESCE(event.result, '')) = 'VALID'
  WHERE batch.id = v_request.batch_id
    AND batch.tenant_id = v_request.tenant_id
    AND upper(batch.bid) = upper(v_request.bid)
  FOR KEY SHARE OF batch, tag, event;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_verified_execution_scope_invalid';
  END IF;

  SELECT count(*)::integer
    INTO v_supplier_sub_batch_count
  FROM supplier_sub_batches sub_batch
  WHERE sub_batch.batch_id = v_request.batch_id
     OR (v_supplier_sub_batch_id IS NOT NULL AND sub_batch.id = v_supplier_sub_batch_id)
     OR (sub_batch.tenant_id = v_request.tenant_id AND upper(sub_batch.bid) = upper(v_request.bid));
  IF v_supplier_order_id IS NULL
    AND v_supplier_sub_batch_id IS NULL
    AND v_supplier_sub_batch_count = 0 THEN
    v_supplier_scope_present := false;
  ELSIF v_supplier_order_id IS NULL
    OR v_supplier_sub_batch_id IS NULL
    OR v_supplier_sub_batch_count <> 1
    OR NOT EXISTS (
      SELECT 1
      FROM supplier_sub_batches sub_batch
      WHERE sub_batch.id = v_supplier_sub_batch_id
        AND sub_batch.batch_id = v_request.batch_id
        AND sub_batch.supplier_order_id = v_supplier_order_id
        AND sub_batch.tenant_id = v_request.tenant_id
        AND upper(sub_batch.bid) = upper(v_request.bid)
    ) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_supplier_scope_invalid';
  ELSE
    v_supplier_scope_present := true;
    v_supplier_purpose := public.nexid_effective_supplier_pack_purpose_v1(v_supplier_order_id);
  END IF;

  IF v_request.execution_class = 'testnet_trial' THEN
    IF lower(v_request.network) NOT IN ('polygon-amoy', 'ethereum-sepolia', 'base-sepolia') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_testnet_network_invalid';
    END IF;
    IF v_supplier_scope_present
      AND v_supplier_purpose IS DISTINCT FROM 'trial_integration' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_testnet_trial_scope_required';
    END IF;
    v_commercial_disposition := 'NON_SELLABLE';
  ELSE
    IF lower(v_request.network) NOT IN ('polygon', 'ethereum-mainnet', 'base-mainnet') THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_live_network_invalid';
    END IF;
    IF v_supplier_scope_present
      AND v_supplier_purpose IS DISTINCT FROM 'production' THEN
      RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_live_supplier_scope_required';
    END IF;
    v_commercial_disposition := 'commercial_release';
  END IF;

  IF v_request.status = 'anchored' THEN
    IF NOT v_current_asset_eligible THEN
      v_commercial_disposition := 'REVOKED_HISTORICAL_PROOF';
    ELSIF v_request.execution_class = 'live_chain' THEN
      BEGIN
        PERFORM public.nexid_assert_supplier_commercial_release_v1(v_request.batch_id);
      EXCEPTION
        WHEN SQLSTATE '55000' THEN
          v_commercial_disposition := 'HISTORICAL_PROOF_NOT_CURRENTLY_SELLABLE';
      END;
    END IF;
    RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'already_final'::text,
      v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
      v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
      v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
      v_commercial_disposition, false;
    RETURN;
  END IF;

  IF NOT v_current_asset_eligible THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'tokenization_asset_not_execution_eligible';
  END IF;
  IF v_request.execution_class = 'live_chain' THEN
    PERFORM public.nexid_assert_supplier_commercial_release_v1(v_request.batch_id);
  END IF;

  UPDATE tokenization_requests request
  SET status = 'processing',
      lease_id = p_lease_id,
      lease_owner = p_processor,
      lease_acquired_at = v_now,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      next_attempt_at = NULL,
      last_error = NULL,
      meta = COALESCE(request.meta, '{}'::jsonb) || jsonb_build_object(
        'execution_prepared_at', v_now,
        'execution_processor', p_processor,
        'commercial_disposition', v_commercial_disposition
      )
  WHERE request.id = v_request.id
    AND request.tenant_id = v_request.tenant_id
    AND request.status = 'pending'
  RETURNING request.* INTO v_request;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'tokenization_execution_compare_and_swap_failed';
  END IF;

  RETURN QUERY SELECT v_request.id, v_request.tenant_id, 'acquired'::text,
    v_request.execution_class, v_request.network, v_request.status, v_request.lease_id,
    v_request.lease_expires_at, v_request.batch_id, v_request.tag_id, v_request.bid,
    v_request.uid_hex, v_request.source_event_id, v_request.source_event_created_at,
    v_commercial_disposition, true;
END;
$$;

-- No canonical runtime database role is defined in this repository. Deliberately
-- grant nothing here: PUBLIC is revoked and the release preflight requires the
-- actual deployment role to have EXECUTE (as owner or via an explicit grant).
REVOKE ALL ON FUNCTION public.nexid_tokenization_execution_scope_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_marketplace_request_asset_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_marketplace_offer_asset_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_marketplace_ownership_offer_invalidation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_marketplace_tag_offer_invalidation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_marketplace_batch_offer_invalidation_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_prepare_tokenization_execution_v1(uuid, uuid, uuid, text, integer) FROM PUBLIC;
