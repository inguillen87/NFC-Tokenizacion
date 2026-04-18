# Nexid Polygon Tokenization (NTAG 424 DNA)

Esta guía implementa el patrón recomendado:

- **El servidor valida SUN** (no se publican secretos del chip en blockchain).
- **Blockchain guarda hash del UID** (`sha256:...`) como vínculo inmutable del gemelo digital.
- **Mint + trazabilidad** se ejecutan desde backend con una wallet de servidor.

## 1) Smart Contract

Contrato: `apps/api/contracts/NexidTraceabilityNFT.sol`

Características:

- ERC-721 (OpenZeppelin `ERC721URIStorage` + `Counters`).
- `mintWithChipHash(...)` bloquea duplicados por `chipUidHash`.
- `updateTraceability(...)` solo `owner` (backend) para evolución de metadata.
- `chipUidHashByTokenId` inmutable luego del mint.

## 2) Backend mint script (ethers.js)

Script: `apps/api/scripts/mint-on-valid-tap.mjs`

Ejemplo:

```bash
POLYGON_RPC_URL=... \
POLYGON_MINTER_PRIVATE_KEY=0x... \
POLYGON_CONTRACT_ADDRESS=0x... \
node apps/api/scripts/mint-on-valid-tap.mjs \
  --uid=04AABBCC1122 \
  --to=0xReceiverWallet \
  --token_uri=ipfs://CID/asset.json \
  --asset_ref=DEMO-2026-02:04AABBCC1122
```

Salida JSON:

```json
{
  "ok": true,
  "network": "polygon",
  "tx_hash": "0x...",
  "token_id": "123",
  "chip_uid_hash": "sha256:...",
  "block_number": 12345678
}
```

## 3) Auto-mint desde SUN valid tap

`apps/api/src/app/sun/route.ts` incorpora auto-queue+anchor opcional.

Variables:

- `SUN_AUTO_TOKENIZE_ON_VALID_TAP=true` para encolar automáticamente cuando SUN es válido.
- `TOKENIZATION_USE_LOCAL_MINTER=true` para usar script local `mint-on-valid-tap.mjs`.
- `TOKENIZATION_UID_SALT=<random>` para hashear UID con sal privada (mejor privacidad y anti-correlación).
- si no está habilitado el script local, queda la ruta de `TOKENIZATION_EXECUTOR_URL`.

Plantilla de variables lista para copiar:

- `apps/api/.env.tokenization.example`

## 4) Buenas prácticas

- Nunca persistir secretos SUN/chip en contrato.
- Guardar solo hashes del UID o de identificadores de producto.
- Guardar metadata descentralizada (IPFS/Arweave) y actualizar trazabilidad vía punteros URI.
- Para gasless UX, siguiente paso recomendado: ERC-2771 (meta-transactions).

## 5) Dónde guardar imágenes / metadata premium

Recomendado para producción:

- IPFS pinning con **Pinata** o **NFT.Storage**.
- Estructura por activo: `ipfs://<CID>/<bid>/<uid>.json`.
- JSON metadata mínimo:
  - `name`, `description`, `image`
  - `attributes` (bodega, región, vintage, lote, estado autenticidad)
  - `external_url` al SUN passport.

Script helper para preparar metadata JSON local antes de pinnear:

```bash
node apps/api/scripts/build-token-metadata.mjs \
  --bid=DEMO-2026-02 \
  --uid=04AABBCC1122 \
  --image=ipfs://CID/images/product.jpg \
  --passport_url=https://nexid.lat/sun?... \
  --winery="Demo Bodega" \
  --region="Valle de Uco" \
  --vintage=2022
```
