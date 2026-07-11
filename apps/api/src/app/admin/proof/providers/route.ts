export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { checkAdmin, checkAdminPermission } from "../../../../lib/auth";
import { sql } from "../../../../lib/db";
import { json } from "../../../../lib/http";
import { ensureSupplierOpsSchema } from "../../../../lib/supplier-ops-schema";

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
    const mode = clean(process.env.IOTA_PROVIDER_MODE || process.env.IOTA_PROOF_MODE || "disabled").toLowerCase();
    const rpc = Boolean(clean(process.env.IOTA_EVM_RPC_URL));
    const contract = Boolean(clean(process.env.IOTA_EVM_ANCHOR_CONTRACT));
    const signer = Boolean(clean(process.env.IOTA_EVM_PRIVATE_KEY));
    const writeEnabled = mode === "iota_evm_contract" && rpc && contract && signer;
    const runtimeStatus = writeEnabled
      ? "ready"
      : mode === "iota_evm_contract" && rpc && contract
        ? "read_only"
        : mode === "disabled"
          ? "disabled"
          : "misconfigured";
    return {
      capability: "hash_only_integrity",
      runtime_status: runtimeStatus,
      write_enabled: writeEnabled,
      configured: { rpc, contract, signer },
      mode,
    };
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
  const auth = checkAdmin(req, ["super_admin", "tenant_admin"]);
  if (auth) return auth;
  const permission = checkAdminPermission(req, "proof:read");
  if (permission) return permission;
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
