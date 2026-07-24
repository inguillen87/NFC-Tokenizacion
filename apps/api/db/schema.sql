CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
  CREATE TYPE tag_status AS ENUM ('inactive', 'active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE batch_status AS ENUM ('active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE scan_source AS ENUM ('real', 'demo', 'imported');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  root_key_ct text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bid text NOT NULL UNIQUE,
  status batch_status NOT NULL DEFAULT 'active',
  meta_key_ct text NOT NULL,
  file_key_ct text NOT NULL,
  sdm_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_sun_profiles (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  vertical text,
  club_name text,
  product_label text,
  origin_label text,
  origin_address text,
  origin_lat double precision,
  origin_lng double precision,
  tokenization_mode text,
  claim_policy text,
  ownership_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  manifest_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  uid_hex text NOT NULL,
  status tag_status NOT NULL DEFAULT 'inactive',
  last_seen_ctr integer,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  scan_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(batch_id, uid_hex)
);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  uid_hex text,
  sdm_read_ctr integer,
  read_counter integer,
  cmac_ok boolean,
  allowlisted boolean,
  tag_status tag_status,
  result text NOT NULL,
  reason text,
  ip inet,
  user_agent text,
  geo_city text,
  geo_country text,
  geo_lat double precision,
  geo_lng double precision,
  country_code text,
  city text,
  lat double precision,
  lng double precision,
  device_label text,
  source scan_source NOT NULL DEFAULT 'real',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_query jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tags_batch_uid ON tags(batch_id, uid_hex);
CREATE INDEX IF NOT EXISTS idx_tags_scan_count ON tags(scan_count DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_sun_profiles_vertical ON tenant_sun_profiles(vertical);
CREATE TABLE IF NOT EXISTS tenant_manifests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  bid text NOT NULL,
  manifest_type text NOT NULL,
  source_filename text,
  row_count integer NOT NULL DEFAULT 0,
  inserted_count integer NOT NULL DEFAULT 0,
  reactivated_count integer NOT NULL DEFAULT 0,
  duplicate_count integer NOT NULL DEFAULT 0,
  rejected_count integer NOT NULL DEFAULT 0,
  content_hash text NOT NULL,
  imported_by text,
  import_status text NOT NULL DEFAULT 'imported',
  errors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_batch ON tenant_manifests(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_manifests_tenant ON tenant_manifests(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_batch_created ON events(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_batch_uid_ctr ON events(batch_id, uid_hex, sdm_read_ctr);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_geo_lat_lng ON events(geo_lat, geo_lng) WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_source_created ON events(source, created_at DESC);
CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locale, slug)
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  country text,
  vertical text,
  tag_type text,
  volume integer,
  source text NOT NULL DEFAULT 'assistant',
  status text NOT NULL DEFAULT 'new',
  notes text,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  tag_type text,
  volume integer,
  notes text,
  status text NOT NULL DEFAULT 'new',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tokenization_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  bid text NOT NULL,
  uid_hex text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  network text NOT NULL DEFAULT 'polygon-amoy',
  asset_ref text,
  issuer_wallet text,
  tx_hash text,
  token_id text,
  anchor_hash text,
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz,
  external_ref text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_tokenization_requests_bid_uid ON tokenization_requests(bid, uid_hex, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_status ON tokenization_requests(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_tenant ON tokenization_requests(tenant_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokenization_requests_next_attempt ON tokenization_requests(status, next_attempt_at, requested_at);

DO $$ BEGIN
  CREATE TYPE loyalty_program_status AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE loyalty_member_status AS ENUM ('anonymous', 'enrolled', 'verified', 'blocked', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_type AS ENUM (
    'DISCOUNT', 'EXPERIENCE', 'TASTING', 'TOUR', 'FREE_SHIPPING', 'EARLY_ACCESS',
    'DIGITAL_COLLECTIBLE', 'CONTENT_UNLOCK', 'GIFT', 'SERVICE', 'WARRANTY_EXTENSION',
    'REFILL', 'VIP_ACCESS', 'WINE_BOTTLE', 'WINE_BOX'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE reward_redemption_status AS ENUM ('pending', 'confirmed', 'fulfilled', 'cancelled', 'expired', 'reversed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE points_source AS ENUM (
    'TAP_VALID', 'PROVENANCE_VIEWED', 'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED',
    'QUIZ_COMPLETED', 'EXPERIENCE_ATTENDED', 'REFERRAL_SIGNUP', 'REWARD_REDEEMED',
    'ADMIN_ADJUSTMENT', 'FRAUD_REVERSAL', 'EXPIRATION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS loyalty_programs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  vertical text NOT NULL DEFAULT 'other',
  status loyalty_program_status NOT NULL DEFAULT 'draft',
  mode text NOT NULL DEFAULT 'production',
  points_name text NOT NULL DEFAULT 'Points',
  default_locale text NOT NULL DEFAULT 'es-AR',
  age_gate_required boolean NOT NULL DEFAULT false,
  allow_family_pooling boolean NOT NULL DEFAULT false,
  allow_referrals boolean NOT NULL DEFAULT false,
  allow_experience_booking boolean NOT NULL DEFAULT false,
  allow_digital_collectibles boolean NOT NULL DEFAULT false,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  rules_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  member_key text,
  consumer_id uuid,
  email text,
  phone text,
  display_name text,
  country text,
  preferred_locale text NOT NULL DEFAULT 'es-AR',
  status loyalty_member_status NOT NULL DEFAULT 'anonymous',
  tier_id uuid,
  points_balance integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  first_tap_at timestamptz,
  last_tap_at timestamptz,
  consent_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  name text NOT NULL,
  rank integer NOT NULL,
  min_points integer NOT NULL DEFAULT 0,
  min_verified_taps integer NOT NULL DEFAULT 0,
  benefits_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge_icon text,
  color_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, rank)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  source points_source NOT NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL,
  idempotency_key text UNIQUE,
  reason text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  rarity text DEFAULT 'common',
  vertical text,
  criteria_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS member_badges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  badge_id uuid NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  tap_event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(member_id, badge_id)
);

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  type reward_type NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  points_cost integer NOT NULL DEFAULT 0,
  stock_total integer,
  stock_remaining integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  redemption_limit_per_member integer,
  eligibility_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_url text,
  requires_age_gate boolean NOT NULL DEFAULT false,
  network_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, code)
);

CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES loyalty_members(id) ON DELETE CASCADE,
  status reward_redemption_status NOT NULL DEFAULT 'pending',
  points_spent integer NOT NULL,
  redemption_code text UNIQUE,
  qr_payload_hash text,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_email ON loyalty_members(program_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_member_key ON loyalty_members(program_id, member_key);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loyalty_members_program_consumer ON loyalty_members(program_id, consumer_id) WHERE consumer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_programs_tenant ON loyalty_programs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_loyalty_members_consumer_program ON loyalty_members(consumer_id, program_id);
CREATE INDEX IF NOT EXISTS idx_points_ledger_member_created ON points_ledger(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_program_status ON rewards(program_id, status, starts_at);
CREATE INDEX IF NOT EXISTS idx_reward_redemptions_member ON reward_redemptions(member_id, created_at DESC);

-- ENUMS AND TABLES FOR NEXID ENTERPRISE SUPPLIER OPERATIONS & PROOF LAYERS

DO $$ BEGIN
  CREATE TYPE supplier_order_status AS ENUM ('DRAFT', 'PLANNED', 'PACK_GENERATED', 'SENT_TO_SUPPLIER', 'MANIFEST_RECEIVED', 'QA_PENDING', 'QA_PASSED', 'ACTIVE', 'QUARANTINED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE qa_status_enum AS ENUM ('pending', 'passed', 'failed', 'waived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vault_artifact_type AS ENUM ('supplier_pack_zip', 'supplier_pack_pdf', 'manifest_template', 'manifest_received', 'qa_report', 'proof_report');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE offline_scan_status AS ENUM ('PENDING_BACKEND_VERIFICATION', 'SYNCED_VALID', 'SYNCED_INVALID', 'SYNC_FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE proof_event_status AS ENUM ('pending', 'ready', 'anchored', 'failed', 'disabled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_anchor_status AS ENUM ('pending', 'submitted', 'reconciling', 'confirmed', 'failed', 'disabled', 'local');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS supplier_orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_slug text NOT NULL,
  order_code text NOT NULL UNIQUE,
  order_name text NOT NULL,
  total_quantity integer NOT NULL,
  sub_batch_size integer NOT NULL,
  chip_model text NOT NULL,
  carrier_profile_code text NOT NULL,
  material_type text NOT NULL,
  supplier_name text NOT NULL,
  status supplier_order_status NOT NULL DEFAULT 'DRAFT',
  notes text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_sub_batches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_order_id uuid NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id text NOT NULL UNIQUE,
  quantity integer NOT NULL,
  sequence text NOT NULL,
  chip_model text NOT NULL,
  carrier_profile_code text NOT NULL,
  material_type text NOT NULL,
  meta_key_id uuid,
  file_key_id uuid,
  sdm_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT',
  manifest_count integer NOT NULL DEFAULT 0,
  active_count integer NOT NULL DEFAULT 0,
  qa_status qa_status_enum NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS batch_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id text NOT NULL,
  key_role text NOT NULL,
  encrypted_key_ct text NOT NULL,
  key_fingerprint_sha256_prefix text NOT NULL,
  key_version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  exported_at timestamptz,
  exported_by text
);

CREATE TABLE IF NOT EXISTS vault_artifacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_order_id uuid REFERENCES supplier_orders(id) ON DELETE CASCADE,
  sub_batch_id uuid REFERENCES supplier_sub_batches(id) ON DELETE CASCADE,
  artifact_type vault_artifact_type NOT NULL,
  storage_path text NOT NULL,
  sha256 text NOT NULL,
  encrypted boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  download_count integer NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz
);

CREATE TABLE IF NOT EXISTS offline_scan_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id text NOT NULL,
  operator_id text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  captured_url text NOT NULL,
  captured_at timestamptz NOT NULL,
  approximate_location jsonb,
  device_id text NOT NULL,
  status offline_scan_status NOT NULL DEFAULT 'PENDING_BACKEND_VERIFICATION'
);

CREATE TABLE IF NOT EXISTS ledger_providers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  network text NOT NULL,
  chain_id integer,
  rpc_url_env_name text,
  explorer_base_url text,
  enabled boolean NOT NULL DEFAULT false,
  purpose text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  batch_id text,
  tag_id text,
  product_id text,
  payload_json jsonb NOT NULL,
  payload_hash text NOT NULL UNIQUE,
  hash_algorithm text NOT NULL DEFAULT 'sha256',
  provider_preference text NOT NULL DEFAULT 'none',
  status proof_event_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_anchors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  network text NOT NULL,
  anchor_type text NOT NULL,
  resource_type text,
  resource_id text,
  public_resource_id text,
  event_count integer NOT NULL,
  event_hashes text[],
  event_hashes_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  merkle_root text NOT NULL,
  tx_hash text,
  explorer_url text,
  status evidence_anchor_status NOT NULL DEFAULT 'pending',
  anchored_at timestamptz,
  error_message text,
  contract_version text,
  chain_id bigint,
  contract_address text,
  publisher_address text,
  tenant_id_hash text,
  canonicalization_version text,
  merkle_algorithm text,
  memo_hash text,
  memo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  proof_id text,
  idempotency_key text,
  block_number bigint,
  block_hash text,
  confirmations integer NOT NULL DEFAULT 0,
  attempt_count integer NOT NULL DEFAULT 0,
  error_code text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  last_checked_at timestamptz,
  next_attempt_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

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
  ON evidence_anchors (lower(proof_id)) WHERE provider = 'iota' AND proof_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchors_idempotency_key
  ON evidence_anchors (lower(idempotency_key)) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchors_tx_hash
  ON evidence_anchors (lower(tx_hash)) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchor_attempts_tx_hash
  ON evidence_anchor_attempts (lower(tx_hash)) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_anchor_attempts_signer_nonce
  ON evidence_anchor_attempts (chain_id, lower(signer_address), nonce)
  WHERE signer_address IS NOT NULL AND nonce IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_reconciliation
  ON evidence_anchors (status, next_attempt_at, updated_at)
  WHERE provider = 'iota' AND status IN ('pending', 'submitted', 'reconciling');
CREATE INDEX IF NOT EXISTS idx_evidence_anchor_members_event
  ON evidence_anchor_members (event_id, anchor_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ownership_records (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id text,
  tag_id text,
  batch_id text,
  owner_user_id text,
  wallet_address text,
  provider text NOT NULL DEFAULT 'polygon',
  network text NOT NULL,
  token_contract text,
  token_id text,
  tx_hash text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_tenant ON supplier_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_tenant ON supplier_sub_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_batches_order ON supplier_sub_batches(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_vault_artifacts_tenant ON vault_artifacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vault_artifacts_order ON vault_artifacts(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_tenant ON evidence_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_evidence_anchors_tenant ON evidence_anchors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ownership_records_tenant ON ownership_records(tenant_id);
-- SECURE DELIVERY SCHEMA

DO $$ BEGIN
  CREATE TYPE seal_status AS ENUM (
    'UNASSIGNED', 'ASSIGNED', 'SEALED', 'IN_TRANSIT', 
    'DELIVERED_CLOSED', 'DELIVERED_OPENED', 'QUARANTINED', 'VOIDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS carrier_integrations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  credentials_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, code)
);

CREATE TABLE IF NOT EXISTS shipments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_code text NOT NULL UNIQUE,
  carrier_id uuid REFERENCES carrier_integrations(id) ON DELETE SET NULL,
  tracking_number text,
  status text NOT NULL DEFAULT 'draft',
  origin_address text,
  destination_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipment_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seal_inventory (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  uid_hex text NOT NULL,
  status seal_status NOT NULL DEFAULT 'UNASSIGNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, uid_hex)
);

CREATE TABLE IF NOT EXISTS package_seals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  seal_id uuid NOT NULL REFERENCES seal_inventory(id) ON DELETE CASCADE,
  applied_at timestamptz,
  status seal_status NOT NULL DEFAULT 'ASSIGNED',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(shipment_id, seal_id)
);

CREATE TABLE IF NOT EXISTS custody_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
  seal_id uuid REFERENCES seal_inventory(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  location text,
  scanned_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recipient_verifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  recipient_name text,
  verification_method text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  issue_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seal_inventory_tenant ON seal_inventory(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_custody_events_shipment ON custody_events(shipment_id, created_at DESC);

-- Distributed admin-login abuse guard. Identifiers are HMACs; no email or IP
-- address is persisted in this enforcement table.
CREATE TABLE IF NOT EXISTS admin_login_attempt_buckets (
  bucket_kind text NOT NULL,
  bucket_key text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempt_count integer NOT NULL DEFAULT 0,
  blocked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket_kind, bucket_key),
  CONSTRAINT admin_login_attempt_buckets_kind_check
    CHECK (bucket_kind IN ('source', 'source_subject')),
  CONSTRAINT admin_login_attempt_buckets_key_check
    CHECK (bucket_key ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_login_attempt_buckets_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_updated
  ON admin_login_attempt_buckets (updated_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempt_buckets_blocked
  ON admin_login_attempt_buckets (blocked_until)
  WHERE blocked_until IS NOT NULL;
