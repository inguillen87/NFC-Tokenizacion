import { createHash } from "node:crypto";

export const POLYGON_MINT_INTENT_VERSION = "nexid-polygon-mint-intent-v1";

export type PolygonMintIntent = {
  requestId: string;
  tenantId: string;
  leaseId: string;
  network: string;
  executionClass: string;
  commercialDisposition: string;
  issuerWallet: string;
  chipUidHash: string;
  tokenUri: string;
  assetRef: string;
};

function required(value: unknown, field: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new Error(`polygon_mint_intent_${field}_required`);
  return normalized;
}

export function buildPolygonMintIntentDigest(input: PolygonMintIntent) {
  const canonical = [
    POLYGON_MINT_INTENT_VERSION,
    required(input.requestId, "request_id").toLowerCase(),
    required(input.tenantId, "tenant_id").toLowerCase(),
    required(input.leaseId, "lease_id").toLowerCase(),
    required(input.network, "network").toLowerCase(),
    required(input.executionClass, "execution_class").toLowerCase(),
    required(input.commercialDisposition, "commercial_disposition").toUpperCase(),
    required(input.issuerWallet, "issuer_wallet").toLowerCase(),
    required(input.chipUidHash, "chip_uid_hash").toLowerCase(),
    required(input.tokenUri, "token_uri"),
    required(input.assetRef, "asset_ref"),
  ];
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}
