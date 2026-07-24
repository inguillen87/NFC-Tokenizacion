ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS public_resource_id text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS contract_version text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS chain_id bigint;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS contract_address text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS publisher_address text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS tenant_id_hash text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS canonicalization_version text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS merkle_algorithm text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS memo_hash text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS memo_json jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS proof_id text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS idempotency_key text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS block_number bigint;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS block_hash text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS confirmations integer NOT NULL DEFAULT 0;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS error_code text;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;
ALTER TABLE evidence_anchors ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS evidence_anchor_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  anchor_id uuid NOT NULL REFERENCES evidence_anchors(id) ON DELETE CASCADE,
  event_id uuid REFERENCES evidence_events(id) ON DELETE RESTRICT,
  event_hash text NOT NULL,
  leaf_index integer NOT NULL CHECK (leaf_index >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anchor_id, leaf_index),
  UNIQUE (anchor_id, event_hash)
);

CREATE TABLE IF NOT EXISTS evidence_anchor_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  anchor_id uuid NOT NULL REFERENCES evidence_anchors(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL CHECK (attempt_no > 0),
  chain_id bigint NOT NULL,
  contract_address text NOT NULL,
  signer_address text,
  nonce bigint,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'confirmed', 'reconciling', 'failed')),
  receipt_status text,
  block_number bigint,
  block_hash text,
  error_code text,
  error_detail_sanitized text,
  submitted_at timestamptz,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (anchor_id, attempt_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchors_iota_proof_id
  ON evidence_anchors (lower(proof_id))
  WHERE provider = 'iota' AND proof_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchors_idempotency_key
  ON evidence_anchors (lower(idempotency_key))
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchors_tx_hash
  ON evidence_anchors (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchor_attempts_tx_hash
  ON evidence_anchor_attempts (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchor_attempts_signer_nonce
  ON evidence_anchor_attempts (chain_id, lower(signer_address), nonce)
  WHERE signer_address IS NOT NULL AND nonce IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_anchors_reconciliation
  ON evidence_anchors (status, next_attempt_at, updated_at)
  WHERE provider = 'iota' AND status IN ('pending', 'submitted', 'reconciling');

CREATE INDEX IF NOT EXISTS idx_evidence_anchor_members_event
  ON evidence_anchor_members (event_id, anchor_id)
  WHERE event_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_anchors_iota_v2_proof_id_format'
  ) THEN
    ALTER TABLE evidence_anchors ADD CONSTRAINT evidence_anchors_iota_v2_proof_id_format
      CHECK (proof_id IS NULL OR proof_id ~ '^0x[0-9a-fA-F]{64}$') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_anchors_iota_v2_memo_hash_format'
  ) THEN
    ALTER TABLE evidence_anchors ADD CONSTRAINT evidence_anchors_iota_v2_memo_hash_format
      CHECK (memo_hash IS NULL OR memo_hash ~ '^sha256:[0-9a-fA-F]{64}$') NOT VALID;
  END IF;
END $$;
