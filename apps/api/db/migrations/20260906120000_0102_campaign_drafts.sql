-- Tenant-scoped campaign drafts only. Saving or archiving a draft does not
-- create an audience, schedule a campaign, or send a message.
-- The migration runner owns transaction boundaries and the migration ledger.
-- Original identity, authorship and create-idempotency fields are immutable
-- through the repository's closed update contract.

CREATE TABLE public.campaign_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  title text NOT NULL
    CONSTRAINT campaign_drafts_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  message text NOT NULL
    CONSTRAINT campaign_drafts_message_check CHECK (char_length(btrim(message)) BETWEEN 1 AND 6000),
  channel text NOT NULL
    CONSTRAINT campaign_drafts_channel_check CHECK (channel IN ('whatsapp', 'email', 'phone')),
  purpose text NOT NULL DEFAULT 'marketing'
    CONSTRAINT campaign_drafts_purpose_check CHECK (purpose = 'marketing'),
  status text NOT NULL DEFAULT 'draft'
    CONSTRAINT campaign_drafts_status_check CHECK (status IN ('draft', 'archived')),
  revision integer NOT NULL DEFAULT 1
    CONSTRAINT campaign_drafts_revision_check CHECK (revision > 0),
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_by_label text NOT NULL
    CONSTRAINT campaign_drafts_created_by_label_check CHECK (char_length(btrim(created_by_label)) BETWEEN 1 AND 160),
  updated_by_label text NOT NULL
    CONSTRAINT campaign_drafts_updated_by_label_check CHECK (char_length(btrim(updated_by_label)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  create_idempotency_key text NOT NULL
    CONSTRAINT campaign_drafts_create_idempotency_key_check CHECK (create_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  create_fingerprint text NOT NULL
    CONSTRAINT campaign_drafts_create_fingerprint_check CHECK (create_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT uq_campaign_drafts_tenant_create_idempotency
    UNIQUE (tenant_id, create_idempotency_key)
);

CREATE INDEX idx_campaign_drafts_tenant_status_updated
  ON public.campaign_drafts (tenant_id, status, updated_at DESC, id DESC);
