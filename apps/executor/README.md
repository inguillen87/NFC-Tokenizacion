# nexID tokenization executor

Small backend-only service that receives tokenization jobs from the main API and signs Polygon Amoy mints outside `api.nexid.lat`.

## Why it exists

The main API should validate SUN/NTAG 424 DNA TT, replay, tamper and business rules. It should not need to hold the blockchain minter private key. The executor owns that responsibility behind an internal secret.

Flow:

```txt
SUN tap -> API validation -> tokenization request -> executor -> Polygon Amoy tx -> tx_hash returned to API
```

## Local Amoy pilot

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\executor
copy .env.example .env
npm run dev
```

Then configure API:

```txt
TOKENIZATION_MODE=polygon
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_EXECUTOR_URL=http://localhost:3010/mint
TOKENIZATION_EXECUTOR_SECRET=<same secret as executor>
SUN_AUTO_TOKENIZE_ON_VALID_TAP=true
TOKENIZATION_UID_SALT=<same salt as executor>
```

The executor keeps:

```txt
POLYGON_RPC_URL=...
POLYGON_MINTER_PRIVATE_KEY=...
POLYGON_MINTER_ADDRESS=...
POLYGON_CONTRACT_ADDRESS=...
POLYGON_DEFAULT_RECIPIENT=...
```

The API sends `chip_uid_hash`, `token_uri` and `asset_ref`. The executor does not need `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX`, or the raw UID for normal operation.

## Production direction

For the Amoy pilot, `EXECUTOR_SIGNER_MODE=private_key` is enough if the wallet is dedicated and only has testnet gas.

For premium production, keep the same HTTP contract but replace the signer internals with provider KMS/HSM:

- AWS KMS secp256k1 key or a custody provider.
- GCP/Azure/HSM equivalent if secp256k1 signing is available.
- Secret manager for `TOKENIZATION_EXECUTOR_SECRET`.
- Network allowlist so only the API can call the executor.
- No private key in Vercel API.

The main API already supports this via `TOKENIZATION_EXECUTOR_URL` and `TOKENIZATION_EXECUTOR_SECRET`.
