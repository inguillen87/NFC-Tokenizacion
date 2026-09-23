-- Requires 0115 committed separately. Adds a role catalog entry, never an account or grant.
ALTER TABLE public.enterprise_role_profiles DROP CONSTRAINT IF EXISTS enterprise_role_profiles_code_check;
ALTER TABLE public.enterprise_role_profiles ADD CONSTRAINT enterprise_role_profiles_code_check CHECK (code IN ('tenant_owner','tenant_admin','security_analyst','operations_manager','packaging_operator','marketing_manager','viewer','reseller_admin','api_integration','super_admin','security_operator','reseller','supplier_operator'));
INSERT INTO public.enterprise_role_profiles(code,display_name,tenant_bound,human_session_allowed,default_permissions,active)
VALUES('supplier_operator','Operador interno NexID',false,true,'["supplier_request.assigned.read","supplier_request.assigned.review"]'::jsonb,true);
UPDATE public.enterprise_role_profiles SET default_permissions=default_permissions||'"supplier_request.assign"'::jsonb,updated_at=now()
WHERE code='super_admin' AND NOT default_permissions ? 'supplier_request.assign';
ALTER TABLE public.memberships DROP CONSTRAINT IF EXISTS memberships_enterprise_tenant_binding_check;
ALTER TABLE public.memberships ADD CONSTRAINT memberships_enterprise_tenant_binding_check CHECK ((role::text IN ('super_admin','supplier_operator') AND tenant_id IS NULL) OR (role::text NOT IN ('super_admin','supplier_operator') AND tenant_id IS NOT NULL)) NOT VALID;
ALTER TABLE public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_enterprise_tenant_binding_check;
ALTER TABLE public.auth_sessions ADD CONSTRAINT auth_sessions_enterprise_tenant_binding_check CHECK (revoked_at IS NOT NULL OR (role::text IN ('super_admin','supplier_operator') AND tenant_id IS NULL) OR (role::text NOT IN ('super_admin','supplier_operator') AND tenant_id IS NOT NULL)) NOT VALID;
-- Historical invalid authority is not silently rewritten or certified.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.memberships WHERE (role::text IN ('super_admin','supplier_operator')) IS DISTINCT FROM (tenant_id IS NULL)) THEN ALTER TABLE public.memberships VALIDATE CONSTRAINT memberships_enterprise_tenant_binding_check; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.auth_sessions WHERE revoked_at IS NULL AND (role::text IN ('super_admin','supplier_operator')) IS DISTINCT FROM (tenant_id IS NULL)) THEN ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_enterprise_tenant_binding_check; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.nexid_validate_resource_permission_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $resource_permission_scope$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.memberships membership
      WHERE membership.user_id = NEW.user_id
        AND membership.role::text IN ('super_admin','supplier_operator')
        AND membership.tenant_id IS NULL
    ) THEN
      RAISE EXCEPTION 'resource_permission_global_scope_requires_super_admin'
        USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.memberships membership
    WHERE membership.user_id = NEW.user_id
      AND membership.tenant_id = NEW.tenant_id
      AND membership.role::text NOT IN ('super_admin','supplier_operator')
  ) THEN
    RAISE EXCEPTION 'resource_permission_tenant_scope_requires_membership'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$resource_permission_scope$;
