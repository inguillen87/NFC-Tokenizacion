CREATE TABLE IF NOT EXISTS public.tag_manual_tamper_overrides (
  id bigserial PRIMARY KEY,
  batch_id uuid NOT NULL,
  uid_hex text NOT NULL,
  tamper_status text NOT NULL,
  reason text,
  evidence_note text,
  source text NOT NULL DEFAULT 'operator',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, uid_hex)
);

CREATE INDEX IF NOT EXISTS idx_tag_manual_tamper_identity
  ON public.tag_manual_tamper_overrides(batch_id, upper(uid_hex));

REVOKE ALL ON TABLE public.tag_manual_tamper_overrides FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.tag_manual_tamper_overrides_id_seq FROM PUBLIC;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tap_event_id bigint,
  ADD COLUMN IF NOT EXISTS bid text,
  ADD COLUMN IF NOT EXISTS uid_hex text,
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_created_at
  ON public.tickets(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_sun_identity
  ON public.tickets(tenant_id, bid, upper(uid_hex), created_at DESC)
  WHERE source = 'sun_public_report';
