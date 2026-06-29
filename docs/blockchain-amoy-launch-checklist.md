# nexID Polygon Amoy ownership launch checklist

Este documento es el checklist corto para activar la capa Polygon ownership manana sin tocar UX/UI ni rehacer la plataforma. El codigo queda listo; lo unico que falta es crear credenciales, pegar variables y redeployar API.

## 0. Estado del producto

Estado actual del piloto Amoy:

- Tap SUN/NTAG 424 DNA TT valida autenticidad, anti-replay y tamper server-side.
- Replay bloquea ownership, rewards y tokenizacion hasta un tap fisico fresco.
- El passport autorizado muestra trazabilidad, portal, marketplace y estado Polygon/tokenizacion.
- Portal consumidor guarda producto, historial, tenant, promos y certificado si existe.
- Admin/superadmin ven cola de tokenizacion y readiness de Polygon Amoy.
- Polygon usa hash de UID + salt. No publica UID crudo ni recibe todos los taps.
- El contrato Amoy ya fue desplegado y un mint manual ya funciono.
- La API puede mintear directo con `ethers` cuando `TOKENIZATION_USE_LOCAL_MINTER=true`.
- `tsc` API/web, `qa-static` y tests SUN pasan.

Valores del piloto/sandbox actual:

```txt
Network: Polygon Amoy
Chain ID: 80002
RPC: <POLYGON_AMOY_RPC_URL_REDACTED>
Owner/Minter/Recipient: <POLYGON_WALLET_ADDRESS_REDACTED>
Contract: <POLYGON_CONTRACT_ADDRESS_REDACTED>
Manual test tx: <POLYGON_TX_HASH_REDACTED>
Manual test token_id: <TOKEN_ID_REDACTED>
```

## 1. Cuentas que vas a crear

Crea tres wallets separadas:

1. `nexID Amoy Owner`: owner del contrato.
2. `nexID Amoy Minter`: wallet backend que firma mints en testnet.
3. `nexID Sandbox Recipient`: wallet default para tokens si el usuario aun no conecto wallet.

No uses tu wallet personal como minter. No cargues seed phrase en Vercel. Solo private key de la wallet minter dedicada, y solo en API o en el executor. El contrato permite separar roles: `owner` administra y `minter` firma certificados/tokens.

## 2. Polygon Amoy en MetaMask

Datos:

```txt
Network name: Polygon Amoy
Chain ID: 80002
Currency: POL
Explorer: https://amoy.polygonscan.com/
RPC recomendado: Alchemy, QuickNode o Infura
RPC publico temporal: https://rpc-amoy.polygon.technology/
RPC publico alternativo: https://polygon-amoy.drpc.org
```

Agrega la red en MetaMask y manda POL testnet a `nexID Amoy Minter`.

Faucets: usar fuentes Polygon Amoy confiables y vigentes desde el navegador. No fijar links con cuentas, project IDs o tokens en docs publicos.

Nota: algunos faucets piden saldo minimo en Ethereum/Polygon mainnet para evitar abuso. Eso no implica que debas comprar fondos mainnet para el piloto; si un faucet bloquea la wallet, probar otro faucet o usar una wallet dev con historial. Igual hay dependencias operativas de gas testnet, RPC, rate limits y disponibilidad del proveedor.

## 3. Crear RPC

Recomendado: Alchemy.

1. Entra al dashboard del proveedor RPC elegido.
2. Crea app nueva.
3. Chain: Polygon.
4. Network: Polygon Amoy.
5. Copia HTTPS RPC.

Ejemplo:

```txt
https://polygon-amoy.g.alchemy.com/v2/<RPC_API_KEY>
```

Crear un RPC propio no requiere gas ni saldo en la wallet. El gas solo se necesita para enviar transacciones desde la wallet minter. Si todavia no tenes RPC propio, se puede probar temporalmente con el RPC publico:

```txt
https://polygon-amoy.drpc.org
```

## 4. Generar privacy salt

Desde PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guardalo como:

```txt
TOKENIZATION_UID_SALT=<random largo secreto>
```

No lo cambies despues de empezar el piloto real, porque cambia el hash del UID.

## 5. Deploy del contrato

