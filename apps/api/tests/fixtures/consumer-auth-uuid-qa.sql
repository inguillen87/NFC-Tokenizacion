-- Disposable PostgreSQL QA for the candidate consumer-auth UUID correction.
-- The CTE below comes from apps/api/src/lib/consumer-auth.ts; only its table
-- and parameters are substituted. No public table or nominal data is touched.
-- Execute the whole file in ONE connection. TEMP state is connection-local.
-- This verifies real SQL types and sequential consumption, not multi-session
-- concurrency or delivery of an OTP. Finish with ROLLBACK.
BEGIN;
SET LOCAL search_path = pg_temp, pg_catalog;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';

CREATE TEMP TABLE nexid_uuid_challenge_test (
  id uuid PRIMARY KEY,
  contact text NOT NULL,
  code_hash text NOT NULL,
  magic_token_hash text,
  expires_at timestamptz,
  locked_until timestamptz,
  used_at timestamptz
) ON COMMIT DROP;
CREATE TEMP TABLE nexid_uuid_qa_results (
  case_name text PRIMARY KEY,
  status text NOT NULL
) ON COMMIT DROP;

-- Reproduce the original query's type failure even with a NULL challenge ID.
DO $baseline_test$
BEGIN
  BEGIN
    EXECUTE $baseline_query$
WITH locked_challenges AS MATERIALIZED (
      SELECT id, contact, code_hash, expires_at, locked_until, used_at
      FROM pg_temp.nexid_uuid_challenge_test
      WHERE ('fixture-group' <> '' AND magic_token_hash = 'fixture-group')
         OR ('fixture-group' = '' AND id = NULL::bigint)
      ORDER BY id
      FOR UPDATE
    ), group_state AS MATERIALIZED (
      SELECT count(*) AS challenge_count,
             bool_or(used_at IS NOT NULL) AS already_used,
             max(locked_until) AS locked_until,
             min(expires_at) AS expires_at,
             bool_or(expires_at IS NULL) AS missing_expiry,
             bool_or(id = NULL::bigint AND code_hash = NULL) AS otp_matches
      FROM locked_challenges
    ), decision AS MATERIALIZED (
      SELECT CASE
        WHEN challenge_count = 0 OR already_used
          OR (NULL::bigint IS NOT NULL AND NOT otp_matches)
          THEN 'invalid_code'
        WHEN locked_until > clock_timestamp() THEN 'locked'
        WHEN missing_expiry OR expires_at <= clock_timestamp() THEN 'expired'
        ELSE NULL
      END AS error
      FROM group_state
    ), consumed AS (
      UPDATE pg_temp.nexid_uuid_challenge_test AS challenge
      SET used_at = clock_timestamp()
      FROM locked_challenges, decision
      WHERE challenge.id = locked_challenges.id
        AND challenge.used_at IS NULL
        AND decision.error IS NULL
      RETURNING challenge.contact
    )
    SELECT contact, NULL::text AS error FROM consumed
    UNION ALL
    SELECT NULL::text AS contact, error FROM decision WHERE error IS NOT NULL
$baseline_query$;
    RAISE EXCEPTION 'original_bigint_query_unexpectedly_planned';
  EXCEPTION WHEN undefined_function THEN
    INSERT INTO pg_temp.nexid_uuid_qa_results VALUES ('original_bigint_operator_rejected', 'passed');
  END;
END
$baseline_test$;

