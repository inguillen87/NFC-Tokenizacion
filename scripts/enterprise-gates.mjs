import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = ["check-no-tracked-secrets.mjs", "staging-postgres-smoke.mjs", "iota-v2-readonly-smoke.mjs", "validate-waf-policy.mjs"];
const results = [];
for (const script of scripts) {
  const result = await new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", script)], { cwd: root, env: process.env, stdio: "inherit" });
    child.on("close", (code) => resolve({ script, code: code ?? 1 }));
  });
  results.push(result);
  if (result.code !== 0) process.exitCode = 1;
}

// Configuration gates are intentionally fail-closed. They prove that the
// deployment is wired to a separately configured signer contract and a
// versioned edge policy; configuration alone does not prove HSM protection,
// non-exportability or live signer health. No secret values or remote mutation
// APIs are used here.
const signer = {
  url: Boolean(String(process.env.IOTA_KMS_SIGNER_URL || "").trim()),
  keyId: Boolean(String(process.env.IOTA_KMS_KEY_ID || "").trim()),
  allowedHosts: Boolean(String(process.env.IOTA_KMS_SIGNER_ALLOWED_HOSTS || "").trim()),
  token: String(process.env.NODE_ENV || "").toLowerCase() !== "production" || Boolean(String(process.env.IOTA_KMS_SIGNER_TOKEN || "").trim()),
  separateFromBatchKms: String(process.env.IOTA_KMS_KEY_ID || "").trim() !== String(process.env.KMS_MASTER_KEY_HEX || "").trim(),
};
const polygonSigner = {
  url: Boolean(String(process.env.POLYGON_KMS_SIGNER_URL || "").trim()),
  keyId: Boolean(String(process.env.POLYGON_KMS_KEY_ID || "").trim()),
  allowedHosts: Boolean(String(process.env.POLYGON_KMS_SIGNER_ALLOWED_HOSTS || "").trim()),
  publisher: Boolean(String(process.env.POLYGON_KMS_PUBLISHER_ADDRESS || "").trim()),
  token: String(process.env.NODE_ENV || "").toLowerCase() !== "production" || Boolean(String(process.env.POLYGON_KMS_SIGNER_TOKEN || "").trim()),
  separateFromBatchKms: String(process.env.POLYGON_KMS_KEY_ID || "").trim() !== String(process.env.KMS_MASTER_KEY_HEX || "").trim(),
};
const edgePolicy = Boolean(await import("node:fs/promises").then(({ access }) => access(path.join(root, "infra", "waf", "cloudflare-enterprise-rules.json")).then(() => true).catch(() => false)));
const configOk = Object.values(signer).every(Boolean) && Object.values(polygonSigner).every(Boolean) && edgePolicy;
const pilot = {
  enabled: String(process.env.NODE_ENV || "").toLowerCase() !== "production"
    && String(process.env.EXECUTOR_SIGNER_MODE || "").toLowerCase() === "private_key",
  network: String(process.env.POLYGON_NETWORK || process.env.IOTA_NETWORK || "").trim() || null,
  enterpriseClaim: false,
};
console.log(JSON.stringify({ ok: results.every((item) => item.code === 0) && configOk, gate: "enterprise_staging", results, config: { signer, polygonSigner, edgePolicy }, pilot }));
if (!configOk) process.exitCode = 1;
