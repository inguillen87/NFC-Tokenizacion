-- Additive canonical storage for location provenance captured around a SUN tap.
-- Existing events remain NULL; this migration does not infer or backfill evidence.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_accuracy_m double precision,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

DO $event_location_context_postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location_accuracy_m'
      AND data_type = 'double precision'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location_source'
      AND data_type = 'text'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'location_updated_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'event_location_context_schema_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END
$event_location_context_postcheck$;
