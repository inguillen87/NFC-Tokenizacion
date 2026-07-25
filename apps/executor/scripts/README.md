# Wallet wrapping tool

`wrap-wallet-with-kms.mjs` encrypts one existing EVM private key with a Google
Cloud KMS **SOFTWARE** `ENCRYPT_DECRYPT` key. It is an envelope-encryption
bootstrap tool; it does not claim non-exportable HSM signing.

The tool deliberately accepts the private key only through an explicitly named
environment variable. Never put the private key itself in command arguments,
source control, logs, or the output path.

Populate `NEXID_WALLET_TO_WRAP` from a trusted, non-logging source; do not paste
the literal private key into shell history. Then run the one-shot process and
clear the variable in the parent shell as well:

```powershell
try {
  node apps/executor/scripts/wrap-wallet-with-kms.mjs `
    --private-key-env NEXID_WALLET_TO_WRAP `
    --expected-address 0xExpectedPublisherAddress `
    --environment staging `
    --domain polygon `
    --key-resource projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-wallet-wrap-pilot `
    --output C:\secure-temp\polygon-wallet.ct.b64
} finally {
  Remove-Item Env:NEXID_WALLET_TO_WRAP -ErrorAction SilentlyContinue
}
```

## Local REST authentication without ADC

If the local machine must not persist Application Default Credentials or a
service-account JSON file, choose the REST transport explicitly. It performs
exactly one request to the [official Cloud KMS Encrypt endpoint](https://docs.cloud.google.com/kms/docs/reference/rest/v1/projects.locations.keyRings.cryptoKeys/encrypt).
The endpoint is derived internally from the validated key resource; there is no
endpoint override and no fallback to ADC.

The OAuth access token is read only from the fixed
`NEXID_GCP_KMS_ACCESS_TOKEN` environment variable. The CLI intentionally has no
argument capable of accepting a token.

```powershell
# Populate both variables from trusted, non-logging sources.
try {
  node apps/executor/scripts/wrap-wallet-with-kms.mjs `
    --transport rest `
    --private-key-env NEXID_WALLET_TO_WRAP `
    --expected-address 0xExpectedPublisherAddress `
    --environment staging `
    --domain polygon `
    --key-resource projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-wallet-wrap-pilot `
    --output C:\secure-temp\polygon-wallet.ct.b64
} finally {
  Remove-Item Env:NEXID_WALLET_TO_WRAP -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_GCP_KMS_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
```

REST mode sends the plaintext only over TLS to the fixed Google API host. It
uses the same AAD and CRC32C checks as client-library mode and applies the same
strict response validation. HTTP, timeout, JSON, checksum, key-version, or
protection-level failures stop without retry or fallback.

Before writing anything, it verifies that the private key derives the expected
address. The KMS request and AAD use CRC32C. The response is accepted only when
Google verifies both input checksums, returns a matching key version, reports
`SOFTWARE`, and returns a valid ciphertext CRC32C.

The output file contains only base64 ciphertext. It is created with exclusive
`wx` semantics and mode `0600`; an existing file is never replaced. The process
removes the source variable from `process.env` and wipes mutable key buffers on a
best-effort basis. REST mode also removes its access token from the child
process. A child process cannot clear either variable in its parent shell, and
JavaScript strings or process snapshots cannot be guaranteed to be wiped, so
run this as a short-lived local process on a trusted host and perform the
parent-shell cleanup shown above. On Windows, `0600` mode bits are also only a
best-effort control; use a temporary directory protected by restrictive NTFS
ACLs.

The command prints only non-secret success metadata. Failures print stable error
codes and never forward dependency error messages.

## Generate a dedicated runtime wallet

`generate-wallet-with-kms.mjs` creates a fresh random EVM wallet inside the
short-lived Node process and immediately sends its private key through the same
validated KMS wrapping path. Only the public address and ciphertext metadata
are printed; the plaintext private key is never accepted as a CLI argument or
written to disk.

```powershell
node apps/executor/scripts/generate-wallet-with-kms.mjs `
  --transport rest `
  --environment staging `
  --domain iota `
  --key-resource projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/iota-wallet-wrap-pilot `
  --output C:\secure-temp\iota-publisher.ct.b64
```

The same `NEXID_GCP_KMS_ACCESS_TOKEN` handling and output-file protections
described above apply. Authorize and fund the returned public address only
after the ciphertext has been stored and its runtime identity has been scoped.
