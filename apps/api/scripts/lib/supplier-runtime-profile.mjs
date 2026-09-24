// Explicit candidate ACL for the supplier-chain acceptance worker, not a
// production grant script. No wildcards, default privileges or grant-on-error.
export const SUPPLIER_RUNTIME_PROFILE = 'nexid.supplier-runtime-acceptance.v1';
export const SUPPLIER_RUNTIME_ROLE_RE = /^nexid_e2e_supplier_[a-f0-9]{16}$/;
const freezeLists = value => Object.freeze(Object.fromEntries(Object.entries(value).map(([name,list])=>[name,Object.freeze([...list])])));
export const SUPPLIER_RUNTIME_TABLES = freezeLists({
  schema_migrations: ['SELECT'],
  tenants: ['SELECT'], users: ['SELECT'], memberships: ['SELECT'],
  enterprise_role_profiles: ['SELECT'], resource_permissions: ['SELECT'],
  auth_sessions: ['SELECT'], tenant_sun_profiles: ['SELECT'],
  carrier_profiles: ['SELECT'], ledger_providers: ['SELECT'],
  supplier_orders: ['SELECT','INSERT','UPDATE'],
  supplier_sub_batches: ['SELECT','INSERT','UPDATE'], tags: ['SELECT'], tag_profiles: ['SELECT'],
  batches: ['SELECT','INSERT','UPDATE'],
  batch_keys: ['SELECT','INSERT','UPDATE'],
  batch_key_material: ['SELECT','INSERT','UPDATE'],
  supplier_pack_purpose_decisions: ['SELECT'],
  supplier_production_qa_plans: ['SELECT'], supplier_production_qa_plan_decisions: ['SELECT'],
  evidence_events: ['SELECT','INSERT'], supplier_manufacturing_state_transitions: ['SELECT','INSERT'],
  vault_artifacts: ['SELECT','INSERT'], audit_logs: ['SELECT','INSERT'],
  supplier_packaging_governance_decisions: ['SELECT','INSERT'],
  supplier_requests: ['SELECT','INSERT','UPDATE'],
  supplier_request_operations: ['SELECT','INSERT'],
  supplier_request_reviews: ['SELECT','INSERT','UPDATE'],
  supplier_request_review_events: ['SELECT','INSERT'],
  supplier_request_assignments: ['SELECT'],
  supplier_request_quote_events: ['SELECT','INSERT'],
  supplier_request_binding_events: ['SELECT','INSERT'],
  supplier_order_lifecycle_receipts: ['SELECT','INSERT'],
  supplier_delivery_ack_events: ['SELECT','INSERT'],
  tickets: ['SELECT','INSERT','UPDATE'], event_incidents: ['SELECT'],
  support_ticket_workflow_operations: ['SELECT','INSERT'],
});
// PostgreSQL row-lock clauses require UPDATE privilege on at least one column.
// These narrow SQL privileges are real; tenant/actor isolation remains the
// application authorization layer. This is
// a shared application login, NOT a tenant-isolated database credential.
export const SUPPLIER_RUNTIME_LOCK_COLUMNS = freezeLists({
  vault_artifacts: ['id'], supplier_packaging_governance_decisions: ['id'], supplier_production_qa_plans: ['id'], supplier_production_qa_plan_decisions: ['id'],
  tenants: ['id'], users: ['id'], memberships: ['user_id'],
  enterprise_role_profiles: ['code'], auth_sessions: ['last_seen_at','expires_at','revoked_at','session_token_hash'],
});
export const SUPPLIER_RUNTIME_FUNCTION_NAMES = Object.freeze([
  'nexid_actor_has_enterprise_capability_v1','nexid_audit_freeform_is_safe_v1','nexid_packaging_evidence_ref_present',
  'nexid_supplier_request_actor_v1','nexid_supplier_request_content_valid_v1',
  'nexid_supplier_request_current_v1','nexid_mutate_supplier_request_v1',
  'nexid_supplier_request_review_message_valid_v1','nexid_supplier_request_review_actor_v1',
  'nexid_supplier_request_review_actor_v2','nexid_mutate_supplier_request_review_v1',
  'nexid_supplier_request_review_current_v1','nexid_supplier_operator_authorized_v1',
  'nexid_supplier_request_assigned_actor_v1','nexid_supplier_request_cancellation_actor_v1',
  'nexid_supplier_quote_actor_v1','nexid_supplier_quote_read_v1',
  'nexid_supplier_quote_current_v1','nexid_supplier_quote_public_event_v1','nexid_mutate_supplier_quote_v1',
  'nexid_convert_supplier_request_v1','nexid_supplier_order_create_v2_capability',
  'nexid_create_supplier_order_v2','nexid_record_supplier_packaging_decision_v1','nexid_effective_supplier_pack_purpose_v1',
  'nexid_supplier_binding_spec_v1','nexid_supplier_binding_public_v1',
  'nexid_supplier_binding_current_v1','nexid_supplier_binding_read_v1','nexid_mutate_supplier_binding_v1',
  'nexid_supplier_delivery_source_v1','nexid_supplier_delivery_artifacts_v1',
  'nexid_supplier_delivery_ack_public_v1','nexid_supplier_delivery_ack_current_v1',
  'nexid_supplier_delivery_ack_read_v1','nexid_mutate_supplier_delivery_ack_v1',
  'nexid_supplier_order_lifecycle_v1_capability','nexid_transition_supplier_order_v1',
  'nexid_support_ticket_revision_v1','nexid_support_ticket_receipt_v1',
  'nexid_support_ticket_current_v1','nexid_read_support_ticket_workflow_v1',
  'nexid_transition_support_ticket_v1',
]);
export const SUPPLIER_RUNTIME_DENY_FUNCTIONS = Object.freeze([
  'nexid_persist_sun_scan_v1_base_pre_tt_0093',
  'nexid_import_tag_manifest_v2_core_0081',
  'nexid_backfill_event_risk_v1',
]);
export function assertSupplierRuntimeProfile() {
  const names = SUPPLIER_RUNTIME_FUNCTION_NAMES;
  if (new Set(names).size !== names.length || names.some(n=>!/^nexid_[a-z0-9_]+$/.test(n))) throw Error('supplier_runtime_function_manifest_invalid');
  for (const [table, privileges] of Object.entries(SUPPLIER_RUNTIME_TABLES)) {
    if (!/^[a-z][a-z0-9_]+$/.test(table) || !privileges.length || new Set(privileges).size!==privileges.length || privileges.some(p=>!['SELECT','INSERT','UPDATE'].includes(p))) throw Error('supplier_runtime_table_manifest_invalid');
  }
  for (const [table, columns] of Object.entries(SUPPLIER_RUNTIME_LOCK_COLUMNS)) {
    if (!Object.hasOwn(SUPPLIER_RUNTIME_TABLES,table) || columns.some(c=>! /^[a-z][a-z0-9_]+$/.test(c))) throw Error('supplier_runtime_lock_manifest_invalid');
  }
  return true;
}
