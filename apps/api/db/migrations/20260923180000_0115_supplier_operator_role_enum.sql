-- Commit the enum independently before any statement can use its new value.
-- This migration creates no account, membership, session or permission grant.
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'supplier_operator';
