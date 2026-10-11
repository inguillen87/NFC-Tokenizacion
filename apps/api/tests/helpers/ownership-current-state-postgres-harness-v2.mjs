import { runConsumerOwnershipClaimPostgresQa } from "./consumer-ownership-claim-postgres-harness.mjs";

// The original helper remains intact for its Docker attestation and safety
// tests. This successor keeps its 51 invariant cases and four observed locks,
// with current no-reclaim semantics and the real issuer/PIN/four-effect core.
// No connection, environment lookup, app import or SQL occurs at module load.
export async function runOwnershipCurrentStatePostgresQa(options = {}) {
  return runConsumerOwnershipClaimPostgresQa({ ...options, catalogue: "legacy-equivalence" });
}