CREATE FUNCTION pg_temp.nexid_uuid_consume(p_token_hash text, p_challenge_id text, p_code_hash text)
RETURNS TABLE(contact text, error text)
LANGUAGE sql
AS $consume$
WITH locked_challenges AS MATERIALIZED (
      SELECT id, contact, code_hash, expires_at, locked_until, used_at
      FROM pg_temp.nexid_uuid_challenge_test
      WHERE (p_token_hash <> '' AND magic_token_hash = p_token_hash)
         OR (p_token_hash = '' AND id = p_challenge_id::uuid)
      ORDER BY id
      FOR UPDATE
    ), group_state AS MATERIALIZED (
      SELECT count(*) AS challenge_count,
             bool_or(used_at IS NOT NULL) AS already_used,
             max(locked_until) AS locked_until,
             min(expires_at) AS expires_at,
             bool_or(expires_at IS NULL) AS missing_expiry,
             bool_or(id = p_challenge_id::uuid AND code_hash = p_code_hash) AS otp_matches
      FROM locked_challenges
    ), decision AS MATERIALIZED (
      SELECT CASE
        WHEN challenge_count = 0 OR already_used
          OR (p_challenge_id::uuid IS NOT NULL AND NOT otp_matches)
          THEN 'invalid_code'
        WHEN locked_until > clock_timestamp() THEN 'locked'
        WHEN missing_expiry OR expires_at <= clock_timestamp() THEN 'expired'
        ELSE NULL
      END AS error
      FROM group_state
    ), consumed AS (
      UPDATE pg_temp.nexid_uuid_challenge_test AS challenge
      SET used_at = clock_timestamp()
      FROM locked_challenges, decision
      WHERE challenge.id = locked_challenges.id
        AND challenge.used_at IS NULL
        AND decision.error IS NULL
      RETURNING challenge.contact
    )
    SELECT contact, NULL::text AS error FROM consumed
    UNION ALL
    SELECT NULL::text AS contact, error FROM decision WHERE error IS NOT NULL
$consume$;

DO $qa$
DECLARE
  first_mode text;
  replay_mode text;
  refusal text;
  token_hash text;
  challenge_id text;
  challenge_code text;
  good_count integer;
  bad_count integer;
  used_count integer;
  expected_count integer;
  expected_error text;
  actual_error text;
  first_id text := '11111111-2222-4333-8444-555555555555';
  second_id text := '66666666-7777-4888-9999-aaaaaaaaaaaa';
