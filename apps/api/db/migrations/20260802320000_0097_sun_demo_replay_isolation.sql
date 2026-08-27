-- Keep simulated Demo Lab traffic outside the canonical physical-tag replay
-- watermark. Demo and operational (real/imported) scans remain durable and
-- replay-protected inside their own execution class, but neither class can
-- manufacture a replay in the other one.

DO $sun_demo_replay_preflight$
BEGIN
  IF to_regprocedure('public.nexid_persist_sun_scan_v1(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_persist_sun_scan_v1_base_0062(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)') IS NULL
    OR to_regprocedure('public.nexid_sun_tt_conflict_target_v1_capability()') IS NULL
    OR to_regprocedure('public.nexid_enterprise_rbac_risk_truth_v1_capability()') IS NULL
  THEN
    RAISE EXCEPTION 'sun_demo_replay_isolation_requires_0096' USING ERRCODE = '42883';
  END IF;
END
$sun_demo_replay_preflight$;

-- The historical primitive is private and is called by the 0093 TT wrapper.
-- Patch only the reviewed 0089 fragments and fail closed if the deployed
-- definition differs, rather than replacing an unknown function body.
DO $sun_demo_replay_patch$
DECLARE
  v_definition text;
  v_old text;
  v_new text;
  v_occurrences integer;
BEGIN
  SELECT pg_get_functiondef(
    to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
  ) INTO v_definition;

  -- PostgreSQL preserves the line endings used when the historical function
  -- body was installed. Normalizing CRLF here keeps the exact-fragment guards
  -- deterministic across Windows and Linux migration runners; it does not
  -- relax any semantic match below.
  v_definition := replace(v_definition, E'\r\n', E'\n');
  v_definition := replace(v_definition, E'\r', E'\n');

  v_old := $old_decl$  v_source text;
  v_lat double precision;$old_decl$;
  v_new := $new_decl$  v_source text;
  v_execution_class text;
  v_lat double precision;$new_decl$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_declaration_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_payload$  SELECT e.id
    INTO v_replay_original_event_id
  FROM events e
  WHERE e.batch_id = v_batch_id
    AND (
      (e.picc_data_hash = v_picc_data_hash AND e.cmac_hash = v_cmac_hash)
      OR e.raw_url_hash = v_raw_url_hash
    )
  ORDER BY e.created_at ASC, e.id ASC
  LIMIT 1;$old_payload$;
  v_new := $new_payload$  v_source := CASE LOWER(COALESCE(NULLIF(p_input->>'source', ''), 'real'))
    WHEN 'demo' THEN 'demo'
    WHEN 'imported' THEN 'imported'
    ELSE 'real'
  END;
  v_execution_class := CASE WHEN v_source = 'demo' THEN 'demo' ELSE 'operational' END;

  SELECT e.id
    INTO v_replay_original_event_id
  FROM events e
  WHERE e.batch_id = v_batch_id
    AND (CASE WHEN LOWER(COALESCE(e.source::text, 'real')) = 'demo' THEN 'demo' ELSE 'operational' END) = v_execution_class
    AND (
      (e.picc_data_hash = v_picc_data_hash AND e.cmac_hash = v_cmac_hash)
      OR e.raw_url_hash = v_raw_url_hash
    )
  ORDER BY e.created_at ASC, e.id ASC
  LIMIT 1;$new_payload$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_payload_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_counter$    FROM events e
    WHERE e.batch_id = v_batch_id
      AND UPPER(e.uid_hex) = v_uid_hex
      AND e.sdm_read_ctr = v_ctr
    ORDER BY e.created_at ASC, e.id ASC
    LIMIT 1;$old_counter$;
  v_new := $new_counter$    FROM events e
    WHERE e.batch_id = v_batch_id
      AND (CASE WHEN LOWER(COALESCE(e.source::text, 'real')) = 'demo' THEN 'demo' ELSE 'operational' END) = v_execution_class
      AND UPPER(e.uid_hex) = v_uid_hex
      AND e.sdm_read_ctr = v_ctr
    ORDER BY e.created_at ASC, e.id ASC
    LIMIT 1;$new_counter$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_counter_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_watermark$    IF v_previous_last_seen_ctr IS NOT NULL AND v_ctr <= v_previous_last_seen_ctr THEN
      v_replay_suspect := true;
    END IF;$old_watermark$;
  v_new := $new_watermark$    IF v_execution_class = 'operational'
      AND v_previous_last_seen_ctr IS NOT NULL
      AND v_ctr <= v_previous_last_seen_ctr THEN
      v_replay_suspect := true;
    END IF;$new_watermark$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_watermark_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_tag_update$  IF v_tag_id IS NOT NULL THEN
    UPDATE tags t
    SET scan_count = t.scan_count + 1,
        first_seen_at = COALESCE(t.first_seen_at, now()),
        last_seen_at = now(),
        last_seen_ctr = CASE
          WHEN v_ctr IS NULL THEN t.last_seen_ctr
          ELSE GREATEST(COALESCE(t.last_seen_ctr, -1), v_ctr)
        END
    WHERE t.id = v_tag_id
    RETURNING t.last_seen_ctr, t.scan_count
      INTO v_last_seen_ctr, v_scan_count;
  ELSE
    v_last_seen_ctr := NULL;
    v_scan_count := NULL;
  END IF;$old_tag_update$;
  v_new := $new_tag_update$  IF v_tag_id IS NOT NULL AND v_execution_class = 'operational' THEN
    UPDATE tags t
    SET scan_count = t.scan_count + 1,
        first_seen_at = COALESCE(t.first_seen_at, now()),
        last_seen_at = now(),
        last_seen_ctr = CASE
          WHEN v_ctr IS NULL THEN t.last_seen_ctr
          ELSE GREATEST(COALESCE(t.last_seen_ctr, -1), v_ctr)
        END
    WHERE t.id = v_tag_id
    RETURNING t.last_seen_ctr, t.scan_count
      INTO v_last_seen_ctr, v_scan_count;
  ELSIF v_tag_id IS NOT NULL THEN
    -- A demo receipt reports the canonical tag snapshot without mutating it.
    v_last_seen_ctr := v_previous_last_seen_ctr;
  ELSE
    v_last_seen_ctr := NULL;
    v_scan_count := NULL;
  END IF;$new_tag_update$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_tag_update_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := $old_meta$  ) || jsonb_build_object(
    'enc_data_hash', v_enc_hash,
    'replay_original_event_id', v_replay_original_event_id
  );$old_meta$;
  v_new := $new_meta$  ) || jsonb_build_object(
    'enc_data_hash', v_enc_hash,
    'replay_original_event_id', v_replay_original_event_id,
    'replay_execution_class', v_execution_class
  );$new_meta$;
  v_occurrences := (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old);
  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'sun_demo_replay_meta_source_mismatch' USING ERRCODE = '55000';
  END IF;
  v_definition := replace(v_definition, v_old, v_new);

  EXECUTE v_definition;
