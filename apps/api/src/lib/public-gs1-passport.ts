import {
  Gs1RegistryError,
  normalizeGs1Identity,
  resolveActiveGs1Identity,
  type Gs1DigitalLinkIdentity,
  type Gs1RegistryRecord,
} from "./gs1-digital-link-registry";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PublicGs1PassportBindingInput = {
  registryId?: unknown;
  gtin?: unknown;
  lot?: unknown;
  serial?: unknown;
  tenantSlug?: unknown;
  bid?: unknown;
};

export type PublicGs1RegistryLookup = (
  identity: Gs1DigitalLinkIdentity,
) => Promise<Gs1RegistryRecord | null>;

/**
 * Re-resolve a GS1 identity at the API boundary. The redirect query is only a
 * locator; tenant, batch and DPP scope come from the active server registry.
 */
export async function resolvePublicGs1PassportBinding(
  input: PublicGs1PassportBindingInput,
  lookup: PublicGs1RegistryLookup = resolveActiveGs1Identity,
): Promise<Gs1RegistryRecord> {
  const registryId = String(input.registryId || "").trim().toLowerCase();
  if (!UUID_RE.test(registryId)) {
    throw new Gs1RegistryError("gs1_registry_id_invalid", 422);
  }

  const requested = normalizeGs1Identity({
    gtin: input.gtin,
    lot: input.lot,
    serial: input.serial,
  });
  const resolved = await lookup(requested);
  if (!resolved) throw new Gs1RegistryError("gs1_identity_not_found", 404);

  const requestedTenant = String(input.tenantSlug || "").trim().toLowerCase();
  const requestedBid = String(input.bid || "").trim().toUpperCase();
  const bound =
    resolved.status === "active"
    && resolved.id.toLowerCase() === registryId
    && resolved.gtin === requested.gtin
    && resolved.lot === requested.lot
    && resolved.serial === requested.serial
    && (!requestedTenant || resolved.tenantSlug.toLowerCase() === requestedTenant)
    && (!requestedBid || resolved.bid.toUpperCase() === requestedBid);

  if (!bound) throw new Gs1RegistryError("gs1_registry_binding_mismatch", 422);
  return resolved;
}