BEGIN
  FOREACH first_mode IN ARRAY ARRAY['otp', 'magic', 'legacy'] LOOP
    TRUNCATE pg_temp.nexid_uuid_challenge_test;
    INSERT INTO pg_temp.nexid_uuid_challenge_test(id, contact, code_hash, magic_token_hash, expires_at)
    VALUES
      (first_id::uuid, 'fixture-email@example.invalid', 'fixture-code-hash', CASE WHEN first_mode = 'legacy' THEN NULL ELSE 'fixture-group' END, clock_timestamp() + interval '5 minutes'),
      (second_id::uuid, '+12025550123', 'fixture-code-hash', CASE WHEN first_mode = 'legacy' THEN NULL ELSE 'fixture-group' END, clock_timestamp() + interval '5 minutes');
    token_hash := CASE WHEN first_mode = 'legacy' THEN '' ELSE 'fixture-group' END;
    challenge_id := CASE WHEN first_mode = 'magic' THEN NULL ELSE first_id END;
    challenge_code := CASE WHEN first_mode = 'magic' THEN NULL ELSE 'fixture-code-hash' END;
    expected_count := CASE WHEN first_mode = 'legacy' THEN 1 ELSE 2 END;
    SELECT count(*) FILTER (WHERE q.error IS NULL), count(*) FILTER (WHERE q.error IS NOT NULL), min(q.error)
      INTO good_count, bad_count, actual_error
      FROM pg_temp.nexid_uuid_consume(token_hash, challenge_id, challenge_code) AS q;
    SELECT count(*) INTO used_count FROM pg_temp.nexid_uuid_challenge_test WHERE used_at IS NOT NULL;
    IF good_count <> expected_count OR bad_count <> 0 OR used_count <> expected_count OR actual_error IS NOT NULL THEN
      RAISE EXCEPTION 'uuid_%_consumption_failed', first_mode;
    END IF;
    INSERT INTO pg_temp.nexid_uuid_qa_results VALUES (first_mode || '_uuid_consumed', 'passed');

    FOREACH replay_mode IN ARRAY ARRAY['otp', 'magic'] LOOP
      challenge_id := CASE WHEN replay_mode = 'magic' THEN NULL ELSE first_id END;
      challenge_code := CASE WHEN replay_mode = 'magic' THEN NULL ELSE 'fixture-code-hash' END;
      SELECT count(*) FILTER (WHERE q.error IS NULL), count(*) FILTER (WHERE q.error IS NOT NULL), min(q.error)
        INTO good_count, bad_count, actual_error
        FROM pg_temp.nexid_uuid_consume(CASE WHEN replay_mode = 'magic' THEN 'fixture-group' ELSE token_hash END, challenge_id, challenge_code) AS q;
      SELECT count(*) INTO used_count FROM pg_temp.nexid_uuid_challenge_test WHERE used_at IS NOT NULL;
      IF good_count <> 0 OR bad_count <> 1 OR actual_error IS DISTINCT FROM 'invalid_code' OR used_count <> expected_count THEN
        RAISE EXCEPTION '%_after_%_reuse_failed', replay_mode, first_mode;
      END IF;
      INSERT INTO pg_temp.nexid_uuid_qa_results VALUES (replay_mode || '_after_' || first_mode || '_rejected', 'passed');
    END LOOP;
  END LOOP;

  FOREACH refusal IN ARRAY ARRAY['missing_token', 'missing_id', 'null_legacy_id', 'wrong_code', 'already_used', 'expired', 'locked', 'missing_expiry'] LOOP
    TRUNCATE pg_temp.nexid_uuid_challenge_test;
    INSERT INTO pg_temp.nexid_uuid_challenge_test(id, contact, code_hash, magic_token_hash, expires_at)
    VALUES
      (first_id::uuid, 'fixture-email@example.invalid', 'fixture-code-hash', 'fixture-group', clock_timestamp() + interval '5 minutes'),
      (second_id::uuid, '+12025550123', 'fixture-code-hash', 'fixture-group', clock_timestamp() + interval '5 minutes');
    token_hash := 'fixture-group';
    challenge_id := first_id;
    challenge_code := 'fixture-code-hash';
    expected_error := 'invalid_code';
    IF refusal = 'missing_token' THEN token_hash := 'unknown-fixture-group'; challenge_id := NULL; challenge_code := NULL; END IF;
    IF refusal = 'missing_id' THEN challenge_id := 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'; END IF;
    IF refusal = 'null_legacy_id' THEN token_hash := ''; challenge_id := NULL; END IF;
    IF refusal = 'wrong_code' THEN challenge_code := 'different-fixture-hash'; END IF;
    IF refusal = 'already_used' THEN
      UPDATE pg_temp.nexid_uuid_challenge_test SET used_at = clock_timestamp() WHERE id = second_id::uuid;
    END IF;
    IF refusal = 'expired' THEN
      UPDATE pg_temp.nexid_uuid_challenge_test SET expires_at = clock_timestamp() - interval '1 minute' WHERE id = second_id::uuid;
      expected_error := 'expired';
    END IF;
    IF refusal = 'locked' THEN
      UPDATE pg_temp.nexid_uuid_challenge_test SET locked_until = clock_timestamp() + interval '5 minutes' WHERE id = second_id::uuid;
      expected_error := 'locked';
    END IF;
    IF refusal = 'missing_expiry' THEN
      UPDATE pg_temp.nexid_uuid_challenge_test SET expires_at = NULL WHERE id = second_id::uuid;
      expected_error := 'expired';
    END IF;
    expected_count := CASE WHEN refusal = 'already_used' THEN 1 ELSE 0 END;
    SELECT count(*) FILTER (WHERE q.error IS NULL), count(*) FILTER (WHERE q.error IS NOT NULL), min(q.error)
      INTO good_count, bad_count, actual_error
      FROM pg_temp.nexid_uuid_consume(token_hash, challenge_id, challenge_code) AS q;
    SELECT count(*) INTO used_count FROM pg_temp.nexid_uuid_challenge_test WHERE used_at IS NOT NULL;
    IF good_count <> 0 OR bad_count <> 1 OR actual_error IS DISTINCT FROM expected_error OR used_count <> expected_count THEN
      RAISE EXCEPTION 'uuid_%_fail_closed_failed', refusal;
    END IF;
    INSERT INTO pg_temp.nexid_uuid_qa_results VALUES (refusal || '_rejected_without_consumption', 'passed');
  END LOOP;
END
$qa$;

SELECT case_name, status FROM pg_temp.nexid_uuid_qa_results ORDER BY case_name;
ROLLBACK;
