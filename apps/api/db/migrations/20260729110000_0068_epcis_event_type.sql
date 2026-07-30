-- PostgreSQL requires a newly-added enum value to be committed before it is
-- referenced. This migration therefore owns only the enum extension; the
-- EPCIS tables and capture function are installed by the following migration.

ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'EPCIS_EVENT_CAPTURED';
