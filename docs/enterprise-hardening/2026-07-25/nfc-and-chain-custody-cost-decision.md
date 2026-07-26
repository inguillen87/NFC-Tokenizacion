# Nexid key custody and cost decision: NFC batches vs. Polygon/IOTA

Date: 2026-07-25 (America/Argentina/Buenos_Aires)

Status: approved engineering direction; production HSM is not yet claimed

Scope: NFC manufacturing keys, Polygon/IOTA signing custody, and direct provider costs

## Decision

1. **Do not create one cloud KMS key per tag, user, or factory order.** `K_META`
   and `K_FILE` remain batch-specific operational keys. A future Google Cloud KMS
   key-encryption key (KEK) is created per tenant and environment and wraps those
   batch keys.
2. **Keep NFC custody independent from blockchain custody.** Polygon and IOTA
   each use their own wallet/signing key. No blockchain component receives
   `K_META`, `K_FILE`, raw tag UIDs, or `KMS_MASTER_KEY_HEX`.
3. **Use shared platform blockchain wallets only for testnet and controlled
   pilots.** For paid mainnet tenants, use one Polygon signer and one IOTA signer
   per tenant when the customer requires cryptographic isolation, separate
   balances, or attributable signing.
4. **The next custody upgrade should be direct Google Cloud KMS SOFTWARE
   `secp256k1` signing, not a self-hosted imitation of HSM.** It removes the
   wallet private key from application memory at a list price of USD 0.06 per
   active key version per month. Google documents `EC_SIGN_SECP256K1_SHA256` for
   SOFTWARE and HSM protection levels.
5. **Multi-tenant Cloud HSM is an optional premium control, not a technical
   prerequisite for pilots.** Use it when a contract, insurer, regulator, or
   risk assessment requires hardware-backed FIPS Level 3 operations. Do not buy
   Single-tenant Cloud HSM without an explicit dedicated-isolation requirement.

## What each unit means

| Unit | Nexid example | Does Google bill it as a key version? |
|---|---|---:|
| Physical tag | One NTAG 424 DNA/TT label | No |
| Batch key | `K_META` or `K_FILE` for a manufacturing batch | No, when stored as ciphertext wrapped by a KEK |
| KMS key version | One active tenant KEK or one direct chain signer | Yes |
| KMS cryptographic operation | Encrypt, decrypt, or sign API call | Yes |
| Blockchain write | One submitted Polygon or IOTA transaction | No KMS key charge; it creates a KMS operation and chain gas |
| NFC scan | One SUN validation | No blockchain gas; it need not create a KMS call when keys are safely cached |

Tag inventory therefore does **not** determine fixed KMS cost. Key isolation
topology determines fixed cost; KMS API calls determine variable custody cost;
actual on-chain writes determine gas.

## Truthful description of the deployed state

### NFC

The current NFC path uses batch `K_META`/`K_FILE` ciphertext in the database and
an application master secret, `KMS_MASTER_KEY_HEX`, in the Vercel backend
environment. Vercel states that environment variables are encrypted at rest;
the application runtime can still read the value. This is **application-layer
encryption with a hosted environment secret**. It is not Google Cloud KMS and
it is not HSM custody.

The existing physical samples remain on this path. The Google blockchain keys
are separate and do not change or invalidate those samples.

### Polygon and IOTA

The staging executors use separate Google Cloud KMS `SOFTWARE` symmetric keys
to unwrap separate encrypted testnet wallet private keys. Live canaries have
been recorded for Polygon Amoy and IOTA EVM testnet. The Google KEK does not
leave Cloud KMS, but each blockchain wallet private key exists briefly in Cloud
Run memory while a transaction is signed.

Allowed claim:

> Polygon and IOTA testnet wallets use Google Cloud KMS SOFTWARE envelope
> encryption with isolated executor identities and live end-to-end canaries.

Forbidden claims today:

- "HSM-backed wallet" or "FIPS Level 3 wallet custody".
- "The blockchain private key is non-exportable".
- "NFC keys are stored in Google KMS".
- "R2, Vercel variables, or Cloudflare Worker secrets are a KMS/HSM".

Cloudflare R2 encrypts objects at rest with Cloudflare-managed keys, while
Workers secrets and Vercel environment variables are delivered to their
respective runtimes. They are appropriate secret/ciphertext stores, but they do
not provide Nexid with a remote `secp256k1` signing boundary. Storing a raw
wallet key in any of them would still expose it to application memory.

## Recommended key topology

```text
tenant + environment
+-- nfc-wrap KEK
|   +-- batch-001 K_META ciphertext
|   +-- batch-001 K_FILE ciphertext
|   `-- batch-N ...
+-- polygon signer
`-- iota signer
```