En local:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
$env:POLYGON_RPC_URL="https://polygon-amoy.g.alchemy.com/v2/<RPC_API_KEY>"
$env:POLYGON_MINTER_PRIVATE_KEY="0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER"
$env:POLYGON_DEPLOY_OWNER="0xOWNER_DEL_CONTRATO"
$env:POLYGON_MINTER_ADDRESS="0xADDRESS_PUBLICA_DE_NEXID_AMOY_MINTER"
npm run contracts:compile
npm run contracts:deploy:amoy
```

El deploy devuelve:

```json
{
  "ok": true,
  "network": "amoy",
  "contract": "NexidTraceabilityNFT",
  "address": "0x...",
  "owner": "0x...",
  "minter": "0x..."
}
```

Ese `address` es:

```txt
POLYGON_CONTRACT_ADDRESS=0x...
```

Verificar:

```txt
https://amoy.polygonscan.com/address/0xCONTRATO
```

## 6. Variables de entorno en Vercel API

Proyecto: API backend correspondiente. No fijar dominios productivos en copy publico.

Tenes dos modos.

### Opcion A - local minter dentro de API

Mas simple para primer piloto.

```txt
TOKENIZATION_MODE=polygon
SUN_AUTO_TOKENIZE_ON_VALID_TAP=true
TOKENIZATION_USE_LOCAL_MINTER=true
TOKENIZATION_UID_SALT=<random largo secreto>
TOKENIZATION_METADATA_CID_PREFIX=nexid-metadata
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<RPC_API_KEY>
POLYGON_MINTER_PRIVATE_KEY=0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER
POLYGON_MINTER_ADDRESS=0xMINTER_PUBLIC_ADDRESS
POLYGON_CONTRACT_ADDRESS=0xCONTRACT_ADDRESS
POLYGON_DEFAULT_RECIPIENT=0xDEFAULT_RECIPIENT_ADDRESS
POLYGON_DEPLOY_OWNER=0xOWNER_ADDRESS
PUBLIC_DEMO_SHARE_SECRET=<mismo secreto fuerte en web y api>
SUN_HANDOFF_SECRET=<mismo secreto fuerte o uno dedicado>
CONSUMER_SESSION_COOKIE_DOMAIN=<COOKIE_DOMAIN>
```

### Opcion B - executor separado

Mas parecido a arquitectura premium. La API no guarda private key.

En API/Vercel:

```txt
TOKENIZATION_MODE=polygon
SUN_AUTO_TOKENIZE_ON_VALID_TAP=true
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_UID_SALT=<random largo secreto>
TOKENIZATION_METADATA_CID_PREFIX=nexid-metadata
TOKENIZATION_EXECUTOR_URL=<EXECUTOR_MINT_URL>
TOKENIZATION_EXECUTOR_SECRET=<random largo secreto compartido con executor>
```

En executor:

```txt
TOKENIZATION_EXECUTOR_SECRET=<mismo secreto>
EXECUTOR_SIGNER_MODE=private_key
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<RPC_API_KEY>
POLYGON_MINTER_PRIVATE_KEY=0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER
POLYGON_MINTER_ADDRESS=0xADDRESS_PUBLICA_DE_NEXID_AMOY_MINTER
POLYGON_CONTRACT_ADDRESS=0xCONTRATO_DESPLEGADO
POLYGON_DEFAULT_RECIPIENT=0xWALLET_RECEPTORA_DEFAULT
```

No poner ninguna de estas como `NEXT_PUBLIC_*`.

En el proyecto web usar solo variables publicas estrictamente necesarias. Nunca private keys:

```txt
NEXT_PUBLIC_API_BASE_URL=<PUBLIC_API_BASE_URL>
PUBLIC_DEMO_SHARE_SECRET=<mismo secreto fuerte que API>
```

Si web y API no comparten el secreto publico de CTA, las acciones publicas del passport pueden fallar aunque el tap sea valido.

## 7. Diagnostico antes de probar tags

Local:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
npm run tokenization:check
```

En dashboard:

```txt
Superadmin/Admin -> Tokenization & API runway -> Polygon Amoy readiness
```

Debe mostrar:

- `TOKENIZATION_MODE`: pass.
- `SUN auto tokenization`: pass.
- `UID privacy salt`: pass.
- `Polygon RPC`: pass.
- `RPC chain`: Polygon Amoy 80002.
- `Contract bytecode`: pass.
- `Authorized minter`: pass.
- `Minter key/address match`: pass si API firma localmente.
- `Minter gas`: mayor a 0 POL.