CREATE OR REPLACE FUNCTION public.nexid_validate_membership_permission_scope_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $membership_permission_scope$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.resource_permissions permission
    WHERE permission.user_id = OLD.user_id
      AND (
        (
          permission.tenant_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.memberships membership
            WHERE membership.user_id = permission.user_id
              AND membership.role::text IN ('super_admin','supplier_operator')
              AND membership.tenant_id IS NULL
          )
        )
        OR (
          permission.tenant_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.memberships membership
            WHERE membership.user_id = permission.user_id
              AND membership.tenant_id = permission.tenant_id
              AND membership.role::text NOT IN ('super_admin','supplier_operator')
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'membership_change_would_orphan_resource_permission_scope'
      USING ERRCODE = '23514';
  END IF;

  RETURN OLD;
END;
$membership_permission_scope$;
CREATE OR REPLACE FUNCTION public.nexid_actor_has_enterprise_capability_v1(
  p_user_id uuid,
  p_tenant_id uuid,
  p_role text,
  p_capability text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $enterprise_capability$
DECLARE
  v_deny_names text[];
BEGIN
  IF p_role='supplier_operator' AND (p_capability IS NULL OR p_capability NOT IN ('supplier_request.assigned.read','supplier_request.assigned.review') OR p_tenant_id IS NOT NULL OR (SELECT count(*) FROM public.memberships WHERE user_id=p_user_id)<>1) THEN RETURN false; END IF;
  IF p_capability='supplier_request.assign' AND p_role<>'super_admin' THEN RETURN false; END IF;
  IF p_capability IN ('supplier_request.assigned.read','supplier_request.assigned.review') AND p_role<>'supplier_operator' THEN RETURN false; END IF;
  v_deny_names := CASE p_capability
    WHEN 'supplier_request.assign' THEN ARRAY['supplier_requests:assign','supplier_request.assign']
    WHEN 'supplier_request.assigned.read' THEN ARRAY['supplier_requests:assigned_read','supplier_request.assigned.read']
    WHEN 'supplier_request.assigned.review' THEN ARRAY['supplier_requests:assigned_review','supplier_request.assigned.review']
    WHEN 'supplier_order.create' THEN ARRAY['supplier_orders:write']
    WHEN 'batch.keys.generate' THEN ARRAY['supplier:batch_keys_generate']
    WHEN 'supplier_pack.export' THEN ARRAY['supplier:pack_export']
    WHEN 'manifest.import' THEN ARRAY['supplier:manifest_import']
    WHEN 'packaging_lab.manage' THEN ARRAY['supplier:packaging_lab_manage']
    WHEN 'packaging_lab.override' THEN ARRAY['supplier:packaging_lab_override']
    WHEN 'qa.approve' THEN ARRAY['supplier:qa_approve', 'supplier:qa']
    WHEN 'qa.plan.approve' THEN ARRAY['supplier:production_qa_plan:approve']
    WHEN 'batch.activate' THEN ARRAY['supplier:batch_activate']
    WHEN 'batch.activation.override' THEN ARRAY['supplier:activate_override']
    WHEN 'batch.internal.register' THEN ARRAY['batch:register_internal']
    WHEN 'batch.keys.rotate' THEN ARRAY['supplier:key_rotate']
    WHEN 'batch.lifecycle' THEN ARRAY['batch:lifecycle']
    WHEN 'risk_rules.write' THEN ARRAY['risk_rules:write']
    WHEN 'webhooks.manage' THEN ARRAY['webhooks:read', 'webhooks:write']
    WHEN 'proofs.read' THEN ARRAY['proof:read']
    WHEN 'proofs.anchor' THEN ARRAY['proof:write']
    WHEN 'audit.read' THEN ARRAY['audit:read']
    WHEN 'reports.export' THEN ARRAY['reports:export', 'analytics:read']
    ELSE ARRAY[p_capability]
  END;

  RETURN EXISTS (
    SELECT 1
    FROM public.users actor
    JOIN public.memberships membership
      ON membership.user_id = actor.id
     AND membership.role::text = p_role
     AND membership.tenant_id IS NOT DISTINCT FROM p_tenant_id
    JOIN public.enterprise_role_profiles profile
      ON profile.code = p_role
     AND profile.active IS TRUE
     AND profile.human_session_allowed IS TRUE
    WHERE actor.id = p_user_id
      AND actor.admin_status::text = 'active'
      AND profile.default_permissions ? p_capability
      AND (
        (profile.tenant_bound IS TRUE AND p_tenant_id IS NOT NULL)
        OR (profile.tenant_bound IS FALSE AND p_tenant_id IS NULL)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.resource_permissions permission
        WHERE permission.user_id = p_user_id
          AND permission.tenant_id IS NOT DISTINCT FROM p_tenant_id
          AND permission.effect = 'deny'
          AND (
            (permission.resource = '*' AND permission.action = '*')
            OR permission.resource || ':' || permission.action = ANY(v_deny_names)
            OR (
              permission.action = '*'
              AND EXISTS (
                SELECT 1
                FROM unnest(v_deny_names) denied_name
                WHERE denied_name = permission.resource
                   OR denied_name LIKE permission.resource || ':%'
              )
            )
          )
      )
  );
END;
$enterprise_capability$;

CREATE TABLE public.supplier_request_assignments (
 tenant_id uuid NOT NULL, request_id uuid PRIMARY KEY, operator_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), updated_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.supplier_requests(tenant_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,request_id)
);
CREATE INDEX supplier_request_assignments_operator_idx ON public.supplier_request_assignments(operator_id,updated_at DESC,request_id DESC) WHERE operator_id IS NOT NULL;
CREATE TABLE public.supplier_request_assignment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL, request_id uuid NOT NULL,
 revision integer NOT NULL CHECK(revision>0), request_revision integer NOT NULL CHECK(request_revision>0),
 action text NOT NULL CHECK(action IN ('assign','unassign')), operator_id uuid REFERENCES public.users(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT, auth_session_id uuid NOT NULL,
 idempotency_key uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 audit_id uuid NOT NULL UNIQUE REFERENCES public.audit_logs(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,request_id) REFERENCES public.supplier_request_assignments(tenant_id,request_id) ON DELETE RESTRICT,
 CHECK((action='unassign')=(operator_id IS NULL)), UNIQUE(tenant_id,request_id,revision), UNIQUE(tenant_id,idempotency_key)
);
CREATE FUNCTION public.nexid_supplier_operator_eligible_v1(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT public.nexid_actor_has_enterprise_capability_v1(p_actor,NULL,'supplier_operator','supplier_request.assigned.read')
 AND public.nexid_actor_has_enterprise_capability_v1(p_actor,NULL,'supplier_operator','supplier_request.assigned.review');
$$;
CREATE FUNCTION public.nexid_supplier_operator_authorized_v1(p_actor uuid,p_session uuid,p_capability text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_capability IS NULL OR p_capability NOT IN ('supplier_request.assigned.read','supplier_request.assigned.review') THEN RETURN false; END IF;
 PERFORM 1 FROM public.auth_sessions s JOIN public.users u ON u.id=s.user_id
 JOIN public.memberships m ON m.user_id=u.id AND m.role=s.role AND m.tenant_id IS NULL
 JOIN public.enterprise_role_profiles p ON p.code=m.role::text
 WHERE s.id=p_session AND s.user_id=p_actor AND s.role::text='supplier_operator' AND s.tenant_id IS NULL
 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.admin_status::text='active'

 FOR SHARE OF s,u,m,p;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('resource-permission-scope'||chr(31)||p_actor::text||chr(31)||'GLOBAL',0));
 RETURN public.nexid_actor_has_enterprise_capability_v1(p_actor,NULL,'supplier_operator',p_capability);
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_assignment_actor_v1(p_actor uuid,p_session uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM 1 FROM public.auth_sessions s JOIN public.users u ON u.id=s.user_id
 JOIN public.memberships m ON m.user_id=u.id AND m.role=s.role AND m.tenant_id IS NULL
 JOIN public.enterprise_role_profiles p ON p.code=m.role::text
 WHERE s.id=p_session AND s.user_id=p_actor AND s.role::text='super_admin' AND s.tenant_id IS NULL
 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.admin_status::text='active'
 FOR SHARE OF s,u,m,p;
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('resource-permission-scope'||chr(31)||p_actor::text||chr(31)||'GLOBAL',0));
 RETURN public.nexid_actor_has_enterprise_capability_v1(p_actor,NULL,'super_admin','supplier_request.assign');
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_assigned_actor_v1(p_request uuid,p_actor uuid,p_session uuid,p_capability text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.nexid_supplier_operator_authorized_v1(p_actor,p_session,p_capability) THEN RETURN false; END IF;
 -- Writers take the request lock before this check. Do not reverse that order.
 RETURN EXISTS(SELECT 1 FROM public.supplier_request_assignments a JOIN public.supplier_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
 WHERE a.request_id=p_request AND a.operator_id=p_actor AND r.status IN ('submitted','provisioned'));
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_review_actor_v2(p_tenant uuid,p_request uuid,p_actor uuid,p_session uuid,p_action text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF p_action='request_information' AND public.nexid_supplier_request_assigned_actor_v1(p_request,p_actor,p_session,'supplier_request.assigned.review') THEN
  RETURN EXISTS(SELECT 1 FROM public.supplier_requests WHERE id=p_request AND tenant_id=p_tenant);
 END IF;
 RETURN public.nexid_supplier_request_review_actor_v1(p_tenant,p_actor,p_session,p_action);
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_assignment_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'supplier_request_assignment_immutable'; END IF;
 PERFORM 1 FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id
 AND (status='submitted' OR (status='provisioned' AND NEW.operator_id IS NULL)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'supplier_request_not_submitted'; END IF;
 IF NEW.operator_id IS NOT NULL AND NOT public.nexid_supplier_operator_eligible_v1(NEW.operator_id) THEN RAISE EXCEPTION 'supplier_request_assignment_operator_invalid'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revision<>1 OR NEW.operator_id IS NULL THEN RAISE EXCEPTION 'supplier_request_assignment_transition_invalid'; END IF;
 ELSIF NEW.request_id IS DISTINCT FROM OLD.request_id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id OR NEW.revision<>OLD.revision+1
 OR NEW.updated_at<OLD.updated_at OR NEW.operator_id IS NOT DISTINCT FROM OLD.operator_id THEN RAISE EXCEPTION 'supplier_request_assignment_transition_invalid'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_request_assignment_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_assignments FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_assignment_guard_v1();
CREATE FUNCTION public.nexid_supplier_request_assignment_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_revision integer;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supplier_request_assignment_event_append_only'; END IF;
 SELECT revision INTO v_revision FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id
 AND (status='submitted' OR(status='provisioned' AND NEW.action='unassign')) FOR UPDATE;
 IF NOT FOUND OR v_revision<>NEW.request_revision THEN RAISE EXCEPTION 'supplier_request_revision_conflict'; END IF;
 IF NOT public.nexid_supplier_request_assignment_actor_v1(NEW.actor_id,NEW.auth_session_id) THEN RAISE EXCEPTION 'supplier_request_assignment_scope_forbidden'; END IF;
 IF NEW.revision<>1+COALESCE((SELECT max(revision) FROM public.supplier_request_assignment_events WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id),0)
 OR NOT EXISTS(SELECT 1 FROM public.supplier_request_assignments WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id AND revision=NEW.revision AND operator_id IS NOT DISTINCT FROM NEW.operator_id AND updated_at=NEW.created_at)
 OR NOT EXISTS(SELECT 1 FROM public.audit_logs WHERE id=NEW.audit_id AND actor_id=NEW.actor_id AND tenant_id=NEW.tenant_id AND resource_type='supplier_request_assignment' AND resource_id=NEW.request_id::text AND action='supplier_request_assignment_'||NEW.action AND request_id=NEW.idempotency_key::text)
 THEN RAISE EXCEPTION 'supplier_request_assignment_event_invalid'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER supplier_request_assignment_event_guard BEFORE INSERT OR UPDATE OR DELETE ON public.supplier_request_assignment_events FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_assignment_event_guard_v1();
CREATE FUNCTION public.nexid_supplier_request_assignment_consistency_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.supplier_request_assignments a JOIN public.supplier_request_assignment_events e ON e.tenant_id=a.tenant_id AND e.request_id=a.request_id AND e.revision=a.revision
 WHERE a.request_id=NEW.request_id AND a.tenant_id=NEW.tenant_id AND e.operator_id IS NOT DISTINCT FROM a.operator_id AND e.created_at=a.updated_at) THEN RAISE EXCEPTION 'supplier_request_assignment_event_required'; END IF;
 RETURN NEW;
END;
$$;
CREATE CONSTRAINT TRIGGER supplier_request_assignment_consistency AFTER INSERT OR UPDATE ON public.supplier_request_assignments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.nexid_supplier_request_assignment_consistency_v1();
CREATE FUNCTION public.nexid_supplier_request_assignment_current_v1(p_request uuid,p_tenant uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('request_id',r.id,'request_revision',r.revision,'tenant_id',r.tenant_id,'tenant_slug',t.slug,
 'assignment',jsonb_build_object('operator_id',a.operator_id,'revision',COALESCE(a.revision,0),'updated_at',a.updated_at),
 'history',COALESCE(h.items,'[]'::jsonb),'count',COALESCE(h.count,0),'truncated',COALESCE(h.first_revision>1,false),
 'next_before_revision',CASE WHEN h.first_revision>1 THEN h.first_revision ELSE NULL END)
 FROM public.supplier_requests r JOIN public.tenants t ON t.id=r.tenant_id LEFT JOIN public.supplier_request_assignments a ON a.request_id=r.id AND a.tenant_id=r.tenant_id
 LEFT JOIN LATERAL(SELECT jsonb_agg(jsonb_build_object('id',e.id,'revision',e.revision,'request_revision',e.request_revision,'action',e.action,'operator_id',e.operator_id,'actor_id',e.actor_id,'created_at',e.created_at) ORDER BY e.revision) items,count(*)::integer count,min(e.revision) first_revision
 FROM(SELECT * FROM public.supplier_request_assignment_events WHERE request_id=r.id AND tenant_id=r.tenant_id AND(p_before IS NULL OR revision<p_before) ORDER BY revision DESC LIMIT 100)e)h ON true
 WHERE r.id=p_request AND r.tenant_id=p_tenant AND r.status IN ('submitted','provisioned');
$$;
CREATE FUNCTION public.nexid_mutate_supplier_request_assignment_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_tenant uuid;v_id uuid;v_actor uuid;v_session uuid;v_key uuid;v_operator uuid;v_expected integer;v_request_expected integer;
 v_revision integer;v_previous uuid;v_action text;v_fingerprint text;v_now timestamptz;v_audit uuid;
 v_request public.supplier_requests%ROWTYPE;v_event public.supplier_request_assignment_events%ROWTYPE;
BEGIN
 IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>8192 THEN RAISE EXCEPTION 'supplier_request_assignment_input_invalid'; END IF;
 v_tenant:=(p_input->>'tenant_id')::uuid;v_id:=(p_input->>'request_id')::uuid;v_actor:=(p_input->>'actor_id')::uuid;v_session:=(p_input->>'auth_session_id')::uuid;v_key:=(p_input->>'idempotency_key')::uuid;v_operator:=(p_input->>'operator_id')::uuid;
 v_expected:=(p_input->>'expected_revision')::integer;v_request_expected:=(p_input->>'expected_request_revision')::integer;
 IF v_tenant IS NULL OR v_id IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR NOT p_input?'operator_id'
 OR v_expected IS NULL OR v_expected<0 OR v_expected>=2147483647 OR v_request_expected IS NULL OR v_request_expected<1 OR v_request_expected>=2147483647 THEN RAISE EXCEPTION 'supplier_request_assignment_input_invalid'; END IF;
 IF NOT public.nexid_supplier_request_assignment_actor_v1(v_actor,v_session) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_scope_forbidden'); END IF;
 v_action:=CASE WHEN v_operator IS NULL THEN 'unassign' ELSE 'assign' END;
 v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-request-assignment.v1',v_tenant,v_id,v_actor,v_operator,v_expected,v_request_expected)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,116));
 SELECT * INTO v_request FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
 IF NOT public.nexid_supplier_request_assignment_actor_v1(v_actor,v_session) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_scope_forbidden'); END IF;
 SELECT * INTO v_event FROM public.supplier_request_assignment_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
 IF FOUND THEN
  IF v_event.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_idempotency_conflict'); END IF;
  RETURN public.nexid_supplier_request_assignment_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_event.action,'revision',v_event.revision));
 END IF;
 IF v_request.status<>'submitted' AND NOT(v_request.status='provisioned' AND v_operator IS NULL) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_submitted'); END IF;
 IF v_request.revision<>v_request_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_revision_conflict'); END IF;
 SELECT revision,operator_id INTO v_revision,v_previous FROM public.supplier_request_assignments WHERE request_id=v_id AND tenant_id=v_tenant;
 v_revision:=COALESCE(v_revision,0);
 IF v_revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_revision_conflict'); END IF;
 IF v_previous IS NOT DISTINCT FROM v_operator THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_transition_invalid'); END IF;
 IF v_operator IS NOT NULL AND NOT public.nexid_supplier_operator_eligible_v1(v_operator) THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_assignment_operator_invalid'); END IF;
 v_revision:=v_revision+1;v_now:=clock_timestamp();v_audit:=gen_random_uuid();
 IF v_revision=1 THEN
  INSERT INTO public.supplier_request_assignments(tenant_id,request_id,operator_id,revision,updated_at) VALUES(v_tenant,v_id,v_operator,v_revision,v_now);
 ELSE UPDATE public.supplier_request_assignments SET operator_id=v_operator,revision=v_revision,updated_at=v_now WHERE request_id=v_id AND tenant_id=v_tenant; END IF;
 INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
 VALUES(v_audit,v_actor,v_tenant,'supplier_request_assignment_'||v_action,'supplier_request_assignment',v_id::text,encode(sha256(convert_to(jsonb_build_array(v_expected,v_previous)::text,'UTF8')),'hex'),v_fingerprint,v_key::text);
 INSERT INTO public.supplier_request_assignment_events(tenant_id,request_id,revision,request_revision,action,operator_id,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
 VALUES(v_tenant,v_id,v_revision,v_request.revision,v_action,v_operator,v_actor,v_session,v_key,v_fingerprint,v_audit,v_now);
 RETURN public.nexid_supplier_request_assignment_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_action,'revision',v_revision));
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_supplier_request_review_event_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_revision integer;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'supplier_request_review_event_append_only'; END IF;
  SELECT revision INTO v_revision FROM public.supplier_requests WHERE id=NEW.request_id AND tenant_id=NEW.tenant_id AND status='submitted' FOR UPDATE;
  IF NOT FOUND OR v_revision<>NEW.request_revision THEN RAISE EXCEPTION 'supplier_request_revision_conflict'; END IF;
  IF NOT public.nexid_supplier_request_review_actor_v2(NEW.tenant_id,NEW.request_id,NEW.actor_id,NEW.auth_session_id,NEW.action) THEN RAISE EXCEPTION 'supplier_request_review_scope_forbidden'; END IF;
  IF NEW.revision<>1+COALESCE((SELECT max(revision) FROM public.supplier_request_review_events WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id),0)
    OR NOT EXISTS (SELECT 1 FROM public.supplier_request_reviews WHERE tenant_id=NEW.tenant_id AND request_id=NEW.request_id AND revision=NEW.revision
      AND state=CASE NEW.action WHEN 'request_information' THEN 'needs_information' ELSE 'answered' END AND updated_at=NEW.created_at)
    OR NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE id=NEW.audit_id AND actor_id=NEW.actor_id AND tenant_id=NEW.tenant_id
      AND resource_type='supplier_request_review' AND resource_id=NEW.request_id::text AND action='supplier_request_review_'||NEW.action AND request_id=NEW.idempotency_key::text) THEN
    RAISE EXCEPTION 'supplier_request_review_event_invalid';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nexid_mutate_supplier_request_review_v1(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE
  v_tenant uuid; v_actor uuid; v_session uuid; v_key uuid; v_id uuid; v_action text; v_expected integer; v_request_expected integer;
  v_message text; v_fingerprint text; v_audit uuid; v_now timestamptz; v_revision integer; v_state text;
  v_request public.supplier_requests%ROWTYPE; v_event public.supplier_request_review_events%ROWTYPE;
BEGIN
  IF jsonb_typeof(p_input) IS DISTINCT FROM 'object' OR octet_length(p_input::text)>16384 THEN RAISE EXCEPTION 'supplier_request_review_input_invalid'; END IF;
  v_tenant:=(p_input->>'tenant_id')::uuid; v_actor:=(p_input->>'actor_id')::uuid; v_session:=(p_input->>'auth_session_id')::uuid;
  v_key:=(p_input->>'idempotency_key')::uuid; v_id:=(p_input->>'request_id')::uuid; v_action:=p_input->>'action'; v_message:=p_input->>'message';
  v_expected:=(p_input->>'expected_revision')::integer; v_request_expected:=(p_input->>'expected_request_revision')::integer;
  IF v_tenant IS NULL OR v_actor IS NULL OR v_session IS NULL OR v_key IS NULL OR v_id IS NULL
    OR v_action IS NULL OR v_action NOT IN ('request_information','respond')
    OR v_expected IS NULL OR v_expected<0 OR v_expected>=2147483647 OR v_request_expected IS NULL OR v_request_expected<1 OR v_request_expected>=2147483647
    OR jsonb_typeof(p_input->'message') IS DISTINCT FROM 'string' OR public.nexid_supplier_request_review_message_valid_v1(v_message) IS NOT TRUE THEN
    RAISE EXCEPTION 'supplier_request_review_input_invalid';
  END IF;
  IF NOT public.nexid_supplier_request_review_actor_v2(v_tenant,v_id,v_actor,v_session,v_action) THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_scope_forbidden');
  END IF;
  v_fingerprint:=encode(sha256(convert_to(jsonb_build_array('nexid.supplier-request-review.v1',v_tenant,v_actor,v_id,v_action,v_expected,v_request_expected,v_message)::text,'UTF8')),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant::text||':'||v_key::text,114));
  -- All review writes and conversion take this same lock, in this order.
  SELECT * INTO v_request FROM public.supplier_requests WHERE id=v_id AND tenant_id=v_tenant FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_found'); END IF;
  IF NOT public.nexid_supplier_request_review_actor_v2(v_tenant,v_id,v_actor,v_session,v_action) THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_scope_forbidden');
  END IF;
  SELECT * INTO v_event FROM public.supplier_request_review_events WHERE tenant_id=v_tenant AND idempotency_key=v_key;
  IF FOUND THEN
    IF v_event.fingerprint<>v_fingerprint THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_idempotency_conflict'); END IF;
    RETURN public.nexid_supplier_request_review_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',true,
      'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_event.action,'revision',v_event.revision));
  END IF;
  IF v_request.status<>'submitted' THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_not_submitted'); END IF;
  IF v_request.revision<>v_request_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_revision_conflict'); END IF;
  SELECT revision,state INTO v_revision,v_state FROM public.supplier_request_reviews WHERE tenant_id=v_tenant AND request_id=v_id;
  v_revision:=COALESCE(v_revision,0); v_state:=COALESCE(v_state,'pending');
  IF v_revision<>v_expected THEN RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_revision_conflict'); END IF;
  IF (v_action='request_information' AND v_state='needs_information') OR (v_action='respond' AND v_state<>'needs_information') THEN
    RETURN jsonb_build_object('ok',false,'reason','supplier_request_review_transition_invalid');
  END IF;
  v_revision:=v_revision+1; v_now:=clock_timestamp(); v_audit:=gen_random_uuid();
  IF v_revision=1 THEN
    INSERT INTO public.supplier_request_reviews(tenant_id,request_id,state,revision,updated_at)
      VALUES(v_tenant,v_id,'needs_information',v_revision,v_now);
  ELSE
    UPDATE public.supplier_request_reviews SET state=CASE v_action WHEN 'request_information' THEN 'needs_information' ELSE 'answered' END,
      revision=v_revision,updated_at=v_now WHERE tenant_id=v_tenant AND request_id=v_id;
  END IF;
  INSERT INTO public.audit_logs(id,actor_id,tenant_id,action,resource_type,resource_id,before_hash,after_hash,request_id)
    VALUES(v_audit,v_actor,v_tenant,'supplier_request_review_'||v_action,'supplier_request_review',v_id::text,
      encode(sha256(convert_to(jsonb_build_array(v_expected,v_state)::text,'UTF8')),'hex'),v_fingerprint,v_key::text);
  INSERT INTO public.supplier_request_review_events(tenant_id,request_id,revision,request_revision,action,message,actor_id,auth_session_id,idempotency_key,fingerprint,audit_id,created_at)
    VALUES(v_tenant,v_id,v_revision,v_request.revision,v_action,v_message,v_actor,v_session,v_key,v_fingerprint,v_audit,v_now);
  RETURN public.nexid_supplier_request_review_current_v1(v_id,v_tenant)||jsonb_build_object('ok',true,'idempotent_replay',false,
    'receipt',jsonb_build_object('idempotency_key',v_key,'action',v_action,'revision',v_revision));
END;
$$;

CREATE FUNCTION public.nexid_supplier_request_assigned_current_v1(p_request uuid,p_actor uuid,p_session uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_tenant uuid; v_assignment jsonb;
BEGIN
 IF NOT public.nexid_supplier_operator_authorized_v1(p_actor,p_session,'supplier_request.assigned.read') THEN RETURN NULL; END IF;
 PERFORM 1 FROM public.supplier_requests WHERE id=p_request FOR SHARE;
 IF NOT public.nexid_supplier_request_assigned_actor_v1(p_request,p_actor,p_session,'supplier_request.assigned.read') THEN RETURN NULL; END IF;
 SELECT a.tenant_id,jsonb_build_object('operator_id',a.operator_id,'revision',a.revision,'updated_at',a.updated_at) INTO v_tenant,v_assignment
 FROM public.supplier_request_assignments a JOIN public.supplier_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id
 WHERE a.request_id=p_request AND a.operator_id=p_actor AND r.status IN ('submitted','provisioned');
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN public.nexid_supplier_request_current_v1(p_request,v_tenant)||jsonb_build_object('assignment',v_assignment);
END;
$$;
CREATE FUNCTION public.nexid_supplier_requests_assigned_v1(p_actor uuid,p_session uuid,p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_items jsonb;v_count integer;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>100 THEN RAISE EXCEPTION 'supplier_request_limit_invalid'; END IF;
 IF NOT public.nexid_supplier_operator_authorized_v1(p_actor,p_session,'supplier_request.assigned.read') THEN RETURN NULL; END IF;
 SELECT COALESCE(jsonb_agg(item ORDER BY activity DESC,id DESC),'[]'::jsonb),count(*)::integer INTO v_items,v_count FROM(
 SELECT r.id,GREATEST(r.updated_at,review.updated_at,a.updated_at) activity,
 to_jsonb(r)||jsonb_build_object('tenant_slug',t.slug,'review_summary',jsonb_build_object('state',COALESCE(review.state,'pending'),'revision',COALESCE(review.revision,0),'updated_at',review.updated_at),'assignment',jsonb_build_object('operator_id',a.operator_id,'revision',a.revision,'updated_at',a.updated_at)) item
 FROM public.supplier_request_assignments a JOIN public.supplier_requests r ON r.id=a.request_id AND r.tenant_id=a.tenant_id JOIN public.tenants t ON t.id=r.tenant_id
 LEFT JOIN public.supplier_request_reviews review ON review.request_id=r.id AND review.tenant_id=r.tenant_id
 WHERE a.operator_id=p_actor AND r.status IN ('submitted','provisioned') ORDER BY activity DESC,r.id DESC LIMIT p_limit+1) rows;
 RETURN jsonb_build_object('items',CASE WHEN v_count>p_limit THEN v_items-(v_count-1) ELSE v_items END,'count',LEAST(v_count,p_limit),'truncated',v_count>p_limit);
END;
$$;
CREATE FUNCTION public.nexid_supplier_request_assigned_review_v1(p_request uuid,p_actor uuid,p_session uuid,p_before integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public SET lock_timeout='5s' AS $$
DECLARE v_tenant uuid;
BEGIN
 IF NOT public.nexid_supplier_operator_authorized_v1(p_actor,p_session,'supplier_request.assigned.read') THEN RETURN NULL; END IF;
 PERFORM 1 FROM public.supplier_requests WHERE id=p_request FOR SHARE;
 IF NOT public.nexid_supplier_request_assigned_actor_v1(p_request,p_actor,p_session,'supplier_request.assigned.read') THEN RETURN NULL; END IF;
 SELECT tenant_id INTO v_tenant FROM public.supplier_request_assignments WHERE request_id=p_request AND operator_id=p_actor;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN public.nexid_supplier_request_review_current_v1(p_request,v_tenant,p_before);
END;
$$;
REVOKE ALL ON public.supplier_request_assignments,public.supplier_request_assignment_events FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_validate_resource_permission_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_validate_membership_permission_scope_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_actor_has_enterprise_capability_v1(uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_operator_eligible_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_operator_authorized_v1(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assignment_actor_v1(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assigned_actor_v1(uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_actor_v2(uuid,uuid,uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assignment_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assignment_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assignment_consistency_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assignment_current_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_request_assignment_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_review_event_guard_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_mutate_supplier_request_review_v1(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assigned_current_v1(uuid,uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_requests_assigned_v1(uuid,uuid,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nexid_supplier_request_assigned_review_v1(uuid,uuid,uuid,integer) FROM PUBLIC;