- Pilot/testnet: one shared Polygon wallet and one shared IOTA wallet are
  acceptable if they hold no customer assets and every intent contains a
  tenant identifier and idempotency key.
- Paid mainnet/basic: direct SOFTWARE KMS Polygon and IOTA signers per tenant;
  one SOFTWARE NFC KEK per tenant/environment. Generate the signing material
  inside KMS rather than importing a wallet whose original copy was retained.
- Enterprise Premium: direct multi-tenant Cloud HSM Polygon and IOTA signers
  per tenant; choose SOFTWARE or HSM for the NFC KEK according to contract.
- Never derive cloud custody from a user's email/password. Applications
  authorize KMS through least-privilege workload IAM; tenant identity is part
  of the policy and audit context.

## Official Google list prices used

Prices are USD list prices published by Google, effective 2025-03-17 and still
shown on the page when this decision was written.

| Active key version or operation | SOFTWARE | Multi-tenant HSM |
|---|---:|---:|
| Symmetric AES-256 key version/month | $0.06 | $1.00 |
| Elliptic-curve key version/month, first 2,000 HSM versions | $0.06 | $2.50 |
| Symmetric crypto operations / 10,000 | $0.03 | $0.03 |
| HSM asymmetric signing operations / 10,000 | n/a | $0.15 |
| Single-tenant HSM instance/month | n/a | $3,500 |

An enabled, disabled, or scheduled-for-destruction version is billable. Rotation
itself is free, but overlapping old versions and re-encryption operations are
not. Destroyed versions are free, so old envelope versions should be destroyed
only after every dependent batch key has been rewrapped and recovery evidence
has passed.

Google's USD 300/90-day trial is a general onboarding credit, not a forecast of
monthly KMS spend. The published KMS Free Tier is limited to key versions made
through Cloud KMS Autokey and its stated operation allowance; Nexid should
budget manually created application keys at list price unless the billing SKU
proves that a credit applies.

## Cost model for 200,000 tags total

The base case deliberately states every assumption:

- 200,000 tags across the whole Nexid fleet, not per tenant.
- 10,000 tags per factory batch: 20 batches.
- Two batch keys per batch: 40 ciphertext DEKs; **not 40 KMS key versions**.
- One provisioning wrap per batch key: 40 one-time KMS operations.
- Conservative runtime cache budget: unwrap each batch key once per day:
  40 x 30 = 1,200 NFC KMS operations/month.
- Five percent of tags produce a milestone event in a month: 10,000 events.
- Fifty events are committed per Merkle/evidence anchor: 200 chain writes/month.
- Seventy-five percent Polygon and twenty-five percent IOTA: 150 and 50 writes.
- One KMS decrypt/sign operation per chain write for conservative budgeting.

Monthly KMS operations in this model are 1,400. That costs **$0.0042** with
SOFTWARE KMS. Direct HSM signing uses $0.0036 for the symmetric NFC calls plus
$0.0030 for 200 asymmetric signatures: **$0.0066** total.

For gas, Polygon's official documentation gives an approximate transaction
cost of $0.0001, making 150 writes about **$0.015**. The official IOTA EVM
explorer currently reports an average fee of 0.002 IOTA and labels it below
$0.01, so 50 writes are conservatively budgeted at **less than $0.50**. These
are volatile observations, not customer price guarantees. Testnet token use has
no fiat gas charge.

### Tenant-isolated monthly cost, 200,000 tags across the fleet

The totals include the KMS operations and the conservative chain-gas bound
above. They exclude compute, RPC, database, logs, support, tax, and monitoring.

| Tenants | SOFTWARE: 3 versions/tenant | HSM envelope: 3 symmetric versions/tenant | Direct HSM: 1 symmetric + 2 EC versions/tenant |
|---:|---:|---:|---:|
| 1 | KMS $0.1842; with gas **< $0.6992** | KMS $3.0042; with gas **< $3.5192** | KMS $6.0066; with gas **< $6.5216** |
| 10 | KMS $1.8042; with gas **< $2.3192** | KMS $30.0042; with gas **< $30.5192** | KMS $60.0066; with gas **< $60.5216** |
| 100 | KMS $18.0042; with gas **< $18.5192** | KMS $300.0042; with gas **< $300.5192** | KMS $600.0066; with gas **< $600.5216** |

"HSM envelope" is a drop-in symmetric HSM KEK around an exportable wallet and
still exposes that wallet in the executor. "Direct HSM" is the stronger design
where the chain private key is generated and used inside the HSM.

The current shared blockchain pilot has only two SOFTWARE wrapping versions,
so its KMS key-version list price is approximately **$0.12/month**, plus
negligible operations. Adding one shared NFC SOFTWARE KEK would make it
$0.18/month. Shared keys save little and should not be sold as tenant isolation.

