# nexID Offline Public Certificate v1

## Purpose and trust boundary

Offline Level 4 signs a bounded snapshot of public product information so a
browser or controlled application can verify that snapshot without a secret or
network connection. It does **not** validate a fresh NTAG 424 DNA SUN/SDM
message, replay state, tamper state, ownership, warranty eligibility, physical
contents, origin, or custody.

The only successful consumer label is **Información pública verificada**.
SUN/SDM remains an independent online or controlled-verifier decision.

## Endpoints

- `GET /public/offline-certificates/gs1?gtin=<GTIN>&lot=<LOT>&serial=<SERIAL>`
  resolves an active, tenant-bound GS1 registry row and signs its allowlisted
  public projection. The response is `no-store` so the PWA controls its local
  offline copy explicitly.
- `GET /public/offline-certificates/jwks` publishes public ES256 verification
  keys. It is CORS-readable and cacheable. It never contains `d` or any NFC key.
- `/offline/certificate?gtin=<GTIN>&lot=<LOT>&serial=<SERIAL>` verifies and keeps
  a bounded local copy for later offline use.

## Envelope

The profile identifier is `nexid-offline-public-certificate/v1`. The envelope
contains:

- `alg=ES256`, `kid`, `jwks_url` and a canonical protected header;
- public `payload` bound to tenant slug, product Digital Link, nexID batch,
  GTIN, optional lot/serial, issuance and expiry;
- `payload_hash=sha256-<base64url>`;
- raw P-256 WebCrypto-compatible ECDSA signature in base64url.

The signing input follows JWS semantics:

```text
base64url(canonical-protected-header) + "." + base64url(canonical-payload)
```

Both implementations sort object keys recursively and reject unsupported JSON
values. Verifiers must recalculate the payload hash, match `kid` against the
locally supplied JWKS, verify ES256, enforce the claim schema, then enforce
issuance and expiry. Unknown keys, malformed input, missing WebCrypto, future
issuance and expiry all fail closed.

## Key custody and rotation

The server requires two explicit environment values:

- `OFFLINE_PUBLIC_CERTIFICATE_PRIVATE_JWK`: one current P-256 private signing
  JWK with `kid`, `alg=ES256`, `use=sig`, and `key_ops=["sign"]`.
- `OFFLINE_PUBLIC_CERTIFICATE_JWKS`: one to ten public verification JWKs. The
  current `kid`, `x` and `y` must match the private key. Old public keys can
  remain until every certificate they signed has expired.

The JWKS endpoint depends only on the public set, so already-issued
certificates remain verifiable during a private-signer outage. New issuance
still fails closed whenever the private key is absent or does not match the
current public set.

The HMAC variable `PUBLIC_CERTIFICATE_SIGNING_SECRET` is for legacy capability
links and is never a fallback for this profile. NFC K_META/K_FILE and the
envelope master key are never used or exported by Level 4.

This implementation makes no KMS or HSM claim. When a managed asymmetric signer
is added later, its attestation and operational evidence must be documented
separately before changing that statement.

An offline verifier cannot learn that a key was emergency-revoked until it
reconnects. The bounded certificate lifetime limits that exposure; a suspected
key compromise still requires rotating the signing key, publishing the updated
JWKS and forcing an online refresh wherever operations permit it.
