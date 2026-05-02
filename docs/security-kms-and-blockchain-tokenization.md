# nexID security model: SUN keys, backend KMS and blockchain executor

Este documento conecta lo que ya existe en el codigo con la capa de tokenizacion blockchain.

## 1. Lo que ya existe para validar los tags

El backend ya tiene una custodia de secretos por lote:

```txt
KMS_MASTER_KEY_HEX
  -> cifra/descifra K_META y K_FILE de cada batch
  -> valida SUN/SDM/CMAC server-side
  -> detecta UID, contador, replay, tamper y estado del tag
```

En codigo:

- `apps/api/src/lib/keys.ts`
  - `KMS_MASTER_KEY_HEX` debe ser AES-256, 32 bytes / 64 hex chars.
  - `encryptKey16()` guarda `K_META` y `K_FILE` cifradas con AES-256-GCM.
  - `decryptKey16()` las descifra solo dentro del backend.

- `apps/api/src/app/admin/batches/register/route.ts`
  - recibe/importa `k_meta_hex` y `k_file_hex`.
  - guarda `meta_key_ct` y `file_key_ct`, no las keys planas.

- `apps/api/src/lib/sun-service.ts`
  - busca el batch por `bid`.
  - descifra `meta_key_ct` y `file_key_ct`.
  - llama `verifySun()`.
  - valida UID, contador, CMAC, allowlist, replay, tamper y eventos.

- `apps/api/src/lib/crypto/sdm.ts`
  - deriva session keys desde `K_FILE`, UID y contador.
  - verifica CMAC.
  - descifra payload SDM.

Esto es la capa de autenticidad fisica. Es la fuente de verdad.

## 2. Que significa KMS aca

En el codigo actual, `KMS_MASTER_KEY_HEX` funciona como una master key guardada en variables de entorno de backend. Conceptualmente es una envoltura tipo KMS: las keys de lote no quedan planas en DB.

Mas adelante se puede migrar esa master key a un KMS real/cloud, pero la separacion logica ya esta:

```txt
DB guarda ciphertext
Backend tiene master key
Frontend nunca ve keys
Dashboard no recibe K_META/K_FILE salvo en flujos controlados de alta/registro
```

## 3. Que agrega blockchain

Blockchain no reemplaza la validacion SUN. Blockchain solo registra una prueba posterior:

```txt
Tap valido y fresco
  -> backend confirma SUN/CMAC/replay/tamper
  -> se crea tokenization_request
  -> se calcula chip_uid_hash = sha256(UID + TOKENIZATION_UID_SALT)
  -> se minta/ancla certificado en Polygon Amoy
  -> se guarda tx_hash/token_id
```

La cadena nunca debe recibir:

- `K_META`
- `K_FILE`
- `KMS_MASTER_KEY_HEX`
- UID crudo
- CMAC/ENC/PICC completos como secreto operativo

La cadena recibe:

- `chip_uid_hash`
- `asset_ref` publico sin UID crudo
- `token_uri` sin UID crudo
- tx hash / token id

## 4. Diferencia entre ambos KMS

| Capa | Secreto | Para que sirve | Donde vive |
| --- | --- | --- | --- |
| SUN validation | `KMS_MASTER_KEY_HEX` | Descifrar K_META/K_FILE y validar tags | API backend |
| Per batch | `K_META`, `K_FILE` cifradas | Validar CMAC/SDM de cada lote | DB cifrada + API |
| Blockchain pilot | `POLYGON_MINTER_PRIVATE_KEY` | Firmar mint/anclaje Amoy | Executor o API local minter |
| Blockchain premium | KMS/HSM/custody signer | Firmar tx sin private key exportable | Executor/KMS |

## 5. Arquitectura recomendada para nexID

Para los 10 tags reales de China:

```txt
1. Batch ya existe con K_META/K_FILE cifradas.
2. Tap real llega a /sun.
3. API descifra keys solo en memoria.
4. API valida CMAC, UID, counter, replay y tamper.
5. Si es valido y fresco, API crea request de tokenizacion.
6. API calcula chip_uid_hash con TOKENIZATION_UID_SALT.
7. API llama executor.
8. Executor firma tx en Polygon Amoy con gas gratis testnet.
9. API guarda tx_hash/token_id y lo muestra en /sun + portal + admin.
```

## 6. Privacidad corregida

La tokenizacion debe usar identificadores publicos derivados, no UID real.

Implementado:

```txt
chip_uid_hash = sha256(uid_hex + TOKENIZATION_UID_SALT)
public_asset_id = nx-<primeros bytes del hash>
token_uri = ipfs://<prefix>/<BID>/<public_asset_id>.json
asset_ref = <BID>:<public_asset_id>
```

Asi el contrato y el explorer no exponen UID crudo.

## 7. Como queda con executor/KMS

Modo testnet manana:

```txt
API:
TOKENIZATION_MODE=polygon
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_EXECUTOR_URL=https://executor.nexid.lat/mint
TOKENIZATION_EXECUTOR_SECRET=<secreto>
TOKENIZATION_UID_SALT=<salt>

Executor:
POLYGON_RPC_URL=<amoy rpc>
POLYGON_MINTER_PRIVATE_KEY=<wallet minter testnet>
POLYGON_MINTER_ADDRESS=<address publica de la minter>
POLYGON_CONTRACT_ADDRESS=<contrato>
POLYGON_DEFAULT_RECIPIENT=<wallet default>
TOKENIZATION_EXECUTOR_SECRET=<mismo secreto>
```

Modo premium despues:

```txt
Executor:
EXECUTOR_SIGNER_MODE=kms
KMS_KEY_ID=<key id>
RPC/CONTRACT/RECIPIENT igual
```

La API no cambia. Solo cambia el signer interno del executor.
