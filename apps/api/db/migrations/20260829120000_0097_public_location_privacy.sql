-- Additive compatibility for public location projections. Some historical
-- installations model geo_precision as text, while older enterprise schemas
-- use the public.geo_precision enum.
DO $public_location_privacy$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'geo_precision'
      AND t.typtype = 'e'
      AND n.nspname = 'public'
  ) THEN
    ALTER TYPE public.geo_precision ADD VALUE IF NOT EXISTS 'approximate';
  END IF;
END
$public_location_privacy$;
