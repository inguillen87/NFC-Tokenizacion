# nexID security model: SUN keys, backend KMS and blockchain executor

Este documento conecta lo que ya existe en el codigo con la capa de tokenizacion blockchain.

## 1. Lo que ya existe para validar los tags

El backend ya tiene una custodia de secretos por lote. En documentacion publica no se deben publicar nombres exactos ni valores de las claves de encoding:

```txt
backend master key
  -> cifra/descifra claves de encoding de cada batch
  -> valida SUN/SDM/CMAC server-side
  -> detecta UID, contador, replay, tamper y estado del tag
```

En codigo:

- Key custody module:
  - La master key debe ser AES-256, 32 bytes / 64 hex chars.
  - Las claves de encoding se guardan cifradas con AES-256-GCM.
  - Las claves se descifran solo dentro del backend.

- Batch registration flow:
  - Recibe/importa claves de encoding por canal privado.
  - Guarda ciphertext, no claves planas.

- SUN validation service:
  - busca el batch por `bid`.
  - descifra claves de encoding.
  - llama `verifySun()`.
  - valida UID, contador, CMAC, allowlist, replay, tamper y eventos.

- SDM crypto module:
  - deriva session keys desde la clave de archivo, UID y contador.
  - verifica CMAC.
  - descifra payload SDM.

Esto es la capa de autenticidad fisica. Es la fuente de verdad.

## 2. Que significa KMS aca

La master key de backend vive solo en variables de entorno privadas o en KMS. Conceptualmente es una envoltura tipo KMS: las keys de lote no quedan planas en DB.

Mas adelante se puede migrar esa master key a un KMS real/cloud, pero la separacion logica ya esta:

```txt
DB guarda ciphertext
Backend tiene master key
Frontend nunca ve keys
Dashboard no recibe claves de encoding salvo en flujos controlados de alta/registro, y nunca debe mostrarlas en copy publico
```

## 3. Que agrega blockchain

Blockchain no reemplaza la validacion SUN. Blockchain solo registra una prueba posterior cuando la politica de producto lo requiere:

```txt
Tap valido y fresco
  -> backend confirma SUN/CMAC/replay/tamper
  -> policy engine decide si corresponde claim/tokenizacion/proof
  -> si corresponde, se crea tokenization_request
  -> se calcula chip_uid_hash = sha256(UID + TOKENIZATION_UID_SALT)
  -> se emite certificado en Polygon Amoy si hay propiedad digital/claim
  -> si compliance lo requiere, se ancla hash o Merkle root en proof layer opcional
  -> se guarda tx_hash/token_id
```

La cadena nunca debe recibir:

- Claves de encoding
- Master keys
- UID crudo
- CMAC/ENC/PICC completos como secreto operativo

Las capas publicas pueden recibir:

- `chip_uid_hash`
- `asset_ref` publico sin UID crudo
- `token_uri` sin UID crudo
- tx hash / token id
- hash, digest o Merkle root si la proof policy lo habilita

La cadena no recibe todos los taps. Los eventos DPP completos quedan en backend; solo claims, certificados o pruebas seleccionadas se publican o anclan.

## 4. Diferencia entre ambos KMS

| Capa | Secreto | Para que sirve | Donde vive |
| --- | --- | --- | --- |
| SUN validation | Backend master key | Descifrar claves de encoding y validar tags | API backend |
| Per batch | Claves de encoding cifradas | Validar CMAC/SDM de cada lote | DB cifrada + API |
| Blockchain pilot | `POLYGON_MINTER_PRIVATE_KEY` | Firmar mint Polygon Amoy | Executor o API local minter |
| Blockchain premium | KMS/HSM/custody signer | Firmar tx sin private key exportable | Executor/KMS |

## 5. Arquitectura recomendada para nexID

Para los 10 tags reales de China:

```txt
1. Batch ya existe con claves de encoding cifradas.
2. Tap real llega al servicio de validacion.
3. API descifra keys solo en memoria.
4. API valida CMAC, UID, counter, replay y tamper.
5. Si es valido, fresco y elegible por politica de piloto, API crea request de tokenizacion.
6. API calcula chip_uid_hash con TOKENIZATION_UID_SALT.
7. API llama executor.
8. Executor firma tx en Polygon Amoy con gas de testnet.
9. API guarda tx_hash/token_id y lo muestra en passport/portal autorizado y consola privada.
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
TOKENIZATION_EXECUTOR_URL=<EXECUTOR_MINT_URL>
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
