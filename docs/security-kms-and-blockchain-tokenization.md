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

Esto valida el mensaje criptografico del tag y registra evidencia digital del evento. Es fuente de verdad sobre esa validacion y los datos del backend, no sobre el contenido, origen, condicion o custodia fisica por si solos.

## 2. Que significa KMS aca

Actualmente la master key NFC de backend vive como secreto privado de entorno en Vercel y envuelve las claves de lote almacenadas en DB. `KMS_MASTER_KEY_HEX` es un nombre historico: ese almacenamiento no es por si mismo un KMS gestionado, HSM ni evidencia de no exportabilidad.

La separacion logica permite migrar el secreto envolvente a un KMS cloud sin cambiar el contrato de datos:

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
| SUN validation actual | Backend envelope key en secreto Vercel | Descifrar claves de encoding y validar mensajes de tags | API backend; no es HSM/KMS gestionado |
| Per batch | Claves de encoding cifradas | Validar CMAC/SDM de cada lote | DB cifrada + API |
| Laboratorio legado | `POLYGON_MINTER_PRIVATE_KEY` | Firmar mint Polygon Amoy solo en desarrollo testnet desechable | Nunca es la configuracion aprobada para produccion o un tenant |
| Blockchain pilot `kms_wrapped` | Wallet cifrada por Google Cloud KMS `SOFTWARE` | El executor la desenvuelve y firma con plaintext efimero en memoria | Executor; no es firma directa ni HSM; su estado se confirma con readiness y recibo fresco |
| Blockchain target | Direct KMS/HSM/custody signer verificado | Firmar sin exponer la private key al workload | Executor + signer remoto |

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

Modo de piloto testnet soportado (la configuracion no prueba por si sola que el runtime este activo):

```txt
API:
TOKENIZATION_MODE=polygon
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_EXECUTOR_URL=<EXECUTOR_MINT_URL>
TOKENIZATION_EXECUTOR_SECRET=<secreto>
TOKENIZATION_UID_SALT=<salt>

Executor:
EXECUTOR_CAPABILITIES=polygon
EXECUTOR_SIGNER_MODE=kms_wrapped
NEXID_KMS_ENVIRONMENT=staging
POLYGON_RPC_URL=<amoy rpc>
POLYGON_KMS_WRAP_KEY_RESOURCE=<recurso Cloud KMS SOFTWARE>
POLYGON_KMS_WRAPPED_PRIVATE_KEY=<ciphertext de wallet>
POLYGON_KMS_PUBLISHER_ADDRESS=<address publica del publisher>
POLYGON_MINTER_ADDRESS=<address publica de la minter>
POLYGON_CONTRACT_ADDRESS=<contrato>
POLYGON_DEFAULT_RECIPIENT=<wallet default>
TOKENIZATION_EXECUTOR_SECRET=<mismo secreto>
```

Modo premium despues:

```txt
Executor:
EXECUTOR_SIGNER_MODE=kms
POLYGON_KMS_SIGNER_URL=<signer remoto allowlisted>
POLYGON_KMS_KEY_ID=<key id no exportable>
POLYGON_KMS_PUBLISHER_ADDRESS=<address derivada de esa key>
RPC/CONTRACT/RECIPIENT igual
```

La API no cambia. Solo cambia el signer interno del executor. No se usa la palabra HSM hasta verificar el nivel de proteccion del proveedor y que la clave de firma nunca sea exportada al workload.
