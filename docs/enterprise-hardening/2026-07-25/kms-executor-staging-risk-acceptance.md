# KMS executor staging risk acceptance

Status: temporary exception for Polygon Amoy staging only  
Owner: nexID engineering  
Review by: 2026-08-08

## Finding

`npm audit --omit=dev --workspace=executor` reports GHSA-mh99-v99m-4gvg through:

`@google-cloud/kms -> google-gax / gaxios -> rimraf 5 -> glob 10 -> minimatch -> brace-expansion`.

The current upstream packages pin `rimraf ^5`; the patched line requires a major override. A trial override did not replace the nested dependency, so no ineffective override is retained.

## Reachability decision

The executor source does not import or invoke `rimraf`, `glob`, `minimatch`, or `brace-expansion`. Those packages are present only through Google client-library package manifests. Untrusted request fields never become filesystem paths or glob patterns. The container command is fixed to `node src/server.mjs` and has no shell-based request path.

This makes the published denial-of-service primitive non-reachable in the deployed request flow. It does not make the dependency clean, so the exception is prohibited for mainnet or a customer production SLA.

## Compensating controls

- Polygon Amoy testnet only; no customer assets or mainnet funds.
- Cloud Run maximum one instance and concurrency one.
- Request body limited to 128 KiB.
- Executor endpoint requires a 384-bit shared secret in addition to Cloud Run limits.
- Runtime identity has per-secret access and `cryptoKeyDecrypter` only.
- No private key, service-account JSON, shell, or user-controlled filesystem operation in the runtime path.
- Container image is immutable and the remote build runs the full executor test suite before push.

## Exit criteria

Remove this exception immediately when any of the following occurs:

1. `@google-cloud/kms`, `google-gax`, or `gaxios` releases a compatible patched graph.
2. A tested override removes the vulnerable packages without changing runtime behavior.
3. Reachability changes, a critical advisory appears, or the service moves beyond Amoy staging.

The dependency graph and audit must be reviewed no later than the review date above.
