BEGIN;

ALTER TABLE iota_executor_publications
  ADD COLUMN IF NOT EXISTS protocol_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS raw_transaction text,
  ADD COLUMN IF NOT EXISTS signer_address text,
  ADD COLUMN IF NOT EXISTS chain_id bigint,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS broadcast_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE iota_executor_publications
  DROP CONSTRAINT IF EXISTS iota_executor_publications_status_check;

-- The 0054 status check does not contain `reserved`; remove it before the
-- monotonic status rewrite, then install the complete v2 constraint below.
UPDATE iota_executor_publications
SET status = 'reserved'
WHERE status = 'processing';

UPDATE iota_executor_publications
SET submitted_at = COALESCE(submitted_at, updated_at)
WHERE status IN ('submitted', 'confirmed');

ALTER TABLE iota_executor_publications
  ADD CONSTRAINT iota_executor_publications_status_check
    CHECK (status IN ('reserved', 'signed', 'broadcast', 'submitted', 'confirmed', 'failed')),
  ADD CONSTRAINT iota_executor_publications_protocol_version_check
    CHECK (protocol_version IN (1, 2)),
  ADD CONSTRAINT iota_executor_publications_payload_hash_check
    CHECK (payload_hash IS NULL OR payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  ADD CONSTRAINT iota_executor_publications_raw_transaction_check
    CHECK (raw_transaction IS NULL OR raw_transaction ~ '^0x[0-9a-f]+$'),
  ADD CONSTRAINT iota_executor_publications_tx_hash_check
    CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$'),
  ADD CONSTRAINT iota_executor_publications_protocol_v2_required_check
    CHECK (
      protocol_version = 1 OR (
        request_id IS NOT NULL
        AND payload_hash IS NOT NULL
        AND lease_token IS NOT NULL
        AND (
          status IN ('reserved', 'failed')
          OR (
            status = 'confirmed'
            AND response_json IS NOT NULL
          )
          OR (
            status IN ('signed', 'broadcast', 'submitted')
            AND raw_transaction IS NOT NULL
            AND tx_hash IS NOT NULL
            AND signer_address IS NOT NULL
            AND chain_id IS NOT NULL
            AND nonce IS NOT NULL
            AND signed_at IS NOT NULL
          )
        )
      )
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_iota_executor_publications_tx_hash
  ON iota_executor_publications (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_iota_executor_publications_lease
  ON iota_executor_publications (status, updated_at)
  WHERE status IN ('reserved', 'signed');

COMMIT;
