-- Reconcile the historical production webhook delivery identity with the
-- canonical bigint contract introduced by 0004 and consumed by 0088.
--
-- Some long-lived databases were provisioned with UUID delivery identities.
-- Rewriting populated delivery identities would sever webhook audit history,
-- so this bridge is deliberately fail-closed unless the table is empty and no
-- foreign key already depends on the UUID column.

DO $$
DECLARE
  v_id_type text;
  v_delivery_count bigint;
  v_foreign_key_count integer;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_id_type
  FROM pg_attribute attribute
  WHERE attribute.attrelid = 'public.webhook_deliveries'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  IF v_id_type IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42P01',
      MESSAGE = 'webhook_deliveries_identity_missing';
  END IF;

  IF v_id_type = 'uuid' THEN
    SELECT count(*) INTO v_delivery_count FROM public.webhook_deliveries;
    IF v_delivery_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'webhook_deliveries_uuid_identity_has_rows';
    END IF;

    SELECT count(*)::integer
      INTO v_foreign_key_count
    FROM pg_constraint dependency
    WHERE dependency.contype = 'f'
      AND dependency.confrelid = 'public.webhook_deliveries'::regclass;
    IF v_foreign_key_count <> 0 THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE = 'webhook_deliveries_uuid_identity_has_dependents';
    END IF;

    ALTER TABLE public.webhook_deliveries
      ALTER COLUMN id DROP DEFAULT,
      ALTER COLUMN id TYPE bigint USING NULL::bigint;
  ELSIF v_id_type <> 'bigint' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'webhook_deliveries_identity_type_unsupported';
  END IF;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS public.webhook_deliveries_id_seq AS bigint;

ALTER SEQUENCE public.webhook_deliveries_id_seq
  OWNED BY public.webhook_deliveries.id;

ALTER TABLE public.webhook_deliveries
  ALTER COLUMN id SET DEFAULT nextval('public.webhook_deliveries_id_seq'::regclass);

DO $$
BEGIN
  IF (
    SELECT format_type(attribute.atttypid, attribute.atttypmod)
    FROM pg_attribute attribute
    WHERE attribute.attrelid = 'public.webhook_deliveries'::regclass
      AND attribute.attname = 'id'
      AND NOT attribute.attisdropped
  ) <> 'bigint' THEN
    RAISE EXCEPTION USING
      ERRCODE = '42804',
      MESSAGE = 'webhook_deliveries_identity_bridge_failed';
  END IF;
END;
$$;
