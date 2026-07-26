import { getAddress, isAddress } from "ethers";

export const TESTNET_CHAIN_IDS = Object.freeze({ iota: 1076, polygon: 80002 });
export const IOTA_STAGING_GOVERNANCE = "0xC617de00DF0F0Cb92Cb1b763CD81AF0c7aE40C7B";
export const CUSTODY_APPLY_CONFIRMATION = "APPLY_NEXID_TESTNET_CUSTODY_ROTATION";

const DOMAINS = new Set(Object.keys(TESTNET_CHAIN_IDS));
const MODES = new Set(["plan", "apply"]);

function fail(code) {
  throw new Error(code);
}

function address(value, code) {
  const raw = String(value || "").trim();
  if (!isAddress(raw)) fail(code);
  return getAddress(raw);
}

function positiveWei(value, code, { allowZero = false } = {}) {
  try {
    const amount = BigInt(value);
    if (amount < 0n || (!allowZero && amount === 0n)) fail(code);
    return amount;
  } catch (error) {
    if (error?.message === code) throw error;
    fail(code);
  }
}

/**
 * Validates the irreversible boundary before any signer or RPC mutation is used.
 * This module intentionally supports testnets only.
 */
export function validateCustodyMigrationConfig(input) {
  const domain = String(input?.domain || "").trim().toLowerCase();
  if (!DOMAINS.has(domain)) fail("custody_domain_invalid");
  const expectedChainId = Number(input?.expectedChainId);
  if (expectedChainId !== TESTNET_CHAIN_IDS[domain]) fail("custody_testnet_chain_id_required");
  const mode = String(input?.mode || "plan").trim().toLowerCase();
  if (!MODES.has(mode)) fail("custody_mode_invalid");

  const contractAddress = address(input?.contractAddress, "custody_contract_address_invalid");
  const legacyOwnerAddress = address(input?.legacyOwnerAddress, "custody_legacy_owner_invalid");
  const legacyPublisherAddress = address(input?.legacyPublisherAddress, "custody_legacy_publisher_invalid");
  const targetGovernanceAddress = address(input?.targetGovernanceAddress, "custody_target_governance_invalid");
  const targetPublisherAddress = address(input?.targetPublisherAddress, "custody_target_publisher_invalid");

  if (domain === "iota" && targetGovernanceAddress !== IOTA_STAGING_GOVERNANCE) {
    fail("custody_iota_governance_address_mismatch");
  }
  const legacyAddresses = new Set([legacyOwnerAddress, legacyPublisherAddress]);
  if (targetGovernanceAddress === targetPublisherAddress
    || legacyAddresses.has(targetGovernanceAddress)
    || legacyAddresses.has(targetPublisherAddress)) {
    fail("custody_roles_not_separated");
  }

  const governanceTargetBalanceWei = positiveWei(
    input?.governanceTargetBalanceWei,
    "custody_governance_target_balance_invalid",
  );
  const publisherTargetBalanceWei = positiveWei(
    input?.publisherTargetBalanceWei,
    "custody_publisher_target_balance_invalid",
  );
  const maxFundingTotalWei = positiveWei(input?.maxFundingTotalWei, "custody_max_funding_invalid");
  if (governanceTargetBalanceWei + publisherTargetBalanceWei > maxFundingTotalWei) {
    fail("custody_funding_targets_exceed_cap");
  }
  if (mode === "apply" && input?.confirmation !== CUSTODY_APPLY_CONFIRMATION) {
    fail("custody_apply_confirmation_required");
  }

  return Object.freeze({
    ...input,
    domain,
    mode,
    expectedChainId,
    contractAddress,
    legacyOwnerAddress,
    legacyPublisherAddress,
    targetGovernanceAddress,
    targetPublisherAddress,
    governanceTargetBalanceWei,
    publisherTargetBalanceWei,
    maxFundingTotalWei,
  });
}

export function assertCustodyPreflight(config, state) {
  if (Number(state?.chainId) !== config.expectedChainId) fail("custody_rpc_chain_id_mismatch");
  if (state?.contractCodePresent !== true) fail("custody_contract_not_deployed");
  if (config.domain === "iota" && Number(state?.schemaVersion) !== 2) {
    fail("custody_iota_schema_version_mismatch");
  }
  const owner = address(state?.owner, "custody_contract_owner_invalid");
  if (owner !== config.legacyOwnerAddress && owner !== config.targetGovernanceAddress) {
    fail("custody_unexpected_contract_owner");
  }
  return { ...state, owner };
}

