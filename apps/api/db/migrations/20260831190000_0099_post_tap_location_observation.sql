-- Additive storage for one consented browser observation made after a SUN tap.
-- It is intentionally separate from canonical event coordinates so a later
-- observation cannot rewrite where the NFC request occurred.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS post_tap_location_observation jsonb;

DO $post_tap_location_observation_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_post_tap_location_observation_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_post_tap_location_observation_check
      CHECK (
        post_tap_location_observation IS NULL OR ((
          jsonb_typeof(post_tap_location_observation) = 'object'
          AND post_tap_location_observation->>'schemaVersion' = 'sun-browser-location-observation/v1'
          AND post_tap_location_observation->>'source' IN (
            'browser_geolocation_approximate_consent',
            'browser_gps_approximate_consent'
          )
          AND post_tap_location_observation->>'consent' = 'true'
          AND post_tap_location_observation->>'precision' = 'approximate'
          AND jsonb_typeof(post_tap_location_observation->'lat') = 'number'
          AND jsonb_typeof(post_tap_location_observation->'lng') = 'number'
          AND jsonb_typeof(post_tap_location_observation->'accuracyM') = 'number'
          AND (post_tap_location_observation->>'lat')::double precision BETWEEN -90 AND 90
          AND (post_tap_location_observation->>'lng')::double precision BETWEEN -180 AND 180
          AND (post_tap_location_observation->>'accuracyM')::double precision BETWEEN 150 AND 50000
          AND (post_tap_location_observation->>'requestedAt')::timestamptz >= created_at - interval '60 seconds'
          AND (post_tap_location_observation->>'measuredAt')::timestamptz
                >= (post_tap_location_observation->>'requestedAt')::timestamptz
          AND (post_tap_location_observation->>'receivedAt')::timestamptz >= created_at
          AND (post_tap_location_observation->>'measuredAt')::timestamptz
                <= (post_tap_location_observation->>'receivedAt')::timestamptz + interval '60 seconds'
        ) IS TRUE)
      ) NOT VALID;
  END IF;
END
$post_tap_location_observation_constraint$;

ALTER TABLE public.events
  VALIDATE CONSTRAINT events_post_tap_location_observation_check;

DO $post_tap_location_observation_postcheck$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'post_tap_location_observation' AND data_type = 'jsonb'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass
      AND conname = 'events_post_tap_location_observation_check'
      AND convalidated
  ) THEN
    RAISE EXCEPTION 'post_tap_location_observation_schema_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END
$post_tap_location_observation_postcheck$;