## 8. Prueba manual sin NFC

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
node scripts/mint-on-valid-tap.mjs --uid=<SAMPLE_UID_REDACTED> --to=0xWALLET_RECEPTORA_DEFAULT --token_uri=ipfs://<METADATA_PREFIX>/sandbox/nx-manual-test.json --asset_ref=<BATCH_PUBLIC_REF>:nx-manual-test
```

Esperado:

```json
{
  "ok": true,
  "network": "polygon",
  "tx_hash": "0x...",
  "token_id": "..."
}
```

Abrir:

```txt
https://amoy.polygonscan.com/tx/0xTX_HASH
```

## 9. Prueba con 1 tag real

1. Tapear una de las etiquetas fisicas.
2. Abrir URL real:

```txt
<PASSPORT_VALIDATION_URL_REDACTED>
```

3. Confirmar que el tap es valido y fresco.
4. Confirmar que el passport muestra tokenizacion `anchored/minted` o `pending`.
5. Confirmar que el portal consumidor muestra el certificado.
6. Confirmar que admin/superadmin ve la request.
7. Abrir tx en Amoy Polygonscan.

Secuencia esperada:

- Tap fresco cerrado: `VALID`, sello intacto, acciones comerciales permitidas por politica del tenant.
- Tap fresco abierto: `OPENED`, autentico como lifecycle event; ownership/tokenizacion dependen de vertical y politica.
- Snapshot, refresh o link copiado: modo consulta historica. Muestra trazabilidad, pero bloquea ownership, puntos, marketplace y tokenizacion hasta otro tap fisico.
- Replay criptografico real: queda marcado como riesgo y bloquea acciones comerciales.

Para probar el boton real de tokenizacion:

1. Abrir la pantalla que viene de un tap fisico fresco, no una snapshot vieja.
2. Tocar `Tokenizar en Polygon`.
3. Esperar respuesta OK.
4. Revisar la cola privada de tokenizacion.
5. Abrir `https://amoy.polygonscan.com/tx/0xTX_HASH`.

Si aparece `anchor.ok=false`, mirar logs privados de backend y revisar: private key, gas, contrato, RPC o secreto de handoff. No mostrar ese intento como tokenizacion exitosa hasta tener una transaccion real.

## 10. Prueba con las 10 etiquetas

No probar todas de golpe.

Orden:

1. 1 tag.
2. 3 tags.
3. Revisar mapas, replay, tokenizacion, portal y marketplace.
4. Luego las 10.

Tabla de control:

| Tag | BID | Resultado SUN | Replay | Tamper | tx_hash | token_id | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DEMO... | VALID | no | ok | 0x... | 1 | OK |

## 11. Seguridad premium despues del piloto

Para piloto Amoy, `TOKENIZATION_USE_LOCAL_MINTER=true` esta bien si la wallet minter es dedicada y solo tiene gas testnet.

Para produccion premium:

- Mover firma a executor/KMS.
- Usar `TOKENIZATION_EXECUTOR_URL` y `TOKENIZATION_EXECUTOR_SECRET`.
- Sacar `POLYGON_MINTER_PRIVATE_KEY` de Vercel.
- Agregar allowlist por tenant/lote.
- Agregar monitoreo de gas, rate limits y rotacion de claves.

## 12. Criterio de listo

Blockchain queda lista cuando:

- `npm run tokenization:check` termina con `ok: true`.
- Dashboard readiness muestra `ready`.
- Un mint manual genera `tx_hash`.
- Un tap real genera request y proof.
- Passport y portal consumidor muestran el certificado con link a Polygonscan.

## 13. Verificacion rapida desde Codex/local

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion
$node="C:\Users\guill\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
& $node node_modules\typescript\bin\tsc -p apps\api\tsconfig.json --noEmit
& $node node_modules\typescript\bin\tsc -p apps\web\tsconfig.json --noEmit
& $node scripts\qa-static.mjs
& $node --test apps\api\tests\sun-*.test.mjs apps\api\tests\ttstatus-decode.test.mjs
```

Resultado esperado actual:

```txt
API tsc: OK
Web tsc: OK
Static QA: OK
SUN tests: 31/31 OK
```
