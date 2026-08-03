export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdminWithPermission } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";
import { resolveIotaEvidenceRuntimeConfig } from "../../../../lib/iota-evidence-writer";

function clean(value: unknown) {
  return String(value || "").trim();
}

function enabled(value: unknown) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function runtimeReadiness(code: string) {
  if (code === "none") {
    return {
      capability: "tenant_evidence",
      runtime_status: "ready",
      write_enabled: true,
      configured: { rpc: false, contract: false, signer: false },
    };
  }

  if (code === "iota") {
    try {
      const config = resolveIotaEvidenceRuntimeConfig();
      const rpc = Boolean(config.rpcUrl);
      const contract = Boolean(config.contractAddress);
      const executor = Boolean(config.executorUrl && config.executorSecret);
      const localSigner = Boolean(config.allowLocalSigner && config.localPrivateKey);
      const signer = executor || localSigner;
      const mockAllowed = config.mode === "mock" && clean(process.env.NODE_ENV).toLowerCase() !== "production";
      const writeEnabled = mockAllowed
        ? contract
        : config.mode === "iota_evm_contract_v2" && rpc && contract && signer;
      const runtimeStatus = writeEnabled
        ? "ready"
        : config.mode === "disabled"
          ? "disabled"
          : rpc && contract
            ? "read_only"
            : "misconfigured";
      return {
        capability: "hash_only_integrity",
        runtime_status: runtimeStatus,
        write_enabled: writeEnabled,
        configured: {
          rpc,
          contract,
          signer,
          executor,
          local_signer: localSigner,
          legacy_v1_read_only_contract: Boolean(clean(process.env.IOTA_EVM_ANCHOR_CONTRACT)),
          contract_compatible: contract,
        },
        mode: config.mode,
        configured_mode: config.configuredMode,
        adapter: "anchorEvidence_v2",
        contract_version: "evidence_anchor_v2",
        custody: executor ? "isolated_executor" : localSigner ? "local_development_only" : "read_only",
        deprecated_mode_alias: config.configuredMode === "iota_evm_contract",
        configuration_error: runtimeStatus === "misconfigured" ? "iota_v2_runtime_config_incomplete" : null,
      };
    } catch {
      return {
        capability: "hash_only_integrity",
        runtime_status: "misconfigured",
        write_enabled: false,
        configured: { rpc: false, contract: false, signer: false, contract_compatible: false },
        mode: "invalid",
        adapter: "anchorEvidence_v2",
        contract_version: "evidence_anchor_v2",
        configuration_error: "iota_v2_runtime_config_invalid",
      };
    }
  }

  if (code === "polygon") {
    const rpc = Boolean(clean(process.env.POLYGON_RPC_URL));
    const contract = Boolean(clean(process.env.POLYGON_CONTRACT_ADDRESS));
    const signer = Boolean(clean(process.env.POLYGON_MINTER_PRIVATE_KEY));
    const localMinter = enabled(process.env.TOKENIZATION_USE_LOCAL_MINTER);
    const writeEnabled = localMinter && rpc && contract && signer;
    return {
      capability: "ownership",
      runtime_status: writeEnabled ? "ready" : rpc && contract ? "read_only" : "disabled",
      write_enabled: writeEnabled,
      configured: { rpc, contract, signer },
      mode: localMinter ? "polygon_minter" : "read_only_certificate",
    };
  }

  return {
    capability: "unknown",
    runtime_status: "disabled",
    write_enabled: false,
    configured: { rpc: false, contract: false, signer: false },
    mode: "unsupported",
  };
}

export async function GET(req: Request) {
  const auth = await checkAdminWithPermission(req, "proof:read");
  if (auth) return auth;
  await ensureSupplierOpsSchema();

  const rows = await sql/*sql*/`
    SELECT code, name, network, chain_id, enabled, purpose
    FROM ledger_providers
    ORDER BY CASE code WHEN 'none' THEN 0 WHEN 'iota' THEN 1 WHEN 'polygon' THEN 2 ELSE 3 END, network
  `;
  const providers = rows.map((row: Record<string, unknown>) => {
    const code = clean(row.code);
    const policyEnabled = Boolean(row.enabled);
    const readiness = runtimeReadiness(code);
    return {
      id: code,
      name: clean(row.name),
      network: clean(row.network),
      chain_id: clean(row.chain_id) || null,
      purpose: clean(row.purpose),
      policy_enabled: policyEnabled,
      ...readiness,
      runtime_status: policyEnabled ? readiness.runtime_status : "policy_disabled",
      write_enabled: policyEnabled && readiness.write_enabled,
    };
  });

  return json({ ok: true, providers });
}