function fundingDelta(target, current) {
  const balance = positiveWei(current, "custody_balance_invalid", { allowZero: true });
  return balance >= target ? 0n : target - balance;
}

/**
 * Produces only state-derived actions. A completed migration therefore plans no
 * writes, while a partial migration resumes at the first unmet invariant.
 */
export function buildCustodyMigrationPlan(configInput, stateInput) {
  const config = validateCustodyMigrationConfig(configInput);
  const state = assertCustodyPreflight(config, stateInput);
  const governanceFundingWei = fundingDelta(config.governanceTargetBalanceWei, state.governanceBalanceWei);
  const publisherFundingWei = fundingDelta(config.publisherTargetBalanceWei, state.publisherBalanceWei);
  if (governanceFundingWei + publisherFundingWei > config.maxFundingTotalWei) {
    fail("custody_required_funding_exceeds_cap");
  }

  const actions = [];
  if (governanceFundingWei > 0n) actions.push({ kind: "fund_governance", amountWei: governanceFundingWei });
  if (publisherFundingWei > 0n) actions.push({ kind: "fund_publisher", amountWei: publisherFundingWei });
  if (state.governanceSignerProven !== true && state.owner !== config.targetGovernanceAddress) {
    actions.push({ kind: "prove_governance_signer" });
  }
  if (state.targetPublisherAuthorized !== true) actions.push({ kind: "authorize_target_publisher" });
  if (config.domain === "polygon" && state.polygonCanaryVerified !== true) {
    actions.push({ kind: "verify_polygon_publisher_canary" });
  }
  if (state.owner !== config.targetGovernanceAddress) actions.push({ kind: "transfer_ownership" });
  if (state.legacyPublisherAuthorized === true) actions.push({ kind: "revoke_legacy_publisher" });
  actions.push({ kind: "verify_final_invariants" });
  return Object.freeze({ config, state, actions: Object.freeze(actions) });
}

export function assertFinalCustodyInvariants(configInput, stateInput) {
  const config = validateCustodyMigrationConfig(configInput);
  const state = assertCustodyPreflight(config, stateInput);
  if (state.owner !== config.targetGovernanceAddress) fail("custody_final_owner_mismatch");
  if (state.targetPublisherAuthorized !== true) fail("custody_final_publisher_not_authorized");
  if (state.legacyPublisherAuthorized !== false) fail("custody_final_legacy_publisher_not_revoked");
  if (config.domain === "polygon" && state.polygonCanaryVerified !== true) {
    fail("custody_final_polygon_canary_missing");
  }
  return Object.freeze({
    ok: true,
    domain: config.domain,
    chainId: config.expectedChainId,
    contractAddress: config.contractAddress,
    governanceAddress: config.targetGovernanceAddress,
    publisherAddress: config.targetPublisherAddress,
    legacyPublisherRevoked: true,
    polygonCanaryVerified: config.domain === "polygon" ? true : null,
  });
}

export async function runCustodyMigration(configInput, adapter) {
  const config = validateCustodyMigrationConfig(configInput);
  const initial = assertCustodyPreflight(config, await adapter.inspect(config));
  const planned = buildCustodyMigrationPlan(config, initial);
  if (config.mode === "plan") {
    return Object.freeze({ ok: true, applied: false, ...planned });
  }

  const executed = [];
  for (let step = 0; step < 16; step += 1) {
    const current = assertCustodyPreflight(config, await adapter.inspect(config));
    const next = buildCustodyMigrationPlan(config, current).actions[0];
    if (!next || next.kind === "verify_final_invariants") break;
    const action = next;
    await adapter.execute(action, config);
    executed.push(action.kind);
    if (step === 15) fail("custody_migration_did_not_converge");
  }
  const finalState = await adapter.inspect(config);
  const invariants = assertFinalCustodyInvariants(config, finalState);
  return Object.freeze({
    ok: true,
    applied: true,
    domain: config.domain,
    chainId: config.expectedChainId,
    contractAddress: config.contractAddress,
    executed: Object.freeze(executed),
    invariants,
  });
}
