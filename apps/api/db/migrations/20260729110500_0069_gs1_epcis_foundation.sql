-- Tenant-owned GS1 Digital Link registry and an atomic EPCIS/CBV 2.0
-- interoperability foundation over the canonical event/outbox model.
--
-- This migration does not change SUN/SDM/CMAC verification. EPCIS capture is
-- recorded as declared business evidence; it is never promoted to NFC
-- cryptographic authentication. The implementation intentionally supports a
-- bounded JSON/JSON-LD profile and makes no GS1 certification claim.

CREATE OR REPLACE FUNCTION nexid_is_valid_gtin14_v1(p_gtin text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  v_sum integer := 0;
  v_index integer;
  v_expected integer;
BEGIN
  IF p_gtin !~ '^[0-9]{14}$' THEN
    RETURN false;
  END IF;
  FOR v_index IN 1..13 LOOP
    v_sum := v_sum + substring(p_gtin FROM v_index FOR 1)::integer
      * CASE WHEN mod(v_index, 2) = 1 THEN 3 ELSE 1 END;
  END LOOP;
  v_expected := mod(10 - mod(v_sum, 10), 10);
  RETURN v_expected = substring(p_gtin FROM 14 FOR 1)::integer;
END;
$$;

CREATE TABLE IF NOT EXISTS gs1_gtin_prefix_entitlements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  canonical_gtin_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  verification_method text NOT NULL,
  evidence_reference text NOT NULL,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gs1_gtin_entitlement_prefix_check CHECK (canonical_gtin_prefix ~ '^[0-9]{4,14}$'),
  CONSTRAINT gs1_gtin_entitlement_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT gs1_gtin_entitlement_verification_method_check CHECK (
    verification_method IN ('verified_by_gs1', 'gs1_license_document', 'brand_authorization', 'pilot_contract_review')
  ),
  CONSTRAINT gs1_gtin_entitlement_evidence_reference_check CHECK (
    char_length(evidence_reference) BETWEEN 3 AND 512
    AND evidence_reference !~ '[\x00-\x1F\x7F]'
  ),
  UNIQUE (id, tenant_id),
  UNIQUE (canonical_gtin_prefix)
);

