-- Restore the canonical event enums on legacy databases that were initialized
-- before migration 0015 entered the migration ledger. Runtime compatibility
-- DDL created the event columns as text, while the atomic SUN and EPCIS writers
-- still cast through these enums. Keep this bridge additive and idempotent; it
-- deliberately does not rewrite the existing text columns or historical rows.

DO $canonical_event_enum_bridge$
BEGIN
  IF to_regtype('public.event_type') IS NULL THEN
    CREATE TYPE public.event_type AS ENUM (
      'TAP_VALID', 'TAP_INVALID', 'REPLAY_SUSPECT', 'UNKNOWN_BATCH',
      'NOT_REGISTERED', 'NOT_ACTIVE', 'REVOKED', 'BROKEN', 'TAMPERED',
      'OWNERSHIP_ACTIVATED', 'WARRANTY_REGISTERED', 'PROVENANCE_VIEWED',
      'TOKENIZATION_REQUESTED', 'TOKENIZATION_SIMULATED',
      'TOKENIZATION_ANCHORED', 'EXPORT_GENERATED'
    );
  END IF;

  IF to_regtype('public.risk_level') IS NULL THEN
    CREATE TYPE public.risk_level AS ENUM ('none', 'low', 'medium', 'high', 'critical');
  END IF;

  IF to_regtype('public.geo_precision') IS NULL THEN
    CREATE TYPE public.geo_precision AS ENUM ('none', 'ip', 'browser_rounded', 'browser_exact');
  END IF;
END
$canonical_event_enum_bridge$;

ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TAP_VALID';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TAP_INVALID';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'REPLAY_SUSPECT';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'UNKNOWN_BATCH';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'NOT_REGISTERED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'NOT_ACTIVE';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'BROKEN';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TAMPERED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'OWNERSHIP_ACTIVATED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'WARRANTY_REGISTERED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'PROVENANCE_VIEWED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TOKENIZATION_REQUESTED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TOKENIZATION_SIMULATED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'TOKENIZATION_ANCHORED';
ALTER TYPE public.event_type ADD VALUE IF NOT EXISTS 'EXPORT_GENERATED';

ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'none';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'low';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'medium';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'high';
ALTER TYPE public.risk_level ADD VALUE IF NOT EXISTS 'critical';

ALTER TYPE public.geo_precision ADD VALUE IF NOT EXISTS 'none';
ALTER TYPE public.geo_precision ADD VALUE IF NOT EXISTS 'ip';
ALTER TYPE public.geo_precision ADD VALUE IF NOT EXISTS 'browser_rounded';
ALTER TYPE public.geo_precision ADD VALUE IF NOT EXISTS 'browser_exact';
