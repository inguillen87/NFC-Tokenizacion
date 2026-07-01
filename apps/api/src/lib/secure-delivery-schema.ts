import { sql } from "./db";

let secureDeliverySchemaReady: Promise<void> | null = null;

function resetSecureDeliverySchema() {
  secureDeliverySchemaReady = null;
}

export async function ensureSecureDeliverySchema() {
  if (!secureDeliverySchemaReady) {
    secureDeliverySchemaReady = (async () => {
      await sql/*sql*/`
        DO $$ BEGIN
          CREATE TYPE seal_status AS ENUM (
            'UNASSIGNED', 'ASSIGNED', 'SEALED', 'IN_TRANSIT', 
            'DELIVERED_CLOSED', 'DELIVERED_OPENED', 'QUARANTINED', 'VOIDED'
          );
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS carrier_integrations (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          code text NOT NULL,
          name text NOT NULL,
          credentials_json jsonb NOT NULL DEFAULT '{}'::jsonb,
          status text NOT NULL DEFAULT 'active',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(tenant_id, code)
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS shipments (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          shipment_code text NOT NULL UNIQUE,
          carrier_id uuid REFERENCES carrier_integrations(id) ON DELETE SET NULL,
          tracking_number text,
          status text NOT NULL DEFAULT 'draft',
          origin_address text,
          destination_address text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS shipment_items (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          product_name text NOT NULL,
          quantity integer NOT NULL DEFAULT 1,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS seal_inventory (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
          uid_hex text NOT NULL,
          status seal_status NOT NULL DEFAULT 'UNASSIGNED',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(tenant_id, uid_hex)
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS package_seals (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          seal_id uuid NOT NULL REFERENCES seal_inventory(id) ON DELETE CASCADE,
          applied_at timestamptz,
          status seal_status NOT NULL DEFAULT 'ASSIGNED',
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(shipment_id, seal_id)
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS custody_events (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          shipment_id uuid REFERENCES shipments(id) ON DELETE CASCADE,
          seal_id uuid REFERENCES seal_inventory(id) ON DELETE CASCADE,
          event_type text NOT NULL,
          location text,
          scanned_by text,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS recipient_verifications (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          recipient_name text,
          verification_method text,
          status text NOT NULL DEFAULT 'pending',
          verified_at timestamptz,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`
        CREATE TABLE IF NOT EXISTS delivery_claims (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
          issue_type text NOT NULL,
          description text,
          status text NOT NULL DEFAULT 'open',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_shipments_tenant ON shipments(tenant_id)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_seal_inventory_tenant ON seal_inventory(tenant_id, status)`;
      await sql/*sql*/`CREATE INDEX IF NOT EXISTS idx_custody_events_shipment ON custody_events(shipment_id, created_at DESC)`;
    })().catch((error) => {
      resetSecureDeliverySchema();
      throw error;
    });
  }
  return secureDeliverySchemaReady;
}
