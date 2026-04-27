-- 0019_security_alerts

CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('replay_spike','tamper_rate','invalid_rate','geo_velocity','new_country_for_uid','suspicious_device_cluster')),
  severity text NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  threshold numeric NOT NULL DEFAULT 1,
  window_minutes integer NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type)
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  event_id bigint REFERENCES events(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('replay_spike','tamper_rate','invalid_rate','geo_velocity','new_country_for_uid','suspicious_device_cluster')),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_created ON security_alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type, created_at DESC);
