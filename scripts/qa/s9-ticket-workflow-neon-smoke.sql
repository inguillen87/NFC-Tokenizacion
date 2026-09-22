-- Run ONLY on the temporary Neon migration branch, after 0112 is applied.
-- Synthetic fixtures and all their changes are rolled back in a subtransaction.
-- No existing business row is modified. Success is completion without an error.
DO $qa$
DECLARE
  tenant_a uuid := gen_random_uuid(); tenant_b uuid := gen_random_uuid();
  actor uuid := gen_random_uuid(); ticket uuid := gen_random_uuid();
  incident_ticket uuid := gen_random_uuid(); legacy_ticket uuid := gen_random_uuid();
  request_one uuid := gen_random_uuid(); request_two uuid := gen_random_uuid();
  slug_a text := 'qa-s9-workflow-' || tenant_a::text;
  slug_b text := 'qa-s9-workflow-' || tenant_b::text;
  initial jsonb; changed jsonb; replayed jsonb; closed jsonb; history jsonb; rejected jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.schema_migrations WHERE id='20260922100000_0112_support_ticket_workflow.sql') THEN
    RAISE EXCEPTION '0112 ledger missing';
  END IF;
  BEGIN
    INSERT INTO public.tenants(id,slug,name,root_key_ct) VALUES
      (tenant_a,slug_a,'Synthetic workflow QA A','synthetic-unused-root'),
      (tenant_b,slug_b,'Synthetic workflow QA B','synthetic-unused-root');
    INSERT INTO public.users(id,email) VALUES(actor,'qa-s9-workflow-' || actor::text || '@example.invalid');
    INSERT INTO public.memberships(user_id,tenant_id,role) VALUES(actor,tenant_a,'tenant_admin');
    INSERT INTO public.tickets(id,tenant_id,locale,contact,title,status,source) VALUES
      (ticket,tenant_a,'es-AR','synthetic@example.invalid','Synthetic support QA','open','sun_public_report'),
      (incident_ticket,tenant_a,'es-AR','synthetic@example.invalid','Synthetic incident QA','open','event_incident'),
      (legacy_ticket,tenant_a,'es-AR','synthetic@example.invalid','Synthetic legacy QA','legacy_state','sun_public_report');

    initial := public.nexid_read_support_ticket_workflow_v1(ticket,tenant_a,slug_a,NULL);
    IF initial->>'ok' IS DISTINCT FROM 'true' OR initial->'current'->>'status' IS DISTINCT FROM 'open' OR initial->'items' IS DISTINCT FROM '[]'::jsonb
      OR initial->'current'->>'canUpdate' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'initial snapshot failed'; END IF;
    rejected := public.nexid_read_support_ticket_workflow_v1(ticket,tenant_b,slug_b,NULL);
    IF rejected->>'reason' IS DISTINCT FROM 'ticket_not_found' THEN RAISE EXCEPTION 'foreign history exposed'; END IF;
    rejected := public.nexid_read_support_ticket_workflow_v1(gen_random_uuid(),tenant_a,slug_a,NULL);
    IF rejected->>'reason' IS DISTINCT FROM 'ticket_not_found' THEN RAISE EXCEPTION 'missing history contract failed'; END IF;

    changed := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','pending','Synthetic investigation started',request_one);
    IF changed->>'outcome' IS DISTINCT FROM 'updated' OR changed->'current'->>'status' IS DISTINCT FROM 'pending'
      OR changed->'receipt'->>'revision' IS DISTINCT FROM changed->'current'->>'revision'
      OR changed->'receipt'->'actor'->>'id' IS DISTINCT FROM actor::text THEN RAISE EXCEPTION 'transition failed'; END IF;
    IF (SELECT count(*) FROM public.audit_logs WHERE resource_id=ticket::text) IS DISTINCT FROM 1
      OR (SELECT count(*) FROM public.support_ticket_workflow_operations WHERE ticket_id=ticket) IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'atomic audit and receipt failed'; END IF;
    replayed := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','pending','Synthetic investigation started',request_one);
    IF replayed->>'outcome' IS DISTINCT FROM 'replayed' OR replayed->'receipt' IS DISTINCT FROM changed->'receipt' THEN RAISE EXCEPTION 'retry duplicated'; END IF;
    rejected := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','pending','Different payload',request_one);
    IF rejected->>'reason' IS DISTINCT FROM 'ticket_workflow_conflict' THEN RAISE EXCEPTION 'request reuse accepted'; END IF;
    rejected := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','closed','Stale snapshot',gen_random_uuid());
    IF rejected->>'reason' IS DISTINCT FROM 'ticket_workflow_conflict' THEN RAISE EXCEPTION 'stale write accepted'; END IF;

    closed := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      changed->'current'->>'revision','closed','Synthetic resolution completed',request_two);
    IF closed->>'outcome' IS DISTINCT FROM 'updated' OR closed->'current'->>'status' IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'close failed'; END IF;
    replayed := public.nexid_transition_support_ticket_v1(ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','pending','Synthetic investigation started',request_one);
    IF replayed->>'outcome' IS DISTINCT FROM 'replayed' OR replayed->'current'->>'status' IS DISTINCT FROM 'closed'
      OR replayed->'receipt' IS DISTINCT FROM changed->'receipt' THEN RAISE EXCEPTION 'retry rewound current state'; END IF;
    history := public.nexid_read_support_ticket_workflow_v1(ticket,tenant_a,slug_a,NULL);
    IF jsonb_array_length(history->'items') IS DISTINCT FROM 2 OR history->'items'->0 IS DISTINCT FROM closed->'receipt'
      OR history->'items'->1 IS DISTINCT FROM changed->'receipt' OR history->'page'->>'hasMore' IS DISTINCT FROM 'false'
      OR (SELECT count(*) FROM public.audit_logs WHERE resource_id=ticket::text) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'history integrity failed'; END IF;

    initial := public.nexid_read_support_ticket_workflow_v1(incident_ticket,tenant_a,slug_a,NULL);
    rejected := public.nexid_transition_support_ticket_v1(incident_ticket,tenant_a,slug_a,actor,'Synthetic operator',
      initial->'current'->>'revision','pending','Must remain incident controlled',gen_random_uuid());
    IF initial->'current'->>'blockedReason' IS DISTINCT FROM 'incident_managed' OR rejected->>'reason' IS DISTINCT FROM 'ticket_workflow_blocked'
      THEN RAISE EXCEPTION 'incident control failed'; END IF;
    initial := public.nexid_read_support_ticket_workflow_v1(legacy_ticket,tenant_a,slug_a,NULL);
    IF initial->'current'->>'blockedReason' IS DISTINCT FROM 'legacy_status' THEN RAISE EXCEPTION 'legacy control failed'; END IF;

    -- Deliberately roll back ONLY the synthetic work in this inner block.
    RAISE EXCEPTION USING ERRCODE='ZQ001', MESSAGE='synthetic_workflow_qa_complete';
  EXCEPTION WHEN SQLSTATE 'ZQ001' THEN
    NULL;
  END;
  IF EXISTS(SELECT 1 FROM public.tenants WHERE id IN (tenant_a,tenant_b))
    OR EXISTS(SELECT 1 FROM public.users WHERE id=actor)
    OR EXISTS(SELECT 1 FROM public.tickets WHERE id IN (ticket,incident_ticket,legacy_ticket))
    OR EXISTS(SELECT 1 FROM public.support_ticket_workflow_operations WHERE ticket_id=ticket)
    OR EXISTS(SELECT 1 FROM public.audit_logs WHERE resource_id=ticket::text) THEN
    RAISE EXCEPTION 'synthetic fixtures were not rolled back';
  END IF;
END;
$qa$;
