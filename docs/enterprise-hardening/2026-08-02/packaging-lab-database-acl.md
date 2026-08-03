# Packaging Lab database ACL boundary

Migration `20260802220000_0087_packaging_lab_foundation.sql` deliberately does
not invent or assume a production database role. It revokes `PUBLIC` access to
all Packaging Lab tables and callable/helper functions. PostgreSQL ownership
continues to authorize the migration owner.

This is an owner-only local/schema posture, not proof of the production ACL.
Before deploying with a distinct runtime role, the operator must grant only the
table privileges and function execution needed by that configured role, verify
that migrations run under a separate owner, and capture the resulting ACL from
`information_schema.role_table_grants` and `information_schema.routine_privileges`.

The API currently uses `SECURITY INVOKER` functions and direct tenant-scoped
reads. Therefore a dedicated runtime role needs explicit `SELECT` access to the
six Packaging Lab tables, the minimum DML needed by the three writer functions,
and `EXECUTE` only on the project-create, test-record, project-decision and
activation-receipt functions. Trigger helpers do not need to be exposed as
public API entry points. The exact `GRANT ... TO <runtime_role>` statements are
deployment-specific and remain a required production rollout step.

No part of this ACL boundary changes NFC/SUN key custody or represents software
envelope encryption as KMS or HSM.