END
$sun_demo_replay_patch$;

ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) SECURITY INVOKER;
ALTER FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)
  SET search_path TO pg_catalog, public, pg_temp;
REVOKE ALL ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) FROM PUBLIC;

-- Record the bounded one-time watermark repair before changing any tag. The
-- history is append-only and carries no raw UID, query, IP or location data.
CREATE TABLE IF NOT EXISTS public.sun_replay_watermark_repairs (
  repair_version text NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE RESTRICT,
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  previous_last_seen_ctr integer,
  repaired_last_seen_ctr integer,
  observed_scan_count integer NOT NULL,
  observed_first_seen_at timestamptz,
  observed_last_seen_at timestamptz,
  non_demo_event_count bigint NOT NULL,
  verified_non_demo_event_count bigint NOT NULL,
  demo_event_count bigint NOT NULL,
  evidence_digest text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (repair_version, tag_id),
  CONSTRAINT sun_replay_watermark_repairs_version_check CHECK (
    repair_version = 'sun-demo-replay-isolation/v1'
  ),
  CONSTRAINT sun_replay_watermark_repairs_counts_check CHECK (
    observed_scan_count >= 0
    AND non_demo_event_count >= 0
    AND verified_non_demo_event_count >= 0
    AND verified_non_demo_event_count <= non_demo_event_count
    AND demo_event_count > 0
  ),
  CONSTRAINT sun_replay_watermark_repairs_digest_check CHECK (
    evidence_digest ~ '^sha256:[0-9a-f]{64}$'
  )
);