### If 200,000 tags means 200,000 per tenant

Variable KMS operations and gas then scale with tenant count. Applying the same
activity and aggregation assumptions yields these portfolio upper bounds:

| Tenants x 200k tags | Tenant-isolated SOFTWARE, including gas | Tenant-isolated direct HSM, including gas |
|---:|---:|---:|
| 1 | < $0.6992/month | < $6.5216/month |
| 10 | < $6.992/month | < $65.216/month |
| 100 | < $69.92/month | < $652.16/month |

Even at that scale, fixed HSM key versions dominate custody cost. The danger to
margin is unbatched on-chain policy, not KMS:

- 200,000 SOFTWARE KMS signing operations cost about **$0.60**.
- 200,000 Polygon writes at the documented approximate average cost about
  **$20**.
- 200,000 IOTA writes at the current explorer's conservative `< $0.01` bound
  could approach **$2,000**.
- Writing every tag to both chains would therefore be a product-policy error;
  anchor milestones in bounded batches and meter exceptional per-item NFT or
  custody actions to the requesting customer.

## Factory batch custody

For each order, Nexid should:

1. Generate fresh random `K_META` and `K_FILE` for that factory batch.
2. Store only authenticated ciphertext plus tenant, batch, algorithm, KEK
   resource, and key-version metadata.
3. Deliver only that batch's operational keys to the factory through an
   expiring, authenticated transfer encrypted for a named factory recipient.
   Never deliver the tenant KEK, `KMS_MASTER_KEY_HEX`, database credentials, or
   blockchain wallet material.
4. Bind the package to a signed manifest containing order, UID/config range,
   quantity, tag model, SUN template, expiration, and checksum.
5. Validate factory acceptance samples against Nexid's QA endpoint, record the
   result, then revoke transfer access. The factory and physical tag do not
   receive online KMS credentials.

This supports multiple batches per tenant without making one compromised batch
the master key for every other customer or order.

## Upgrade gates

| Gate | Required custody |
|---|---|
| Existing samples and demos | Keep current NFC flow; no forced re-encryption |
| New pilot batches | Versioned batch keys; current Vercel master acceptable as a temporary documented exception |
| First multi-tenant production NFC batch | Tenant-specific SOFTWARE KMS KEK, dual-read migration, tested rotation and restore |
| Paid mainnet blockchain package | Direct SOFTWARE KMS `secp256k1` signer per tenant/network; no wallet plaintext secret |
| Contract says HSM/FIPS Level 3, or risk review requires hardware | Direct multi-tenant Cloud HSM signer for that tenant/network |
| Customer requires dedicated physical cryptographic isolation | Price and provision Single-tenant Cloud HSM as a customer-specific add-on; baseline is $3,500/month before wider service costs |

No existing NFC ciphertext or tag should be overwritten in place. Migration is
versioned and dual-read: preserve the legacy key identifier, wrap new tenant
keys with KMS, backfill only with verified decrypt/rewrap checks, and retire an
old version only after all samples and recovery drills pass.

## Commercial conclusion

Nexid does not need to pretend that R2, Vercel, Vault, or an office disk is an
HSM. At the expected milestone frequency, genuine managed custody is already
cheap: about **$0.18 per isolated tenant/month** for three SOFTWARE versions,
or about **$6 per isolated tenant/month** for one symmetric plus two direct EC
HSM versions, before negligible low-volume operations. Package direct HSM
custody as a paid enterprise control and enforce blockchain aggregation so gas
cannot silently consume margin.

## Official sources

- Google Cloud KMS pricing: <https://cloud.google.com/kms/pricing>
- Google Cloud KMS protection levels: <https://docs.cloud.google.com/kms/docs/protection-levels>
- Google Cloud KMS purposes and algorithms, including `secp256k1`:
  <https://docs.cloud.google.com/kms/docs/algorithms>
- Google Cloud KMS envelope encryption:
  <https://docs.cloud.google.com/kms/docs/envelope-encryption>
- Google Cloud Free Program:
  <https://docs.cloud.google.com/free/docs/free-cloud-features>
- Vercel environment variables:
  <https://vercel.com/docs/environment-variables>
- Vercel sensitive environment variables:
  <https://vercel.com/docs/environment-variables/sensitive-environment-variables>
- Cloudflare R2 data security:
  <https://developers.cloudflare.com/r2/reference/data-security/>
- Cloudflare Workers secrets:
  <https://developers.cloudflare.com/workers/configuration/secrets/>
- Polygon official transaction-cost statement:
  <https://docs.polygon.technology/pos/payments/overview>
- Polygon Gas Station methodology:
  <https://docs.polygon.technology/tools/gas/polygon-gas-station>
- IOTA EVM official explorer statistics:
  <https://explorer.evm.iota.org/stats>
