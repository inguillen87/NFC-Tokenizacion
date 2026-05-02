CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS claim_policy text;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS ownership_policy jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenant_sun_profiles ADD COLUMN IF NOT EXISTS manifest_policy jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenant_sun_profiles ALTER COLUMN vertical DROP DEFAULT;
ALTER TABLE tenant_sun_profiles ALTER COLUMN tokenization_mode DROP DEFAULT;

UPDATE tenant_sun_profiles tsp
SET
  claim_policy = COALESCE(NULLIF(tsp.claim_policy, ''), 'purchase_proof_required'),
  ownership_policy = CASE
    WHEN tsp.ownership_policy = '{}'::jsonb THEN '{"requiresPurchaseProof":true,"requiresFreshTap":true,"requiresTenantMembership":true,"allowsPublicClaim":false,"antiReplayRequired":true}'::jsonb
    ELSE tsp.ownership_policy
  END,
  manifest_policy = CASE
    WHEN tsp.manifest_policy = '{}'::jsonb THEN '{"acceptedFormats":["csv","txt"],"requiredColumns":["uid_hex"],"csvOptionalColumns":["batch_id","product_name","sku","lot","serial","expires_at"],"activateDefault":false,"rejectDuplicates":true}'::jsonb
    ELSE tsp.manifest_policy
  END,
  metadata = tsp.metadata || '{"loyalty":{"pointsName":"Uvas","rules":{"pointsPerValidTap":10,"cooldownSeconds":3600},"rewards":[{"code":"WELCOME-10","title":"10% off proxima compra","description":"Descuento para compra directa de bodega.","type":"DISCOUNT","points":40,"stock":500},{"code":"TASTING-UP","title":"Upgrade de degustacion","description":"Acceso a cata premium durante la visita.","type":"TASTING","points":80,"stock":120},{"code":"TOUR-BARRICA","title":"Tour de barrica","description":"Visita guiada de barricas y proceso.","type":"TOUR","points":120,"stock":80}]}}'::jsonb,
  updated_at = now()
FROM tenants t
WHERE t.id = tsp.tenant_id
  AND t.slug = 'demobodega';

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