CREATE OR REPLACE FUNCTION public.nexid_sun_replay_watermark_repair_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'sun_replay_watermark_repair_is_append_only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_sun_replay_watermark_repairs_append_only
  ON public.sun_replay_watermark_repairs;
CREATE TRIGGER trg_sun_replay_watermark_repairs_append_only
BEFORE UPDATE OR DELETE ON public.sun_replay_watermark_repairs
FOR EACH ROW EXECUTE FUNCTION public.nexid_sun_replay_watermark_repair_immutable_v1();

DO $sun_demo_watermark_repair$
DECLARE
  v_tag record;
  v_current record;
  v_repaired_last_seen_ctr integer;
  v_non_demo_event_count bigint;
  v_verified_non_demo_event_count bigint;
  v_demo_event_count bigint;
  v_evidence_digest text;
  v_inserted integer;
BEGIN
  FOR v_tag IN
    SELECT tag.id, tag.batch_id, tag.uid_hex
    FROM public.tags tag
    WHERE EXISTS (
      SELECT 1
      FROM public.events event
      WHERE event.batch_id = tag.batch_id
        AND UPPER(event.uid_hex) = UPPER(tag.uid_hex)
        AND LOWER(COALESCE(event.source::text, 'real')) = 'demo'
    )
    ORDER BY tag.batch_id, tag.id
  LOOP
    -- This is the same per-tag advisory lock used by SUN persistence. The lock
    -- plus the row lock prevents a live physical tap from racing the repair.
    PERFORM pg_advisory_xact_lock(
      hashtext(v_tag.batch_id::text),
      hashtext('uid:' || UPPER(v_tag.uid_hex))
    );

    SELECT
      tag.last_seen_ctr,
      tag.scan_count,
      tag.first_seen_at,
      tag.last_seen_at
    INTO STRICT v_current
    FROM public.tags tag
    WHERE tag.id = v_tag.id
    FOR UPDATE;

    SELECT
      MAX(COALESCE(event.sdm_read_ctr, event.read_counter))
        FILTER (
          WHERE LOWER(COALESCE(event.source::text, 'real')) <> 'demo'
            AND event.cmac_ok IS TRUE
            AND COALESCE(event.sdm_read_ctr, event.read_counter) IS NOT NULL
        )::integer,
      COUNT(event.id)
        FILTER (WHERE LOWER(COALESCE(event.source::text, 'real')) <> 'demo')::bigint,
      COUNT(event.id)
        FILTER (
          WHERE LOWER(COALESCE(event.source::text, 'real')) <> 'demo'
            AND event.cmac_ok IS TRUE
            AND COALESCE(event.sdm_read_ctr, event.read_counter) IS NOT NULL
        )::bigint,
      COUNT(event.id)
        FILTER (WHERE LOWER(COALESCE(event.source::text, 'real')) = 'demo')::bigint
    INTO
      v_repaired_last_seen_ctr,
      v_non_demo_event_count,
      v_verified_non_demo_event_count,
      v_demo_event_count
    FROM public.events event
    WHERE event.batch_id = v_tag.batch_id
      AND UPPER(event.uid_hex) = UPPER(v_tag.uid_hex);

    IF v_demo_event_count > 0
      AND v_current.last_seen_ctr IS DISTINCT FROM v_repaired_last_seen_ctr THEN
      v_evidence_digest := 'sha256:' || encode(digest(convert_to(jsonb_build_object(
        'repair_version', 'sun-demo-replay-isolation/v1',
        'tag_id', v_tag.id,
        'batch_id', v_tag.batch_id,
        'previous_last_seen_ctr', v_current.last_seen_ctr,
        'repaired_last_seen_ctr', v_repaired_last_seen_ctr,
        'observed_scan_count', v_current.scan_count,
        'observed_first_seen_at', v_current.first_seen_at,
        'observed_last_seen_at', v_current.last_seen_at,
        'non_demo_event_count', v_non_demo_event_count,
        'verified_non_demo_event_count', v_verified_non_demo_event_count,
        'demo_event_count', v_demo_event_count
      )::text, 'UTF8'), 'sha256'), 'hex');

      INSERT INTO public.sun_replay_watermark_repairs (
        repair_version,
        tag_id,
        batch_id,
        previous_last_seen_ctr,
        repaired_last_seen_ctr,
        observed_scan_count,
        observed_first_seen_at,
        observed_last_seen_at,
        non_demo_event_count,
        verified_non_demo_event_count,
        demo_event_count,
        evidence_digest
      ) VALUES (
        'sun-demo-replay-isolation/v1',
        v_tag.id,
        v_tag.batch_id,
        v_current.last_seen_ctr,
        v_repaired_last_seen_ctr,
        v_current.scan_count,
        v_current.first_seen_at,
        v_current.last_seen_at,
        v_non_demo_event_count,
        v_verified_non_demo_event_count,
        v_demo_event_count,
        v_evidence_digest
      ) ON CONFLICT (repair_version, tag_id) DO NOTHING;
      GET DIAGNOSTICS v_inserted = ROW_COUNT;

      IF v_inserted = 1 THEN
        UPDATE public.tags tag
        SET last_seen_ctr = v_repaired_last_seen_ctr
        WHERE tag.id = v_tag.id;
      END IF;
    END IF;
  END LOOP;