CREATE INDEX IF NOT EXISTS idx_gs1_gtin_entitlements_tenant_updated
  ON gs1_gtin_prefix_entitlements (tenant_id, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS gs1_gtin_prefix_entitlement_audit (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entitlement_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gs1_gtin_entitlement_audit_action_check CHECK (action IN ('granted', 'status_changed')),
  CONSTRAINT gs1_gtin_entitlement_audit_reason_check CHECK (char_length(reason) BETWEEN 3 AND 1000),
  CONSTRAINT gs1_gtin_entitlement_audit_snapshot_check CHECK (
    jsonb_typeof(snapshot_json) = 'object' AND octet_length(snapshot_json::text) <= 32768
  ),
  CONSTRAINT gs1_gtin_entitlement_audit_entitlement_fkey
    FOREIGN KEY (entitlement_id, tenant_id)
    REFERENCES gs1_gtin_prefix_entitlements(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_gs1_gtin_entitlement_audit_tenant_created
  ON gs1_gtin_prefix_entitlement_audit (tenant_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION nexid_enforce_gs1_gtin_entitlement_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('gs1_gtin_prefix_entitlements', 0));
  IF EXISTS (
    SELECT 1
    FROM gs1_gtin_prefix_entitlements entitlement
    WHERE entitlement.id <> NEW.id
      AND entitlement.canonical_gtin_prefix <> NEW.canonical_gtin_prefix
      AND (
        entitlement.canonical_gtin_prefix LIKE NEW.canonical_gtin_prefix || '%'
        OR NEW.canonical_gtin_prefix LIKE entitlement.canonical_gtin_prefix || '%'
      )
  ) THEN
    RAISE EXCEPTION 'gs1_gtin_prefix_entitlement_overlap';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gs1_gtin_entitlement_overlap ON gs1_gtin_prefix_entitlements;
CREATE TRIGGER trg_gs1_gtin_entitlement_overlap
BEFORE INSERT OR UPDATE OF canonical_gtin_prefix ON gs1_gtin_prefix_entitlements
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_gs1_gtin_entitlement_v1();

CREATE TABLE IF NOT EXISTS gs1_digital_link_identities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  tag_id uuid,
  gtin text NOT NULL,
  lot text NOT NULL DEFAULT '',
  serial text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  display_name text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gs1_identity_batch_fkey
    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
  CONSTRAINT gs1_identity_entitlement_fkey
    FOREIGN KEY (entitlement_id, tenant_id)
    REFERENCES gs1_gtin_prefix_entitlements(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT gs1_identity_tag_fkey
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE RESTRICT,
  CONSTRAINT gs1_identity_gtin_check CHECK (nexid_is_valid_gtin14_v1(gtin)),
  CONSTRAINT gs1_identity_lot_check CHECK (
    lot = '' OR (char_length(lot) BETWEEN 1 AND 20 AND lot ~ '^[!-\.0-~]+$' AND lot !~ '[/\\?#]')
  ),
  CONSTRAINT gs1_identity_serial_check CHECK (
    serial = '' OR (char_length(serial) BETWEEN 1 AND 20 AND serial ~ '^[!-\.0-~]+$' AND serial !~ '[/\\?#]')
  ),
  CONSTRAINT gs1_identity_status_check CHECK (status IN ('active', 'suspended', 'retired')),
  CONSTRAINT gs1_identity_display_name_check CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 240),
  CONSTRAINT gs1_identity_metadata_check CHECK (
    jsonb_typeof(metadata_json) = 'object' AND octet_length(metadata_json::text) <= 16384
  ),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, gtin, lot, serial)
);

-- A public Digital Link URI must resolve deterministically without accepting a
-- caller-selected tenant. Ownership is never released merely by suspending or
-- retiring an identity, preventing cross-tenant identifier takeover.
CREATE UNIQUE INDEX IF NOT EXISTS uq_gs1_identity_public_path
  ON gs1_digital_link_identities (gtin, lot, serial);

CREATE INDEX IF NOT EXISTS idx_gs1_identity_tenant_updated
  ON gs1_digital_link_identities (tenant_id, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_gs1_identity_batch
  ON gs1_digital_link_identities (batch_id, status);

CREATE TABLE IF NOT EXISTS gs1_digital_link_identity_audit (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  identity_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gs1_identity_audit_action_check CHECK (action IN ('registered', 'status_changed')),
  CONSTRAINT gs1_identity_audit_reason_check CHECK (char_length(reason) BETWEEN 3 AND 1000),
  CONSTRAINT gs1_identity_audit_snapshot_check CHECK (
    jsonb_typeof(snapshot_json) = 'object' AND octet_length(snapshot_json::text) <= 32768
  ),
  CONSTRAINT gs1_identity_audit_identity_fkey
    FOREIGN KEY (identity_id, tenant_id)
    REFERENCES gs1_digital_link_identities(id, tenant_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_gs1_identity_audit_tenant_created
  ON gs1_digital_link_identity_audit (tenant_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS epcis_capture_operations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  api_key_id uuid NOT NULL,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  document_id text,
  event_count integer NOT NULL,
  canonical_projection_count integer NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epcis_capture_idempotency_key_check CHECK (char_length(idempotency_key) BETWEEN 1 AND 255),
  CONSTRAINT epcis_capture_fingerprint_check CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT epcis_capture_document_id_check CHECK (document_id IS NULL OR char_length(document_id) BETWEEN 1 AND 512),
  CONSTRAINT epcis_capture_event_count_check CHECK (event_count BETWEEN 1 AND 100),
  CONSTRAINT epcis_capture_projection_count_check CHECK (canonical_projection_count BETWEEN 1 AND 100),
  CONSTRAINT epcis_capture_api_key_fkey
    FOREIGN KEY (api_key_id) REFERENCES tenant_api_keys(id) ON DELETE RESTRICT,
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS epcis_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  capture_operation_id uuid NOT NULL UNIQUE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schema_version text NOT NULL,
  document_type text NOT NULL,
  client_document_id text,
  document_json jsonb NOT NULL,
  captured_at timestamptz NOT NULL,
  CONSTRAINT epcis_document_version_check CHECK (schema_version = '2.0'),
  CONSTRAINT epcis_document_type_check CHECK (document_type = 'EPCISDocument'),
  CONSTRAINT epcis_document_client_id_check CHECK (client_document_id IS NULL OR char_length(client_document_id) BETWEEN 1 AND 512),
  CONSTRAINT epcis_document_json_check CHECK (
    jsonb_typeof(document_json) = 'object' AND octet_length(document_json::text) <= 524288
  ),
  CONSTRAINT epcis_document_capture_fkey
    FOREIGN KEY (capture_operation_id, tenant_id)
    REFERENCES epcis_capture_operations(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_epcis_documents_tenant_captured
  ON epcis_documents (tenant_id, captured_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS epcis_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_event_id text,
  event_type text NOT NULL,
  event_time timestamptz NOT NULL,
  record_time timestamptz NOT NULL,
  event_time_zone_offset text NOT NULL,
  action text,
  biz_step text,
  disposition text,
  read_point text,
  biz_location text,
  event_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT epcis_event_client_id_check CHECK (client_event_id IS NULL OR char_length(client_event_id) BETWEEN 1 AND 512),
  CONSTRAINT epcis_event_type_check CHECK (event_type IN ('ObjectEvent', 'AggregationEvent', 'TransactionEvent', 'TransformationEvent', 'AssociationEvent')),
  CONSTRAINT epcis_event_timezone_check CHECK (event_time_zone_offset ~ '^[+-](0[0-9]|1[0-4]):[0-5][0-9]$'),
  CONSTRAINT epcis_event_action_check CHECK (action IS NULL OR action IN ('ADD', 'OBSERVE', 'DELETE')),
  CONSTRAINT epcis_event_vocabulary_check CHECK (
    (biz_step IS NULL OR char_length(biz_step) BETWEEN 1 AND 512)
    AND (disposition IS NULL OR char_length(disposition) BETWEEN 1 AND 512)
    AND (read_point IS NULL OR char_length(read_point) BETWEEN 1 AND 512)
    AND (biz_location IS NULL OR char_length(biz_location) BETWEEN 1 AND 512)
  ),
  CONSTRAINT epcis_event_json_check CHECK (
    jsonb_typeof(event_json) = 'object' AND octet_length(event_json::text) <= 65536
  ),
  CONSTRAINT epcis_event_document_fkey
    FOREIGN KEY (document_id, tenant_id)
    REFERENCES epcis_documents(id, tenant_id) ON DELETE RESTRICT,
  UNIQUE (id, tenant_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_epcis_event_client_id
  ON epcis_events (tenant_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_epcis_events_tenant_time
  ON epcis_events (tenant_id, event_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_epcis_events_tenant_type_time
  ON epcis_events (tenant_id, event_type, event_time DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_epcis_events_tenant_biz_step_time
  ON epcis_events (tenant_id, biz_step, event_time DESC, id DESC)
  WHERE biz_step IS NOT NULL;

CREATE TABLE IF NOT EXISTS epcis_event_identifiers (
  epcis_event_id uuid NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  gs1_identity_id uuid NOT NULL,
  canonical_operation_id uuid NOT NULL,
  canonical_event_id bigint NOT NULL,
  canonical_event_created_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (epcis_event_id, gs1_identity_id),
  CONSTRAINT epcis_identifier_event_fkey
    FOREIGN KEY (epcis_event_id, tenant_id) REFERENCES epcis_events(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT epcis_identifier_registry_fkey
    FOREIGN KEY (gs1_identity_id, tenant_id) REFERENCES gs1_digital_link_identities(id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT epcis_identifier_canonical_operation_fkey
    FOREIGN KEY (canonical_operation_id)
    REFERENCES canonical_event_operations(id) ON DELETE RESTRICT,
  CONSTRAINT epcis_identifier_canonical_event_fkey
    FOREIGN KEY (canonical_event_id, canonical_event_created_at)
    REFERENCES events(id, created_at) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_epcis_identifiers_tenant_registry
  ON epcis_event_identifiers (tenant_id, gs1_identity_id, created_at DESC);

-- The following trigger checks preserve composite tenant ownership without
-- adding/revalidating indexes or constraints on active production tables.
CREATE OR REPLACE FUNCTION nexid_enforce_gs1_identity_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'active' THEN
    PERFORM 1 FROM gs1_gtin_prefix_entitlements entitlement
      WHERE entitlement.id = NEW.entitlement_id
        AND entitlement.tenant_id = NEW.tenant_id
        AND entitlement.status = 'active'
        AND NEW.gtin LIKE entitlement.canonical_gtin_prefix || '%'
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'gs1_identity_entitlement_invalid';
    END IF;
  END IF;
  PERFORM 1 FROM batches batch
    WHERE batch.id = NEW.batch_id AND batch.tenant_id = NEW.tenant_id
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'gs1_identity_batch_tenant_mismatch';
  END IF;
  IF NEW.tag_id IS NOT NULL THEN
    PERFORM 1 FROM tags tag
      WHERE tag.id = NEW.tag_id AND tag.batch_id = NEW.batch_id
      FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'gs1_identity_tag_batch_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gs1_identity_scope ON gs1_digital_link_identities;
CREATE TRIGGER trg_gs1_identity_scope
BEFORE INSERT OR UPDATE ON gs1_digital_link_identities
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_gs1_identity_scope_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_gs1_gtin_entitlement_audit_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gs1_gtin_prefix_entitlements entitlement
    WHERE entitlement.id = NEW.entitlement_id AND entitlement.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'gs1_gtin_entitlement_audit_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gs1_gtin_entitlement_audit_scope ON gs1_gtin_prefix_entitlement_audit;
CREATE TRIGGER trg_gs1_gtin_entitlement_audit_scope
BEFORE INSERT ON gs1_gtin_prefix_entitlement_audit
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_gs1_gtin_entitlement_audit_scope_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_gs1_identity_audit_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gs1_digital_link_identities identity
    WHERE identity.id = NEW.identity_id AND identity.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'gs1_identity_audit_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gs1_identity_audit_scope ON gs1_digital_link_identity_audit;
CREATE TRIGGER trg_gs1_identity_audit_scope
BEFORE INSERT ON gs1_digital_link_identity_audit
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_gs1_identity_audit_scope_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_epcis_capture_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM 1 FROM tenant_api_keys api_key
    WHERE api_key.id = NEW.api_key_id AND api_key.tenant_id = NEW.tenant_id
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'epcis_capture_api_key_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_capture_scope ON epcis_capture_operations;
CREATE TRIGGER trg_epcis_capture_scope
BEFORE INSERT ON epcis_capture_operations
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_epcis_capture_scope_v1();

CREATE OR REPLACE FUNCTION nexid_reject_referenced_batch_reparent_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND EXISTS (
    SELECT 1 FROM gs1_digital_link_identities identity
    WHERE identity.batch_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'gs1_referenced_batch_tenant_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gs1_referenced_batch_reparent ON batches;
CREATE TRIGGER trg_gs1_referenced_batch_reparent
BEFORE UPDATE OF tenant_id ON batches
FOR EACH ROW EXECUTE FUNCTION nexid_reject_referenced_batch_reparent_v1();

CREATE OR REPLACE FUNCTION nexid_reject_referenced_api_key_reparent_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND EXISTS (
    SELECT 1 FROM epcis_capture_operations operation
    WHERE operation.api_key_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'epcis_referenced_api_key_tenant_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_referenced_api_key_reparent ON tenant_api_keys;
CREATE TRIGGER trg_epcis_referenced_api_key_reparent
BEFORE UPDATE OF tenant_id ON tenant_api_keys
FOR EACH ROW EXECUTE FUNCTION nexid_reject_referenced_api_key_reparent_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_epcis_document_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM epcis_capture_operations operation
    WHERE operation.id = NEW.capture_operation_id AND operation.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'epcis_document_capture_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_document_scope ON epcis_documents;
CREATE TRIGGER trg_epcis_document_scope
BEFORE INSERT ON epcis_documents
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_epcis_document_scope_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_epcis_event_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM epcis_documents document
    WHERE document.id = NEW.document_id AND document.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'epcis_event_document_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_event_scope ON epcis_events;
CREATE TRIGGER trg_epcis_event_scope
BEFORE INSERT ON epcis_events
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_epcis_event_scope_v1();

CREATE OR REPLACE FUNCTION nexid_enforce_epcis_identifier_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM epcis_events event
    WHERE event.id = NEW.epcis_event_id AND event.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'epcis_identifier_event_tenant_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM gs1_digital_link_identities identity
    WHERE identity.id = NEW.gs1_identity_id AND identity.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'epcis_identifier_registry_tenant_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM canonical_event_operations operation
    WHERE operation.id = NEW.canonical_operation_id
      AND operation.tenant_id = NEW.tenant_id
      AND operation.event_id = NEW.canonical_event_id
      AND operation.event_created_at = NEW.canonical_event_created_at
  ) THEN
    RAISE EXCEPTION 'epcis_identifier_canonical_operation_mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM events event
    WHERE event.id = NEW.canonical_event_id
      AND event.created_at = NEW.canonical_event_created_at
      AND event.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'epcis_identifier_canonical_event_tenant_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_identifier_scope ON epcis_event_identifiers;
CREATE TRIGGER trg_epcis_identifier_scope
BEFORE INSERT ON epcis_event_identifiers
FOR EACH ROW EXECUTE FUNCTION nexid_enforce_epcis_identifier_scope_v1();

CREATE OR REPLACE FUNCTION nexid_reject_epcis_append_only_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'epcis_append_only';
END;
$$;

DROP TRIGGER IF EXISTS trg_epcis_capture_operations_append_only ON epcis_capture_operations;
CREATE TRIGGER trg_epcis_capture_operations_append_only
BEFORE UPDATE OR DELETE ON epcis_capture_operations
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_epcis_documents_append_only ON epcis_documents;
CREATE TRIGGER trg_epcis_documents_append_only
BEFORE UPDATE OR DELETE ON epcis_documents
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_epcis_events_append_only ON epcis_events;
CREATE TRIGGER trg_epcis_events_append_only
BEFORE UPDATE OR DELETE ON epcis_events
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_epcis_identifiers_append_only ON epcis_event_identifiers;
CREATE TRIGGER trg_epcis_identifiers_append_only
BEFORE UPDATE OR DELETE ON epcis_event_identifiers
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_gs1_identity_audit_append_only ON gs1_digital_link_identity_audit;
CREATE TRIGGER trg_gs1_identity_audit_append_only
BEFORE UPDATE OR DELETE ON gs1_digital_link_identity_audit
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

DROP TRIGGER IF EXISTS trg_gs1_gtin_entitlement_audit_append_only ON gs1_gtin_prefix_entitlement_audit;
CREATE TRIGGER trg_gs1_gtin_entitlement_audit_append_only
BEFORE UPDATE OR DELETE ON gs1_gtin_prefix_entitlement_audit
FOR EACH ROW EXECUTE FUNCTION nexid_reject_epcis_append_only_mutation_v1();

CREATE OR REPLACE FUNCTION nexid_capture_epcis_document_v1(p_input jsonb)
RETURNS TABLE (
  capture_id uuid,
  document_record_id uuid,
  tenant_id uuid,
  event_count integer,
  canonical_projection_count integer,
  captured_at timestamptz,
  replayed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_api_key_id uuid;
  v_idempotency_key text := btrim(COALESCE(p_input->>'idempotency_key', ''));
  v_request_fingerprint text := lower(btrim(COALESCE(p_input->>'request_fingerprint', '')));
  v_schema_version text := btrim(COALESCE(p_input->>'schema_version', ''));
  v_document_type text := btrim(COALESCE(p_input->>'document_type', ''));
  v_client_document_id text := NULLIF(btrim(COALESCE(p_input->>'client_document_id', '')), '');
  v_document jsonb := p_input->'document';
  v_events jsonb := p_input->'events';
  v_existing epcis_capture_operations%ROWTYPE;
  v_capture_id uuid := uuid_generate_v4();
  v_document_id uuid := uuid_generate_v4();
  v_captured_at timestamptz := clock_timestamp();
  v_event_input jsonb;
  v_identifier_input jsonb;
  v_event_record uuid;
  v_registry gs1_digital_link_identities%ROWTYPE;
  v_tenant_slug text;
  v_batch_bid text;
  v_tag_uid text;
  v_tag_status tag_status;
  v_operation_id uuid;
  v_event_id bigint;
  v_event_created_at timestamptz;
  v_event_json jsonb;
  v_projection_count integer := 0;
  v_expected_projection_count integer := 0;
  v_webhook_event_id text;
  v_webhook_payload jsonb;
  v_canonical_event_type text := 'EPCIS_EVENT_CAPTURED';
BEGIN
  IF p_input IS NULL OR jsonb_typeof(p_input) <> 'object' THEN
    RAISE EXCEPTION 'epcis_capture_payload_invalid';
  END IF;
  BEGIN
    v_tenant_id := NULLIF(p_input->>'tenant_id', '')::uuid;
    v_api_key_id := NULLIF(p_input->>'api_key_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'epcis_capture_actor_invalid';
  END;
  IF v_tenant_id IS NULL OR v_api_key_id IS NULL THEN
    RAISE EXCEPTION 'epcis_capture_actor_invalid';
  END IF;
  IF char_length(v_idempotency_key) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION 'epcis_idempotency_key_invalid';
  END IF;
  IF v_request_fingerprint !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'epcis_request_fingerprint_invalid';
  END IF;
  IF v_schema_version <> '2.0' OR v_document_type <> 'EPCISDocument' THEN
    RAISE EXCEPTION 'epcis_document_profile_invalid';
  END IF;
  IF v_client_document_id IS NOT NULL AND char_length(v_client_document_id) > 512 THEN
    RAISE EXCEPTION 'epcis_document_id_invalid';
  END IF;
  IF jsonb_typeof(v_document) <> 'object' OR octet_length(v_document::text) > 524288 THEN
    RAISE EXCEPTION 'epcis_document_invalid';
  END IF;
  IF jsonb_typeof(v_events) <> 'array' OR jsonb_array_length(v_events) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'epcis_event_count_invalid';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM tenant_api_keys api_key
    WHERE api_key.id = v_api_key_id
      AND api_key.tenant_id = v_tenant_id
      AND api_key.status = 'active'
      AND (api_key.expires_at IS NULL OR api_key.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'epcis_api_key_tenant_mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || chr(31) || v_idempotency_key, 0));
  SELECT * INTO v_existing
  FROM epcis_capture_operations operation
  WHERE operation.tenant_id = v_tenant_id
    AND operation.idempotency_key = v_idempotency_key
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    IF v_existing.request_fingerprint <> v_request_fingerprint THEN
      RAISE EXCEPTION 'epcis_idempotency_conflict';
    END IF;
    RETURN QUERY
      SELECT v_existing.id, document.id, v_existing.tenant_id,
        v_existing.event_count, v_existing.canonical_projection_count,
        v_existing.captured_at, true
      FROM epcis_documents document
      WHERE document.capture_operation_id = v_existing.id;
    RETURN;
  END IF;

  SELECT tenant.slug INTO v_tenant_slug FROM tenants tenant WHERE tenant.id = v_tenant_id;
  IF v_tenant_slug IS NULL THEN
    RAISE EXCEPTION 'epcis_tenant_not_found';
  END IF;

  -- Validate every referenced identity before any durable insert. Combined with
  -- the function transaction, this guarantees rollback rather than partial capture.
  FOR v_event_input IN SELECT value FROM jsonb_array_elements(v_events) LOOP
    IF jsonb_typeof(v_event_input) <> 'object'
       OR jsonb_typeof(v_event_input->'event') <> 'object'
       OR octet_length((v_event_input->'event')::text) > 65536
       OR jsonb_typeof(v_event_input->'identifiers') <> 'array'
       OR jsonb_array_length(v_event_input->'identifiers') NOT BETWEEN 1 AND 100 THEN
      RAISE EXCEPTION 'epcis_event_payload_invalid';
    END IF;
    FOR v_identifier_input IN SELECT value FROM jsonb_array_elements(v_event_input->'identifiers') LOOP
      IF jsonb_typeof(v_identifier_input) <> 'object'
         OR lower(COALESCE(v_identifier_input->>'projection_fingerprint', '')) !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'epcis_identifier_payload_invalid';
      END IF;
      BEGIN
        SELECT identity.* INTO STRICT v_registry
        FROM gs1_digital_link_identities identity
        JOIN gs1_gtin_prefix_entitlements entitlement
          ON entitlement.id = identity.entitlement_id
         AND entitlement.tenant_id = identity.tenant_id
         AND entitlement.status = 'active'
         AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
        WHERE identity.id = (v_identifier_input->>'registry_id')::uuid
          AND identity.tenant_id = v_tenant_id
          AND identity.status = 'active'
        FOR SHARE OF identity, entitlement;
      EXCEPTION
        WHEN no_data_found OR invalid_text_representation THEN
          RAISE EXCEPTION 'epcis_unknown_gs1_identity';
      END;
    END LOOP;
  END LOOP;

  SELECT COALESCE(sum(jsonb_array_length(event_input->'identifiers')), 0)::integer
  INTO v_expected_projection_count
  FROM jsonb_array_elements(v_events) event_input;
  IF v_expected_projection_count NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'epcis_projection_count_invalid';
  END IF;

  INSERT INTO epcis_capture_operations (
    id, tenant_id, api_key_id, idempotency_key, request_fingerprint,
    document_id, event_count, canonical_projection_count, captured_at
  ) VALUES (
    v_capture_id, v_tenant_id, v_api_key_id, v_idempotency_key, v_request_fingerprint,
    v_client_document_id, jsonb_array_length(v_events),
    v_expected_projection_count,
    v_captured_at
  );

  INSERT INTO epcis_documents (
    id, capture_operation_id, tenant_id, schema_version, document_type,
    client_document_id, document_json, captured_at
  ) VALUES (
    v_document_id, v_capture_id, v_tenant_id, v_schema_version, v_document_type,
    v_client_document_id, v_document, v_captured_at
  );

  FOR v_event_input IN SELECT value FROM jsonb_array_elements(v_events) LOOP
    v_event_record := uuid_generate_v4();
    v_event_json := (v_event_input->'event') || jsonb_build_object('recordTime', v_captured_at);
    BEGIN
      INSERT INTO epcis_events (
        id, document_id, tenant_id, client_event_id, event_type, event_time,
        record_time, event_time_zone_offset, action, biz_step, disposition,
        read_point, biz_location, event_json
      ) VALUES (
        v_event_record,
        v_document_id,
        v_tenant_id,
        NULLIF(v_event_input->>'client_event_id', ''),
        v_event_input->>'event_type',
        (v_event_input->>'event_time')::timestamptz,
        v_captured_at,
        v_event_input->>'event_time_zone_offset',
        NULLIF(v_event_input->>'action', ''),
        NULLIF(v_event_input->>'biz_step', ''),
        NULLIF(v_event_input->>'disposition', ''),
        NULLIF(v_event_input->>'read_point', ''),
        NULLIF(v_event_input->>'biz_location', ''),
        v_event_json
      );
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'epcis_event_id_conflict';
    END;

    FOR v_identifier_input IN SELECT value FROM jsonb_array_elements(v_event_input->'identifiers') LOOP
      SELECT identity.* INTO STRICT v_registry
      FROM gs1_digital_link_identities identity
      JOIN gs1_gtin_prefix_entitlements entitlement
        ON entitlement.id = identity.entitlement_id
       AND entitlement.tenant_id = identity.tenant_id
       AND entitlement.status = 'active'
       AND identity.gtin LIKE entitlement.canonical_gtin_prefix || '%'
      WHERE identity.id = (v_identifier_input->>'registry_id')::uuid
        AND identity.tenant_id = v_tenant_id
        AND identity.status = 'active'
      FOR SHARE OF identity, entitlement;

      SELECT batch.bid INTO v_batch_bid FROM batches batch
      WHERE batch.id = v_registry.batch_id AND batch.tenant_id = v_tenant_id;
      SELECT tag.uid_hex, tag.status INTO v_tag_uid, v_tag_status FROM tags tag
      WHERE tag.id = v_registry.tag_id AND tag.batch_id = v_registry.batch_id;

      v_operation_id := uuid_generate_v4();
      INSERT INTO events (
        tenant_id, batch_id, uid_hex, cmac_ok, allowlisted, tag_status,
        result, reason, source, meta, tenant_slug, tag_id, bid, event_type,
        verdict, risk_level, geo_precision
      ) VALUES (
        v_tenant_id,
        v_registry.batch_id,
        v_tag_uid,
        NULL,
        NULL,
        v_tag_status,
        'EPCIS_RECORDED',
        'Declared EPCIS business event; not NFC cryptographic authentication.',
        'imported'::scan_source,
        jsonb_build_object(
          'canonical_event', true,
          'canonical_operation_id', v_operation_id,
          'canonical_event_name', 'epcis.event.captured',
          'event_family', 'lifecycle',
          'event_mode', 'live',
          'metric_scope', 'supply_chain',
          'evidence_level', 'declared_business_event',
          'cryptographic_authentication', false,
          'epcis_capture_id', v_capture_id,
          'epcis_document_id', v_document_id,
          'epcis_event_id', v_event_record,
          'epcis_event_type', v_event_input->>'event_type',
          'epcis_client_event_id', NULLIF(v_event_input->>'client_event_id', ''),
          'epcis_event_time', v_event_input->>'event_time',
          'epcis_biz_step', NULLIF(v_event_input->>'biz_step', ''),
          'epcis_disposition', NULLIF(v_event_input->>'disposition', ''),
          'gs1_identity_id', v_registry.id
        ),
        v_tenant_slug,
                v_registry.tag_id,
        v_batch_bid,
        v_canonical_event_type::event_type,
        'declared',
        'none',
        'none'
      ) RETURNING events.id, events.created_at INTO v_event_id, v_event_created_at;

      INSERT INTO canonical_event_operations (
        id, tenant_id, operation_key, request_fingerprint, event_name, event_mode,
        event_id, event_created_at
      ) VALUES (
        v_operation_id,
        v_tenant_id,
        'epcis:' || v_capture_id::text || ':' || v_event_record::text || ':' || v_registry.id::text,
        lower(v_identifier_input->>'projection_fingerprint'),
        'epcis.event.captured',
        'live',
        v_event_id,
        v_event_created_at
      );

      INSERT INTO epcis_event_identifiers (
        epcis_event_id, tenant_id, gs1_identity_id, canonical_operation_id,
        canonical_event_id, canonical_event_created_at
      ) VALUES (
        v_event_record, v_tenant_id, v_registry.id, v_operation_id,
        v_event_id, v_event_created_at
      );

      v_webhook_event_id := 'evt_canonical_' || v_operation_id::text;
      v_webhook_payload := jsonb_build_object(
        'id', v_webhook_event_id,
        'type', 'epcis.event.captured',
        'schemaVersion', '1.0',
        'createdAt', v_event_created_at,
        'data', jsonb_build_object(
          'canonicalEventId', v_event_id,
          'captureId', v_capture_id,
          'documentId', v_document_id,
          'epcisEventId', v_event_record,
          'clientEventId', NULLIF(v_event_input->>'client_event_id', ''),
          'eventType', v_event_input->>'event_type',
          'eventTime', v_event_input->>'event_time',
          'gs1IdentityId', v_registry.id,
          'bid', v_batch_bid,
          'evidenceLevel', 'declared_business_event',
          'cryptographicAuthentication', false
        )
      );

      INSERT INTO webhook_deliveries (
        endpoint_id, endpoint_url, event_id, event_name, payload, status,
        attempt_count, next_attempt_at
      )
      SELECT endpoint.id, endpoint.url, v_webhook_event_id,
        'epcis.event.captured', v_webhook_payload, 'pending', 0, now()
      FROM webhook_endpoints endpoint
      WHERE endpoint.tenant_id = v_tenant_id
        AND endpoint.enabled = true
        AND endpoint.deleted_at IS NULL
        AND (endpoint.events ? 'epcis.event.captured' OR endpoint.events ? '*')
      ORDER BY endpoint.updated_at DESC
      LIMIT 25
      ON CONFLICT (endpoint_id, event_id) DO NOTHING;

      v_projection_count := v_projection_count + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_capture_id, v_document_id, v_tenant_id,
    jsonb_array_length(v_events), v_projection_count, v_captured_at, false;
END;
$$;
