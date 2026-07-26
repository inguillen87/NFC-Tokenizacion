UPDATE marketplace_brand_profiles AS profile
SET
  display_name = 'Bodega Balmec',
  description = 'Bodega premium con pasaporte NFC, club, experiencias y ventas asistidas.',
  updated_at = now()
FROM tenants AS tenant
WHERE profile.tenant_id = tenant.id
  AND tenant.slug = 'demobodega';

UPDATE marketplace_products AS product
SET
  description = CASE product.title
    WHEN 'Gran Reserva Malbec 2022'
      THEN 'Compra asistida después de una lectura NFC cuyo mensaje fue validado. Suma puntos y seguimiento comercial desde CRM. Ownership se transfiere solo con pago y validación de la marca.'
    WHEN 'Cabernet Franc Reserva 2022'
      THEN 'Compra asistida después de una lectura NFC cuyo mensaje fue validado. Suma puntos, abre beneficios del club y deja lead comercial sin reclamar ownership automáticamente.'
    WHEN 'Blend de Finca 2021'
      THEN 'Edición de guarda con club, preventa y evidencia criptográfica de lectura NFC. Esa evidencia no certifica por sí sola el contenido ni la condición física.'
    WHEN 'Gran Reserva Malbec - club release'
      THEN 'Oferta de club, puntos y venta asistida desde una lectura NFC válida.'
    ELSE product.description
  END,
  updated_at = now()
FROM tenants AS tenant
WHERE product.tenant_id = tenant.id
  AND tenant.slug = 'demobodega'
  AND product.title IN (
    'Gran Reserva Malbec 2022',
    'Cabernet Franc Reserva 2022',
    'Blend de Finca 2021',
    'Gran Reserva Malbec - club release'
  );

-- Preserve one live resale listing per owned physical UID. Older duplicate
-- rows remain auditable but can no longer race new listings.
WITH ranked_active_resales AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, seller_consumer_id, upper(resale_uid_hex)
      ORDER BY created_at DESC, id DESC
    ) AS position
  FROM marketplace_offers
  WHERE type = 'p2p_resale'
    AND status = 'active'
    AND seller_consumer_id IS NOT NULL
    AND NULLIF(trim(resale_uid_hex), '') IS NOT NULL
)
UPDATE marketplace_offers offer
SET status = 'inactive', updated_at = now()
FROM ranked_active_resales ranked
WHERE offer.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_p2p_active_owner_uid
  ON marketplace_offers (tenant_id, seller_consumer_id, upper(resale_uid_hex))
  WHERE type = 'p2p_resale'
    AND status = 'active'
    AND seller_consumer_id IS NOT NULL
    AND NULLIF(trim(resale_uid_hex), '') IS NOT NULL;

-- A request is a pending commercial intent, not a completed purchase. Keep a
-- single active intent per consumer/product so retries are deterministic.
WITH ranked_active_requests AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY consumer_id, marketplace_product_id
      ORDER BY created_at DESC, id DESC
    ) AS position
  FROM marketplace_order_requests
  WHERE marketplace_product_id IS NOT NULL
    AND status IN ('requested', 'new', 'pending', 'open')
)
UPDATE marketplace_order_requests request
SET status = 'cancelled'
FROM ranked_active_requests ranked
WHERE request.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_marketplace_active_request_consumer_product
  ON marketplace_order_requests (consumer_id, marketplace_product_id)
  WHERE marketplace_product_id IS NOT NULL
    AND status IN ('requested', 'new', 'pending', 'open');

-- Account contact-link challenges are scoped to the authenticated consumer and
-- a single missing channel. A contact-only OTP must never be reusable to
-- mutate another logged-in account.
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS consumer_id uuid REFERENCES consumers(id) ON DELETE CASCADE;
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS purpose text;
ALTER TABLE consumer_auth_challenges ADD COLUMN IF NOT EXISTS channel text;

CREATE INDEX IF NOT EXISTS idx_consumer_auth_challenges_consumer_purpose_created
  ON consumer_auth_challenges (consumer_id, purpose, created_at DESC);

-- A missing evidence-derived score is NULL, not a measured score of zero.
ALTER TABLE consumer_product_experiences ALTER COLUMN trust_score DROP NOT NULL;
ALTER TABLE consumer_product_experiences ALTER COLUMN trust_score DROP DEFAULT;
UPDATE consumer_product_experiences
SET trust_score = NULL
WHERE COALESCE(metadata_json->>'trust_score_status', '') = 'not_computed';

DO $$
DECLARE
  trust_is_not_null boolean;
  trust_default text;
BEGIN
  SELECT a.attnotnull, pg_get_expr(d.adbin, d.adrelid)
  INTO trust_is_not_null, trust_default
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE n.nspname = current_schema()
    AND c.relname = 'consumer_product_experiences'
    AND a.attname = 'trust_score'
    AND NOT a.attisdropped;

  IF trust_is_not_null IS DISTINCT FROM false OR trust_default IS NOT NULL THEN
    RAISE EXCEPTION 'consumer_product_experiences.trust_score must be nullable with no default';
  END IF;
END $$;
