# nexID executor/KMS architecture

> Estado verificado 2026-07-26: Polygon e IOTA ejecutan en Cloud Run con
> capacidad separada, autenticacion de aplicacion y signer `kms_wrapped` sobre
> Google Cloud KMS SOFTWARE. No hay HSM ni firma directa no exportable. Los
> ejemplos `private_key` de este archivo quedan solo como referencia local
> historica y no son una configuracion aprobada de produccion.

La capa executor/KMS separa la validacion del tap de la firma blockchain.

## Concepto

```txt
Cliente tapea NFC
  -> API valida SUN/CMAC, replay, tamper y reglas comerciales
  -> API crea tokenization request
  -> API llama executor por HTTP privado
  -> executor firma/minta en Polygon Amoy
  -> executor devuelve tx_hash/token_id
  -> API guarda proof y lo muestra en passport/portal autorizado y consola privada
```

## Por que es mejor

- La API principal no necesita guardar `POLYGON_MINTER_PRIVATE_KEY`.
- El frontend, dashboard y portal nunca ven claves.
- El executor puede vivir en una red mas cerrada.
- Podemos rotar secreto/API key sin tocar producto.
- Mas adelante el executor puede firmar con KMS/HSM/custody.

## Estado implementado

El repo ya incluye un executor separado:

```txt
apps/executor
```

Comandos:

```powershell
npm run dev:executor
npm run executor:check
```

Endpoint local de desarrollo:

```txt
GET  http://localhost:3010/health
POST http://localhost:3010/mint
```

La API ya sabe llamarlo con:

```txt
TOKENIZATION_MODE=polygon
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_EXECUTOR_URL=http://localhost:3010/mint
TOKENIZATION_EXECUTOR_SECRET=<mismo secreto del executor>
```

## Configuracion vigente del executor para Amoy

En `apps/executor`:

```txt
PORT=3010
TOKENIZATION_EXECUTOR_SECRET=<random largo secreto>
EXECUTOR_CAPABILITIES=polygon
EXECUTOR_SIGNER_MODE=kms_wrapped
NEXID_KMS_ENVIRONMENT=staging
POLYGON_KMS_WRAP_KEY_RESOURCE=<recurso KMS SOFTWARE>
POLYGON_KMS_WRAPPED_PRIVATE_KEY=<ciphertext desde Secret Manager>
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<RPC_API_KEY>
POLYGON_MINTER_ADDRESS=0xADDRESS_PUBLICA_DE_NEXID_AMOY_MINTER
POLYGON_CONTRACT_ADDRESS=0xCONTRATO
POLYGON_DEFAULT_RECIPIENT=0xWALLET_RECEPTORA
```

Para el piloto Amoy, el ciphertext queda fuera de la API principal y el
executor usa Cloud KMS para descifrarlo transitoriamente en memoria. Usa gas de
testnet sin valor real de produccion. La API manda `chip_uid_hash`; el executor
no necesita claves de encoding, master keys NFC ni UID crudo en operacion
normal.

## KMS real

La modalidad objetivo de KMS/HSM significa que el material privado nunca se
exporta ni aparece descifrado en memoria de aplicacion: el proveedor firma
dentro del limite criptografico. Esa modalidad objetivo no es la implementacion
`kms_wrapped` actual.

Opciones:

- AWS KMS/HSM con key secp256k1, si el flujo de firma Ethereum queda soportado por el signer.
- Custody provider para Ethereum/Polygon.
- HSM administrado o self-hosted.
- GCP/Azure solo si la opcion elegida soporta secp256k1 compatible EVM para transacciones.

En produccion premium:

```txt
API principal: TOKENIZATION_EXECUTOR_URL + TOKENIZATION_EXECUTOR_SECRET
Executor: KMS key id + RPC + contrato + politicas de tenant/lote
Frontend: nada sensible
```

## Prueba recomendada manana

1. Levantar executor local o desplegarlo aparte.
2. Poner gas Amoy de testnet en `nexID Amoy Minter`.
3. Configurar API en modo executor.
4. Ejecutar `npm run tokenization:check`.
5. Probar un mint manual.
6. Probar 1 tag real.
7. Revisar passport/portal consumidor y consola privada de tokenization.

## Seguridad minima

- `TOKENIZATION_EXECUTOR_SECRET` largo, random y distinto al API admin key.
- Executor accesible solo desde API si se despliega en cloud.
- Rate limit por tenant/lote.
- Logs sin UID crudo ni private key.
- El contrato recibe `chip_uid_hash`, no UID real.
- Replay detectado no debe mintar.
