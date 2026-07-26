import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CUSTODY_APPLY_CONFIRMATION,
  IOTA_STAGING_GOVERNANCE,
  buildCustodyMigrationPlan,
  runCustodyMigration,
  validateCustodyMigrationConfig,
} from "../src/custody-migration-plan.mjs";
import { parseCustodyMigrationCli } from "../scripts/migrate-testnet-custody.mjs";

const ADDRESSES = Object.freeze({
  contract: "0x1111111111111111111111111111111111111111",
  legacyOwner: "0x2222222222222222222222222222222222222222",
  legacyPublisher: "0x3333333333333333333333333333333333333333",
  targetPublisher: "0x4444444444444444444444444444444444444444",
  polygonGovernance: "0x5555555555555555555555555555555555555555",
});

function config(domain, overrides = {}) {
  return {
    domain,
    mode: "plan",
    expectedChainId: domain === "iota" ? 1076 : 80002,
    contractAddress: ADDRESSES.contract,
    legacyOwnerAddress: ADDRESSES.legacyOwner,
    legacyPublisherAddress: ADDRESSES.legacyPublisher,
    targetGovernanceAddress: domain === "iota" ? IOTA_STAGING_GOVERNANCE : ADDRESSES.polygonGovernance,
    targetPublisherAddress: ADDRESSES.targetPublisher,
    governanceTargetBalanceWei: "100",
    publisherTargetBalanceWei: "100",
    maxFundingTotalWei: "250",
    ...overrides,
  };
}

function state(domain, overrides = {}) {
  return {
    chainId: domain === "iota" ? 1076 : 80002,
    contractCodePresent: true,
    schemaVersion: domain === "iota" ? 2 : null,
    owner: ADDRESSES.legacyOwner,
    targetPublisherAuthorized: false,
    legacyPublisherAuthorized: true,
    governanceBalanceWei: 0n,
    publisherBalanceWei: 0n,
    governanceSignerProven: false,
    polygonCanaryVerified: domain === "polygon" ? false : null,
    ...overrides,
  };
}

test("configuration is testnet-only, role-separated, funding-capped and apply-confirmed", () => {
  assert.throws(() => validateCustodyMigrationConfig(config("polygon", { expectedChainId: 137 })), /custody_testnet_chain_id_required/);
  assert.throws(() => validateCustodyMigrationConfig(config("iota", { targetGovernanceAddress: ADDRESSES.polygonGovernance })), /custody_iota_governance_address_mismatch/);
  assert.throws(() => validateCustodyMigrationConfig(config("polygon", { targetPublisherAddress: ADDRESSES.legacyPublisher })), /custody_roles_not_separated/);
  assert.throws(() => validateCustodyMigrationConfig(config("polygon", { maxFundingTotalWei: "199" })), /custody_funding_targets_exceed_cap/);
  assert.throws(() => validateCustodyMigrationConfig(config("polygon", { mode: "apply" })), /custody_apply_confirmation_required/);
});

test("CLI accepts explicit plan/apply modes and still rejects duplicate mode flags", () => {
  assert.deepEqual(parseCustodyMigrationCli(["--domain", "iota"]), { domain: "iota", mode: "plan" });
  assert.deepEqual(parseCustodyMigrationCli(["--domain", "polygon", "--mode", "apply"]), { domain: "polygon", mode: "apply" });
  assert.throws(() => parseCustodyMigrationCli(["--domain", "iota", "--mode", "plan", "--mode", "apply"]), /custody_cli_arguments_invalid/);
});

test("IOTA plan proves governance, authorizes new publisher, transfers owner, then revokes legacy", () => {
  const result = buildCustodyMigrationPlan(config("iota"), state("iota"));
  assert.deepEqual(result.actions.map((item) => item.kind), [
    "fund_governance",
    "fund_publisher",
    "prove_governance_signer",
    "authorize_target_publisher",
    "transfer_ownership",
    "revoke_legacy_publisher",
    "verify_final_invariants",
  ]);
});

test("Polygon plan puts the deterministic publisher canary before ownership transfer and legacy revocation", () => {
  const result = buildCustodyMigrationPlan(config("polygon"), state("polygon", {
    governanceBalanceWei: 100n,
    publisherBalanceWei: 100n,
    governanceSignerProven: true,
  }));
  assert.deepEqual(result.actions.map((item) => item.kind), [
    "authorize_target_publisher",
    "verify_polygon_publisher_canary",
    "transfer_ownership",
    "revoke_legacy_publisher",
    "verify_final_invariants",
  ]);
});

test("apply resumes from chain state and converges; a second run performs no mutation", async () => {
  const mutable = state("polygon");
  const executed = [];
  const adapter = {
    async inspect() { return { ...mutable }; },
    async execute(action, cfg) {
      executed.push(action.kind);
      if (action.kind === "fund_governance") mutable.governanceBalanceWei += action.amountWei;
      if (action.kind === "fund_publisher") mutable.publisherBalanceWei += action.amountWei;
      if (action.kind === "prove_governance_signer") mutable.governanceSignerProven = true;
      if (action.kind === "authorize_target_publisher") mutable.targetPublisherAuthorized = true;
      if (action.kind === "verify_polygon_publisher_canary") mutable.polygonCanaryVerified = true;
      if (action.kind === "transfer_ownership") mutable.owner = cfg.targetGovernanceAddress;
      if (action.kind === "revoke_legacy_publisher") mutable.legacyPublisherAuthorized = false;
    },
  };
  const applyConfig = config("polygon", { mode: "apply", confirmation: CUSTODY_APPLY_CONFIRMATION });
  const first = await runCustodyMigration(applyConfig, adapter);
  assert.equal(first.invariants.ok, true);
  assert.deepEqual(first.executed, [
    "fund_governance",
    "fund_publisher",
    "prove_governance_signer",
    "authorize_target_publisher",
    "verify_polygon_publisher_canary",
    "transfer_ownership",
    "revoke_legacy_publisher",
  ]);

  executed.length = 0;
  const second = await runCustodyMigration(applyConfig, adapter);
  assert.deepEqual(second.executed, []);
  assert.deepEqual(executed, []);
});

test("migration tooling omits every renounce entry point", async () => {
  const source = await readFile(new URL("../scripts/migrate-testnet-custody.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /renounceOwnership|renounce_ownership/i);
});
