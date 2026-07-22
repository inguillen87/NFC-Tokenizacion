import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env.local");
const SAFE_ENV_KEYS = new Set([
  "POLYGON_RPC_URL",
  "POLYGON_CONTRACT_ADDRESS",
  "POLYGON_EXPLORER_BASE_URL",
  "PUBLIC_PROOF_DEMO_POLYGON_TOKEN_ID",
  "PUBLIC_PROOF_DEMO_POLYGON_TX_HASH",
  "PUBLIC_PROOF_DEMO_POLYGON_CLAIM_TX_HASH",
  "PUBLIC_PROOF_DEMO_POLYGON_BUYER_ADDRESS",
  "PUBLIC_PROOF_DEMO_POLYGON_WALLET_SIGNATURE",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_WEB_URL",
]);

function loadPublicEnvironment() {
  if (!existsSync(envPath)) throw new Error("missing_apps_api_env_local");
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || !SAFE_ENV_KEYS.has(match[1])) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function assert(condition, reason) {
  if (!condition) throw new Error(reason);
}

async function main() {
  loadPublicEnvironment();
  const { readPublicPolygonOwnershipCertificate } = await import("../src/lib/public-polygon-ownership.ts");
  const certificate = await readPublicPolygonOwnershipCertificate();

  assert(certificate.ok === true, `certificate_not_ok:${certificate.reason || "unknown"}`);
  const failedChecks = (certificate.checks || []).filter((check) => !check.ok).map((check) => check.id).join(",");
  assert(certificate.verification_state === "confirmed", `certificate_not_confirmed:${certificate.verification_state}:${failedChecks || "unknown_checks"}`);
  assert(certificate.environment === "testnet", "certificate_not_testnet");
  assert(certificate.chain_id === 80002, `unexpected_chain_id:${certificate.chain_id}`);
  assert(certificate.mint?.status === "confirmed", `mint_not_confirmed:${certificate.mint?.status}`);
  assert(certificate.mint?.events_match === true, "mint_events_do_not_match");
  assert(certificate.claim?.state === "buyer_controlled", `claim_not_buyer_controlled:${certificate.claim?.state}`);
  assert(certificate.claim?.status === "confirmed", `claim_not_confirmed:${certificate.claim?.status}`);
  assert(certificate.claim?.events_match === true, "claim_transfer_event_mismatch");
  assert(certificate.wallet_control?.method === "EIP-191", "unexpected_wallet_proof_method");
  assert(certificate.wallet_control?.verified === true, "wallet_control_not_verified");
  assert(certificate.owner?.wallet_control_verified === true, "owner_wallet_control_not_verified");
  assert(certificate.owner?.address?.toLowerCase() === certificate.claim?.to?.toLowerCase(), "owner_and_claim_recipient_mismatch");
  assert(certificate.owner?.address?.toLowerCase() === certificate.wallet_control?.recovered_address?.toLowerCase(), "owner_and_recovered_signer_mismatch");
  assert(certificate.metadata?.document_ok === true, "metadata_document_not_verified");
  assert(certificate.metadata?.image_ok === true, "metadata_image_not_verified");
  assert(certificate.source_verification?.ok === true, "contract_source_not_verified");

  const serialized = JSON.stringify(certificate);
  assert(!/PRIVATE_KEY|BUYER_PRIVATE|MINTER_PRIVATE/i.test(serialized), "private_key_material_exposed");

  console.log(JSON.stringify({
    ok: true,
    schema_version: certificate.schema_version,
    environment: certificate.environment,
    network: certificate.network,
    contract: certificate.contract_address,
    token_id: certificate.token_id,
    current_owner: certificate.owner.address,
    custody: certificate.owner.custody,
    mint_tx_hash: certificate.mint.tx_hash,
    mint_confirmations: certificate.mint.confirmations,
    claim_tx_hash: certificate.claim.tx_hash,
    claim_confirmations: certificate.claim.confirmations,
    wallet_proof_method: certificate.wallet_control.method,
    recovered_signer: certificate.wallet_control.recovered_address,
    wallet_control_verified: certificate.wallet_control.verified,
    metadata_verified: certificate.metadata.document_ok && certificate.metadata.image_ok,
    source_verified: certificate.source_verification.ok,
    explorer_url: certificate.links.claim_transaction_explorer,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    reason: error instanceof Error ? error.message : "verify_public_proof_polygon_failed",
  }));
  process.exit(1);
});