END
$sun_demo_watermark_repair$;

REVOKE ALL ON TABLE public.sun_replay_watermark_repairs FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_sun_replay_watermark_repair_immutable_v1() FROM PUBLIC;

-- Preserve automated dereferences as auditable evidence without allowing them
-- to count as human taps in analytics or geographic heatmaps. Only explicit
-- user-agent signatures are recoverable historically; prefetch-only headers
-- are handled by the /sun request guard because events never stored them.
CREATE OR REPLACE FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1(
  p_user_agent text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN strpos(lower(COALESCE(p_user_agent, '')), 'google-read-aloud') > 0
      THEN 'google_read_aloud'
    WHEN lower(COALESCE(p_user_agent, '')) LIKE ANY (ARRAY[
      '%googlebot%',
      '%bingbot%',
      '%duckduckbot%',
      '%yandexbot%',
      '%baiduspider%',
      '%applebot%',
      '%pinterestbot%',
      '%semrushbot%',
      '%ahrefsbot%',
      '%gptbot%',
      '%chatgpt-user%',
      '%claudebot%',
      '%perplexitybot%'
    ]::text[])
      THEN 'crawler'
    WHEN lower(COALESCE(p_user_agent, '')) LIKE ANY (ARRAY[
      '%facebookexternalhit%',
      '%facebot%',
      '%twitterbot%',
      '%linkedinbot%',
      '%slackbot%',
      '%discordbot%',
      '%telegrambot%',
      '%skypeuripreview%'
    ]::text[])
      THEN 'link_preview'
    ELSE NULL
  END
$$;

CREATE TABLE IF NOT EXISTS public.sun_automated_fetch_quarantines (
  classification_version text NOT NULL,
  event_id bigint NOT NULL,
  event_created_at timestamptz NOT NULL,
  reason text NOT NULL,
  user_agent_digest text NOT NULL,
  had_geo boolean NOT NULL,
  classified_by text NOT NULL,
  classified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (classification_version, event_id, event_created_at),
  CONSTRAINT fk_sun_automated_fetch_quarantine_event
    FOREIGN KEY (event_id, event_created_at)
    REFERENCES public.events(id, created_at) ON DELETE RESTRICT,
  CONSTRAINT sun_automated_fetch_quarantine_version_check CHECK (
    classification_version = 'sun-automated-fetch/v1'
  ),
  CONSTRAINT sun_automated_fetch_quarantine_reason_check CHECK (
    reason IN ('google_read_aloud', 'crawler', 'link_preview')
  ),
  CONSTRAINT sun_automated_fetch_quarantine_digest_check CHECK (
    user_agent_digest ~ '^sha256:[0-9a-f]{64}$'
  ),
  CONSTRAINT sun_automated_fetch_quarantine_classifier_check CHECK (
    classified_by IN ('migration_backfill', 'event_insert_guard')
  )
);

CREATE OR REPLACE FUNCTION public.nexid_sun_automated_fetch_quarantine_immutable_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'sun_automated_fetch_quarantine_is_append_only' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_sun_automated_fetch_quarantines_append_only
  ON public.sun_automated_fetch_quarantines;
CREATE TRIGGER trg_sun_automated_fetch_quarantines_append_only
BEFORE UPDATE OR DELETE ON public.sun_automated_fetch_quarantines
FOR EACH ROW EXECUTE FUNCTION public.nexid_sun_automated_fetch_quarantine_immutable_v1();

-- Defense in depth for any future event writer that bypasses the HTTP guard:
-- the canonical event remains immutable, but it is immediately quarantined
-- from all analytics through the same explicit classifier.
CREATE OR REPLACE FUNCTION public.nexid_capture_sun_automated_fetch_quarantine_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, pg_temp
AS $$
DECLARE
  v_reason text;
BEGIN
  v_reason := public.nexid_classify_sun_automated_fetch_user_agent_v1(NEW.user_agent);
  IF v_reason IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sun_automated_fetch_quarantines (
    classification_version,
    event_id,
    event_created_at,
    reason,
    user_agent_digest,
    had_geo,
    classified_by
  ) VALUES (
    'sun-automated-fetch/v1',
    NEW.id,
    NEW.created_at,
    v_reason,
    'sha256:' || encode(digest(convert_to(COALESCE(NEW.user_agent, ''), 'UTF8'), 'sha256'), 'hex'),
    COALESCE(
      (NEW.lat BETWEEN -90 AND 90 AND NEW.lng BETWEEN -180 AND 180)
      OR (NEW.geo_lat BETWEEN -90 AND 90 AND NEW.geo_lng BETWEEN -180 AND 180),
      false
    ),
    'event_insert_guard'
  ) ON CONFLICT (classification_version, event_id, event_created_at) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_capture_sun_automated_fetch_v1 ON public.events;
CREATE TRIGGER trg_events_capture_sun_automated_fetch_v1
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.nexid_capture_sun_automated_fetch_quarantine_v1();

INSERT INTO public.sun_automated_fetch_quarantines (
  classification_version,
  event_id,
  event_created_at,
  reason,
  user_agent_digest,
  had_geo,
  classified_by
)
SELECT
  'sun-automated-fetch/v1',
  event.id,
  event.created_at,
  public.nexid_classify_sun_automated_fetch_user_agent_v1(event.user_agent),
  'sha256:' || encode(digest(convert_to(COALESCE(event.user_agent, ''), 'UTF8'), 'sha256'), 'hex'),
  COALESCE(
    (event.lat BETWEEN -90 AND 90 AND event.lng BETWEEN -180 AND 180)
    OR (event.geo_lat BETWEEN -90 AND 90 AND event.geo_lng BETWEEN -180 AND 180),
    false
  ),
  'migration_backfill'
FROM public.events event
WHERE public.nexid_classify_sun_automated_fetch_user_agent_v1(event.user_agent) IS NOT NULL
ON CONFLICT (classification_version, event_id, event_created_at) DO NOTHING;

REVOKE ALL ON TABLE public.sun_automated_fetch_quarantines FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_sun_automated_fetch_quarantine_immutable_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_capture_sun_automated_fetch_quarantine_v1() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability()
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SECURITY INVOKER
SET search_path TO pg_catalog, public, pg_temp
AS $$
  SELECT 'sun-demo-replay-isolation/v1'::text
$$;

REVOKE ALL ON FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability() FROM PUBLIC;

DO $sun_demo_replay_postcheck$
DECLARE
  v_definition text;
  v_execution_filter_count integer;
BEGIN
  SELECT pg_get_functiondef(
    to_regprocedure('public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb)')
  ) INTO v_definition;

  v_execution_filter_count := (
    length(v_definition)
      - length(replace(
          v_definition,
          '(CASE WHEN LOWER(COALESCE(e.source::text, ''real'')) = ''demo'' THEN ''demo'' ELSE ''operational'' END) = v_execution_class',
          ''
        ))
  ) / length('(CASE WHEN LOWER(COALESCE(e.source::text, ''real'')) = ''demo'' THEN ''demo'' ELSE ''operational'' END) = v_execution_class');

  IF v_execution_filter_count IS DISTINCT FROM 2
    OR position('IF v_execution_class = ''operational''' IN v_definition) = 0
    OR position('IF v_tag_id IS NOT NULL AND v_execution_class = ''operational''' IN v_definition) = 0
    OR position('''replay_execution_class'', v_execution_class' IN v_definition) = 0
    OR to_regclass('public.sun_replay_watermark_repairs') IS NULL
    OR to_regclass('public.sun_automated_fetch_quarantines') IS NULL
    OR to_regprocedure('public.nexid_classify_sun_automated_fetch_user_agent_v1(text)') IS NULL
    OR to_regprocedure('public.nexid_capture_sun_automated_fetch_quarantine_v1()') IS NULL
    OR to_regprocedure('public.nexid_sun_demo_replay_isolation_v1_capability()') IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_trigger trg
      WHERE trg.tgrelid = 'public.events'::regclass
        AND trg.tgname = 'trg_events_capture_sun_automated_fetch_v1'
        AND trg.tgisinternal IS FALSE
    )
    OR EXISTS (
      SELECT 1
      FROM public.events event
      LEFT JOIN public.sun_automated_fetch_quarantines quarantine
        ON quarantine.classification_version = 'sun-automated-fetch/v1'
       AND quarantine.event_id = event.id
       AND quarantine.event_created_at = event.created_at
      WHERE public.nexid_classify_sun_automated_fetch_user_agent_v1(event.user_agent) IS NOT NULL
        AND quarantine.event_id IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.sun_automated_fetch_quarantines quarantine
      JOIN public.events event
        ON event.id = quarantine.event_id
       AND event.created_at = quarantine.event_created_at
      WHERE quarantine.classification_version = 'sun-automated-fetch/v1'
        AND (
          quarantine.reason IS DISTINCT FROM public.nexid_classify_sun_automated_fetch_user_agent_v1(event.user_agent)
          OR quarantine.user_agent_digest IS DISTINCT FROM (
            'sha256:' || encode(digest(convert_to(COALESCE(event.user_agent, ''), 'UTF8'), 'sha256'), 'hex')
          )
          OR quarantine.had_geo IS DISTINCT FROM COALESCE(
            (event.lat BETWEEN -90 AND 90 AND event.lng BETWEEN -180 AND 180)
            OR (event.geo_lat BETWEEN -90 AND 90 AND event.geo_lng BETWEEN -180 AND 180),
            false
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.tags tag
      WHERE EXISTS (
        SELECT 1
        FROM public.events demo_event
        WHERE demo_event.batch_id = tag.batch_id
          AND UPPER(demo_event.uid_hex) = UPPER(tag.uid_hex)
          AND LOWER(COALESCE(demo_event.source::text, 'real')) = 'demo'
      )
        AND tag.last_seen_ctr IS DISTINCT FROM (
          SELECT MAX(COALESCE(real_event.sdm_read_ctr, real_event.read_counter))::integer
          FROM public.events real_event
          WHERE real_event.batch_id = tag.batch_id
            AND UPPER(real_event.uid_hex) = UPPER(tag.uid_hex)
            AND LOWER(COALESCE(real_event.source::text, 'real')) <> 'demo'
            AND real_event.cmac_ok IS TRUE
            AND COALESCE(real_event.sdm_read_ctr, real_event.read_counter) IS NOT NULL
        )
    )
  THEN
    RAISE EXCEPTION 'sun_demo_replay_isolation_postcondition_failed' USING ERRCODE = '55000';
  END IF;
END
$sun_demo_replay_postcheck$;

COMMENT ON TABLE public.sun_replay_watermark_repairs IS
  'Append-only audit of the one-time repair that removes synthetic demo counters from canonical physical tag watermarks.';

COMMENT ON TABLE public.sun_automated_fetch_quarantines IS
  'Append-only receipts for explicit automated SUN dereferences. Raw user-agent values are retained only on their immutable source events; receipts store a SHA-256 digest.';

COMMENT ON FUNCTION public.nexid_classify_sun_automated_fetch_user_agent_v1(text) IS
  'Versioned explicit classifier shared by the historical SUN automated-fetch quarantine. Prefetch-only headers are unavailable in historical event rows.';

COMMENT ON FUNCTION public.nexid_persist_sun_scan_v1_base_pre_tt_0093(jsonb) IS
  'Atomic SUN primitive with isolated demo and operational replay classes. Demo events never mutate canonical physical tag counters.';

COMMENT ON FUNCTION public.nexid_sun_demo_replay_isolation_v1_capability() IS
  'Private capability marker for SUN demo versus operational replay isolation.';
