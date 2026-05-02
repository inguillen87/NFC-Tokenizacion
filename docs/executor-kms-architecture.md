# nexID executor/KMS architecture

La capa executor/KMS separa la validacion del tap de la firma blockchain.

## Concepto

```txt
Cliente tapea NFC
  -> API valida SUN/CMAC, replay, tamper y reglas comerciales
  -> API crea tokenization request
  -> API llama executor por HTTP privado
  -> executor firma/minta en Polygon Amoy
  -> executor devuelve tx_hash/token_id
  -> API guarda proof y lo muestra en /sun, portal, admin y superadmin
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

Endpoint local:

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

## Configuracion del executor para Amoy

En `apps/executor`:

```txt
PORT=3010
TOKENIZATION_EXECUTOR_SECRET=<random largo secreto>
EXECUTOR_SIGNER_MODE=private_key
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/TU_API_KEY
POLYGON_MINTER_PRIVATE_KEY=0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER
POLYGON_MINTER_ADDRESS=0xADDRESS_PUBLICA_DE_NEXID_AMOY_MINTER
POLYGON_CONTRACT_ADDRESS=0xCONTRATO
POLYGON_DEFAULT_RECIPIENT=0xWALLET_RECEPTORA
```

Para el piloto Amoy, esta private key queda fuera de la API principal y solo en el executor. Sigue siendo gas gratis de testnet. La API manda `chip_uid_hash`; el executor no necesita `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX` ni UID crudo en operacion normal.

## KMS real

KMS real significa que el executor tampoco guarda una private key exportable. En vez de eso, llama a un proveedor que firma dentro de infraestructura segura.

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
2. Poner gas Amoy gratis en `nexID Amoy Minter`.
3. Configurar API en modo executor.
4. Ejecutar `npm run tokenization:check`.
5. Probar un mint manual.
6. Probar 1 tag real.
7. Revisar `/sun`, portal consumidor y dashboard tokenization.

## Seguridad minima

- `TOKENIZATION_EXECUTOR_SECRET` largo, random y distinto al API admin key.
- Executor accesible solo desde API si se despliega en cloud.
- Rate limit por tenant/lote.
- Logs sin UID crudo ni private key.
- El contrato recibe `chip_uid_hash`, no UID real.
- Replay detectado no debe mintar.
