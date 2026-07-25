# Google Cloud KMS staging

This module mirrors the low-cost pilot resources in the dedicated
`nexid-security-staging` project. It must never target an unrelated project.

The custody boundary is explicit:

- `nfc-wrap-pilot` wraps NFC batch material for a future dual-read canary. The
  existing ten physical samples remain on the legacy Vercel provider until all
  physical acceptance tests pass.
- `polygon-wallet-wrap-pilot` and `iota-wallet-wrap-pilot` wrap two independent
  testnet wallet private keys. Polygon and IOTA use separate Cloud Run service
  accounts and each identity can decrypt only its own ciphertext. Only ciphertext is deployed as configuration;
  Cloud Run decrypts on demand using its service identity and signs in memory.
  Runtime identities receive only `roles/cloudkms.cryptoKeyDecrypter` on their
  own key; encryption/rewrap remains an offline provisioning operation.
- This is real Google Cloud KMS envelope encryption, but it is not a
  non-exportable HSM signer. Mainnet or a regulated enterprise contract should
  move to direct HSM/custody signing without changing the executor API.

Google rejected `EC_SIGN_SECP256K1_SHA256` at protection level `SOFTWARE` in
this project. Do not replace it with P-256: that curve is not Ethereum/IOTA-EVM
compatible. Direct Google secp256k1 signing therefore requires HSM pricing;
the envelope design keeps this pilot near USD 0.18/month for three active
software key versions plus cryptographic operations.

The resources were initially provisioned through `gcloud`. Before the first
Terraform plan, import them into a protected remote state:

```powershell
terraform init
terraform import -var="project_id=nexid-security-staging" google_kms_key_ring.nexid_staging projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key.nfc_wrap projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/nfc-wrap-pilot
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key.polygon_wallet_wrap projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/polygon-wallet-wrap-pilot
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key.iota_wallet_wrap projects/nexid-security-staging/locations/us-east1/keyRings/nexid-staging/cryptoKeys/iota-wallet-wrap-pilot
terraform import -var="project_id=nexid-security-staging" google_service_account.nfc_runtime projects/nexid-security-staging/serviceAccounts/nexid-nfc-runtime-stg@nexid-security-staging.iam.gserviceaccount.com
terraform import -var="project_id=nexid-security-staging" google_service_account.chain_executor projects/nexid-security-staging/serviceAccounts/nexid-chain-executor-stg@nexid-security-staging.iam.gserviceaccount.com
terraform import -var="project_id=nexid-security-staging" google_service_account.iota_executor projects/nexid-security-staging/serviceAccounts/nexid-iota-executor-stg@nexid-security-staging.iam.gserviceaccount.com
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key_iam_member.nfc_runtime "nexid-security-staging/us-east1/nexid-staging/nfc-wrap-pilot roles/cloudkms.cryptoKeyDecrypter serviceAccount:nexid-nfc-runtime-stg@nexid-security-staging.iam.gserviceaccount.com"
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key_iam_member.polygon_executor "nexid-security-staging/us-east1/nexid-staging/polygon-wallet-wrap-pilot roles/cloudkms.cryptoKeyDecrypter serviceAccount:nexid-chain-executor-stg@nexid-security-staging.iam.gserviceaccount.com"
terraform import -var="project_id=nexid-security-staging" google_kms_crypto_key_iam_member.iota_executor "nexid-security-staging/us-east1/nexid-staging/iota-wallet-wrap-pilot roles/cloudkms.cryptoKeyDecrypter serviceAccount:nexid-iota-executor-stg@nexid-security-staging.iam.gserviceaccount.com"
terraform plan -var="project_id=nexid-security-staging"
```

The IAM import identifiers above match the decrypt-only bindings provisioned by
the bootstrap. IOTA is already split onto its dedicated service identity.
Remove any historical IOTA grant from the Polygon executor before production
traffic; otherwise the isolation is only documentary.

Every key version is pinned to the explicit
`GOOGLE_SYMMETRIC_ENCRYPTION` algorithm and `SOFTWARE` protection level. This
prevents a provider default from silently changing the pilot custody contract.

Do not rotate envelope key versions automatically until rewrap and rollback are
implemented. A wallet KEK rotation must re-encrypt the same testnet private key;
it must not silently create a new on-chain address.
