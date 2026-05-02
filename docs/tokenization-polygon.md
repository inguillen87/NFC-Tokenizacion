# nexID Tokenizacion Polygon Amoy - Runbook paso a paso

Esta guia es para activar tokenizacion real en Polygon Amoy para los taps SUN/NTAG 424 DNA TT de nexID, usando las 10 etiquetas fisicas actuales como piloto. La meta es que cada tap valido pueda generar o disparar un certificado/token verificable, sin exponer el UID crudo del chip en blockchain.

Si manana queres ir directo a la ejecucion, usa tambien el checklist corto:

```txt
docs/blockchain-amoy-launch-checklist.md
```

Para la arquitectura premium de executor/KMS:

```txt
docs/executor-kms-architecture.md
docs/security-kms-and-blockchain-tokenization.md
apps/executor/README.md
```

## Objetivo

Activar este flujo:

1. El cliente tapea una etiqueta NFC/SUN.
2. La API valida autenticidad, anti-replay y estado tamper.
3. Si el tap es valido, nexID crea o procesa una solicitud de tokenizacion.
4. El backend firma una transaccion en Polygon Amoy.
5. El producto queda asociado a un token/certificado con `tx_hash`, `token_id`, red, contrato y metadata.
6. El usuario ve el estado en `/sun`, portal consumidor, admin tenant y superadmin.

## Estado actual verificado

- `tsc` API, web y dashboard: OK.
- `qa-static`: OK.
- Tests SUN: 15/15 OK.
- `http://127.0.0.1:3000/sun`: 200 OK.
- Contrato disponible: `apps/api/contracts/NexidTraceabilityNFT.sol`.
- Scripts disponibles:
  - `npm run contracts:compile`
  - `npm run contracts:deploy:amoy`
  - `npm run tokenization:check`
- La API ya soporta:
  - modo demo/sandbox: `TOKENIZATION_MODE=simulated`
  - modo real Polygon: `TOKENIZATION_MODE=polygon`
  - minter local backend: `TOKENIZATION_USE_LOCAL_MINTER=true`
  - executor externo futuro: `TOKENIZATION_EXECUTOR_URL` + `TOKENIZATION_EXECUTOR_SECRET`
- Executor separado incluido: `apps/executor`

## Links que vas a abrir

Usa estos links como tablero de trabajo:

- MetaMask: https://metamask.io/
- Guia MetaMask para agregar red custom: https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/
- Polygon docs: https://docs.polygon.technology/
- Polygon Amoy explorer: https://amoy.polygonscan.com/
- Alchemy dashboard: https://dashboard.alchemy.com/
- Alchemy Polygon Amoy faucet: https://www.alchemy.com/faucets/polygon-amoy
- QuickNode Polygon Amoy faucet: https://faucet.quicknode.com/polygon/amoy
- Infura dashboard: https://app.infura.io/
- QuickNode dashboard: https://dashboard.quicknode.com/
- Vercel dashboard: https://vercel.com/dashboard
- Vercel environment variables docs: https://vercel.com/docs/environment-variables

## Datos de red Polygon Amoy

Usa Amoy como red testnet/sandbox real. No usa dinero real, pero si transacciones reales de testnet.

```txt
Network name: Polygon Amoy
Chain ID decimal: 80002
Chain ID hex: 0x13882
Currency symbol: POL
Explorer: https://amoy.polygonscan.com/
RPC publico de referencia: https://rpc-amoy.polygon.technology/
```

Para produccion de demo/piloto conviene usar RPC propio de Alchemy, QuickNode, Infura o similar. El RPC publico sirve para pruebas, pero puede rate-limitear o fallar.

## Cuentas que tenes que crear

No uses tu wallet personal para firmar mints.

### 1. Wallet owner

Esta wallet queda como owner/admin del contrato. Puede ser una wallet controlada por la empresa.

Uso:

- desplegar contrato
- administrar ownership/minter roles si despues se agregan permisos
- guardar control del contrato

### 2. Wallet minter dedicada

Esta es la importante para el backend.

Nombre recomendado en MetaMask:

```txt
nexID Amoy Minter
```

Uso:

- firmar transacciones de mint/anchor en Amoy
- tener solo gas testnet
- no tener fondos reales
- no usarla para navegar, comprar o conectar a apps raras

### 3. Wallet recipient/default

Esta wallet recibe tokens cuando no hay una wallet real del usuario/tenant.

Puede ser:

- wallet demo de nexID
- wallet del tenant `demobodega`
- wallet temporal para pruebas

Variable:

```txt
POLYGON_DEFAULT_RECIPIENT=0x...
```

## Paso 1 - Crear wallet minter en MetaMask

1. Abrir MetaMask.
2. Crear una cuenta nueva.
3. Nombrarla `nexID Amoy Minter`.
4. Copiar su address publica.
5. Exportar private key solo cuando estes en un entorno seguro.
6. Guardarla en un password manager seguro.

Reglas:

- Nunca pegues la seed phrase en Vercel.
- Nunca uses tu wallet personal.
- Nunca pongas esta private key en variables `NEXT_PUBLIC_*`.
- Nunca la commitees en `.env`, screenshots o tickets.

## Paso 2 - Agregar Polygon Amoy en MetaMask

En MetaMask:

1. Abrir selector de redes.
2. Ir a `Add a custom network` o `Agregar red manualmente`.
3. Completar:

```txt
Network name: Polygon Amoy
New RPC URL: tu RPC de Alchemy/QuickNode/Infura
Chain ID: 80002
Currency symbol: POL
Block explorer URL: https://amoy.polygonscan.com/
```

Si todavia no tenes RPC propio, podes usar temporalmente:

```txt
https://rpc-amoy.polygon.technology/
```

Despues cambialo por un RPC propio.

## Paso 3 - Conseguir gas testnet Amoy

Necesitas POL testnet en la wallet `nexID Amoy Minter`.

1. Abrir faucet:
   - https://www.alchemy.com/faucets/polygon-amoy
   - o https://faucet.quicknode.com/polygon/amoy
2. Pegar address publica de `nexID Amoy Minter`.
3. Solicitar fondos.
4. Esperar unos minutos.
5. Verificar en MetaMask o en:

```txt
https://amoy.polygonscan.com/address/TU_WALLET
```

Si un faucet no funciona, probar el otro. Los faucets cambian disponibilidad y limites con frecuencia.

## Paso 4 - Crear RPC Amoy

Opcion recomendada: Alchemy.

1. Abrir https://dashboard.alchemy.com/
2. Crear una cuenta o entrar.
3. Crear una app nueva.
4. Seleccionar:

```txt
Chain: Polygon
Network: Polygon Amoy
```

5. Copiar la URL HTTPS.

Ejemplo:

```txt
https://polygon-amoy.g.alchemy.com/v2/TU_API_KEY
```

Tambien puede ser QuickNode o Infura. Lo importante es que sea RPC de Polygon Amoy y que responda `chainId 80002`.

## Paso 5 - Generar salt secreto para privacidad

El contrato no debe guardar UID crudo del chip. nexID usa hash del UID con un salt secreto.

Generar salt en PowerShell:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Guardar el valor como:

```txt
TOKENIZATION_UID_SALT=<random largo secreto>
```

Reglas:

- No cambiar el salt despues de empezar un lote real.
- Si cambia el salt, cambia el hash calculado para el mismo UID.
- No publicar el salt.
- No ponerlo en frontend.

## Paso 6 - Desplegar contrato en Amoy

Desde tu maquina local:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
```

Setear variables solo en esa terminal:

```powershell
$env:POLYGON_RPC_URL="https://polygon-amoy.g.alchemy.com/v2/TU_API_KEY"
$env:POLYGON_MINTER_PRIVATE_KEY="0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER"
$env:POLYGON_DEPLOY_OWNER="0xOWNER_DEL_CONTRATO"
```

Compilar:

```powershell
npm run contracts:compile
```

Desplegar:

```powershell
npm run contracts:deploy:amoy
```

El script devuelve un address. Guardalo:

```txt
POLYGON_CONTRACT_ADDRESS=0xCONTRATO_DESPLEGADO
```

Verificar en explorer:

```txt
https://amoy.polygonscan.com/address/0xCONTRATO_DESPLEGADO
```

## Paso 7 - Variables de entorno en Vercel/API

Abrir:

```txt
https://vercel.com/dashboard
```

Entrar al proyecto de API que sirve:

```txt
https://api.nexid.lat
```

Ir a:

```txt
Settings -> Environment Variables
```

Agregar estas variables en `Production` y, si usas previews, tambien en `Preview`.

```txt
TOKENIZATION_MODE=polygon
SUN_AUTO_TOKENIZE_ON_VALID_TAP=true
TOKENIZATION_USE_LOCAL_MINTER=true
TOKENIZATION_UID_SALT=<random largo secreto>
TOKENIZATION_METADATA_CID_PREFIX=nexid-metadata
POLYGON_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/TU_API_KEY
POLYGON_MINTER_PRIVATE_KEY=0xPRIVATE_KEY_DE_NEXID_AMOY_MINTER
POLYGON_CONTRACT_ADDRESS=0xCONTRATO_DESPLEGADO
POLYGON_DEFAULT_RECIPIENT=0xWALLET_RECEPTORA_DEFAULT
POLYGON_DEPLOY_OWNER=0xOWNER_DEL_CONTRATO
```

Despues de guardar variables:

1. Hacer redeploy del proyecto API.
2. Confirmar que el deploy termina OK.
3. Probar un endpoint SUN real.

Importante:

- `POLYGON_MINTER_PRIVATE_KEY` va solo en API/backend.
- No va en web.
- No va en dashboard.
- No va en `NEXT_PUBLIC_*`.
- No va en repositorio.

## Que significa cada variable

| Variable | Valor | Para que sirve |
| --- | --- | --- |
| `TOKENIZATION_MODE` | `polygon` | Obliga a usar anclaje real Polygon. Si falla, no simula como fallback. |
| `SUN_AUTO_TOKENIZE_ON_VALID_TAP` | `true` | Crea tokenizacion automatica cuando el tap SUN es valido. |
| `TOKENIZATION_USE_LOCAL_MINTER` | `true` | Permite que la API firme con la wallet minter configurada. |
| `TOKENIZATION_UID_SALT` | secreto largo | Protege privacidad del UID: se hashea antes de anclar. |
| `TOKENIZATION_METADATA_CID_PREFIX` | `nexid-metadata` o CID | Prefijo/base para metadata. En piloto puede ser local/logico; en premium usar IPFS/Arweave. |
| `POLYGON_RPC_URL` | URL RPC Amoy | Nodo por donde la API envia transacciones. |
| `POLYGON_MINTER_PRIVATE_KEY` | `0x...` | Private key de wallet minter dedicada. |
| `POLYGON_CONTRACT_ADDRESS` | `0x...` | Contrato NFT/certificado desplegado. |
| `POLYGON_DEFAULT_RECIPIENT` | `0x...` | Wallet que recibe token si el usuario no conecto wallet. |
| `POLYGON_DEPLOY_OWNER` | `0x...` | Owner/admin del contrato. |

## Paso 8 - Variables locales para desarrollo

No commitear valores reales.

Podes usar el ejemplo:

```txt
apps/api/.env.tokenization.example
```

Para probar local, setear variables en PowerShell antes de levantar API:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
$env:TOKENIZATION_MODE="polygon"
$env:SUN_AUTO_TOKENIZE_ON_VALID_TAP="true"
$env:TOKENIZATION_USE_LOCAL_MINTER="true"
$env:TOKENIZATION_UID_SALT="TU_SALT"
$env:TOKENIZATION_METADATA_CID_PREFIX="nexid-metadata"
$env:POLYGON_RPC_URL="TU_RPC"
$env:POLYGON_MINTER_PRIVATE_KEY="0xTU_PRIVATE_KEY"
$env:POLYGON_CONTRACT_ADDRESS="0xTU_CONTRATO"
$env:POLYGON_DEFAULT_RECIPIENT="0xTU_RECIPIENT"
$env:POLYGON_DEPLOY_OWNER="0xTU_OWNER"
```

Validar configuracion local:

```powershell
npm run tokenization:check
```

El check confirma variables, chain id Amoy, bytecode del contrato y gas de la wallet minter sin imprimir private keys.

## Paso 9 - Migraciones y base de datos

Desde raiz del repo:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion
npm run db:migrate
```

Confirmar que existen tablas/campos para:

- solicitudes de tokenizacion
- estado
- red
- `tx_hash`
- `token_id`
- contrato
- metadata
- timestamps

## Paso 10 - Test manual antes de usar tags reales

Antes de probar con las 10 etiquetas fisicas, hacer una prueba manual.

Desde API:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
```

Ejecutar el script de mint/anclaje que ya existe en el proyecto:

```powershell
node scripts/mint-on-valid-tap.mjs
```

Resultado esperado:

```txt
network: polygon-amoy
contract: 0x...
tx_hash: 0x...
token_id: ...
status: minted / anchored
```

Abrir:

```txt
https://amoy.polygonscan.com/tx/TX_HASH
```

Si la transaccion aparece, la ruta blockchain esta viva.

## Paso 11 - Test con un tap SUN real

Usar primero una sola etiqueta fisica.

1. Tapear tag con celular.
2. Abrir URL SUN generada, por ejemplo:

```txt
https://api.nexid.lat/sun?v=1&bid=...&picc_data=...&enc=...&cmac=...
```

3. Confirmar que la API valida:

```txt
status = VALID o AUTH_OK
replay = false
tamper = estado correcto
```

4. Confirmar que crea tokenizacion.
5. Confirmar que `/sun` muestra:

```txt
SANDBOX_READY -> solo si esta en modo simulated
POLYGON_PENDING -> si esta en cola
POLYGON_MINTED / ANCHORED -> si ya hay tx real
```

6. Confirmar en admin/superadmin que aparece la solicitud.
7. Abrir `tx_hash` en Amoy Polygonscan.

## Paso 12 - Test con las 10 etiquetas fisicas

No quemar todo el lote de una.

Orden recomendado:

1. Probar 1 tag.
2. Probar 2 o 3 tags.
3. Revisar dashboard, mapas, replay, tokenizacion y portal.
4. Recién despues probar las 10.

Llevar una tabla de control:

| Tag | BID | Resultado SUN | Replay | Tamper | tx_hash | token_id | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | DEMO... | VALID | no | ok | 0x... | 1 | OK |
| 2 | DEMO... | VALID | no | ok | 0x... | 2 | OK |

## Paso 13 - Flujo portal consumidor y marketplace

Despues de un tap valido:

1. `/sun` debe mostrar passport, origen, trazabilidad, estado tamper y tokenizacion.
2. El usuario puede tocar `Registrarme`.
3. Se asocia el tap al portal consumidor.
4. El portal muestra:
   - producto verificado
   - tenant asociado
   - historial de taps
   - beneficios/promos
   - token/certificado si existe
5. Marketplace abre productos, vouchers o experiencias del tenant.
6. Admin tenant ve:
   - taps en vivo
   - ubicaciones
   - usuarios asociados
   - clicks marketplace
   - solicitudes tokenizadas
7. Superadmin ve:
   - leads
   - tenants
   - seguridad/replay
   - mapa global
   - exportaciones

## Paso 14 - Como saber si esta funcionando bien

Checklist rapido:

- Amoy en MetaMask: OK.
- Wallet minter tiene POL testnet: OK.
- RPC responde: OK.
- Contrato desplegado: OK.
- `POLYGON_CONTRACT_ADDRESS` cargado en Vercel API: OK.
- API redeploy: OK.
- Tap real SUN devuelve valido: OK.
- Se crea solicitud de tokenizacion: OK.
- Hay `tx_hash`: OK.
- `tx_hash` abre en Amoy Polygonscan: OK.
- `/sun` muestra tokenizacion real: OK.
- Admin/superadmin muestran el evento: OK.

## Errores comunes

| Error | Causa probable | Solucion |
| --- | --- | --- |
| `insufficient funds` | Wallet minter sin POL Amoy | Pedir gas en faucet. |
| `missing POLYGON_RPC_URL` | Falta RPC en env | Agregar RPC en Vercel/API y redeploy. |
| `polygon_anchor_unavailable_configure_local_minter_or_executor` | `TOKENIZATION_MODE=polygon`, pero no hay minter local ni executor | Setear `TOKENIZATION_USE_LOCAL_MINTER=true` y private key, o configurar executor. |
| Queda en sandbox | `TOKENIZATION_MODE=simulated` | Cambiar a `polygon` en API. |
| No se tokeniza automaticamente | `SUN_AUTO_TOKENIZE_ON_VALID_TAP=false` o tap invalido/replay | Activar env y revisar validacion SUN. |
| El explorer no muestra tx | RPC lento o tx pendiente | Esperar, revisar `tx_hash`, revisar wallet gas. |
| Duplicate/replay bloqueado | La misma URL SUN fue usada antes | Correcto: no debe mintar por replay sospechoso. |
| Token duplicado | UID hash ya tenia token | Revisar si el contrato o backend ya registro ese UID hash. |
| Wallet popup falla en browser | Extension MetaMask/Phantom/Polkadot interviene | Probar perfil limpio o desactivar extensiones no necesarias. |

## Privacidad y veracidad

El modelo correcto para NTAG 424 DNA TT es:

- Validar SUN/CMAC server-side.
- Detectar replay.
- Guardar evento operativo en la base.
- Anclar en blockchain solo datos no sensibles.
- Usar hash del UID con salt secreto.
- No publicar UID crudo.
- No publicar claves SUN.
- No publicar private keys.

Ejemplo conceptual:

```txt
chip_uid_real + TOKENIZATION_UID_SALT -> chipUidHash -> contrato
```

Esto permite demostrar que el producto fue autenticado sin revelar el identificador fisico original.

La ruta de metadata y el `asset_ref` tambien deben usar un identificador publico derivado:

```txt
public_asset_id = nx-<fragmento de chipUidHash>
token_uri = ipfs://<prefix>/<BID>/<public_asset_id>.json
asset_ref = <BID>:<public_asset_id>
```

No usar UID crudo en `token_uri` ni `asset_ref`.

## Metadata del token

Para piloto:

```txt
TOKENIZATION_METADATA_CID_PREFIX=nexid-metadata
```

Para premium:

1. Generar metadata por producto.
2. Subir JSON e imagen a IPFS, Arweave o storage verificable.
3. Usar CID/prefix real.
4. Guardar enlace en token URI.

Campos recomendados:

```json
{
  "name": "Gran Reserva Malbec - Digital Passport",
  "description": "nexID verified physical product passport.",
  "attributes": [
    { "trait_type": "Tenant", "value": "demobodega" },
    { "trait_type": "Batch", "value": "DEMO-BODEGA-0424" },
    { "trait_type": "Security", "value": "NTAG 424 DNA TT" },
    { "trait_type": "Origin", "value": "Valle de Uco, Argentina" }
  ]
}
```

## Camino premium despues del piloto

Para demo con 10 tags, `TOKENIZATION_USE_LOCAL_MINTER=true` esta bien si la private key vive solo en Vercel API y la wallet es dedicada.

Para produccion premium:

1. Mover firma a executor/KMS.
2. Usar:

```txt
TOKENIZATION_EXECUTOR_URL=https://...
TOKENIZATION_EXECUTOR_SECRET=...
```

3. Sacar `POLYGON_MINTER_PRIVATE_KEY` de Vercel.
4. Agregar rate limits.
5. Agregar allowlist por tenant/tag batch.
6. Monitorear gas y fallos.
7. Separar owner, minter y operator.
8. Preparar rotacion de claves.

## Que necesito que hagas vos

Checklist para vos:

1. Crear wallet `nexID Amoy Minter` en MetaMask.
2. Crear o elegir wallet owner.
3. Crear o elegir wallet recipient default.
4. Conseguir POL testnet en Amoy para la minter.
5. Crear RPC Amoy en Alchemy/QuickNode/Infura.
6. Pasarme o cargar vos en Vercel:
   - RPC URL
   - private key minter
   - owner address
   - recipient address
7. Ejecutar deploy del contrato o dejarme los datos para correrlo local.
8. Copiar `POLYGON_CONTRACT_ADDRESS`.
9. Agregar variables en Vercel/API.
10. Redeploy API.
11. Probar un tag real.
12. Verificar `tx_hash` en Amoy Polygonscan.

## Comandos finales de verificacion

Desde raiz:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion
npm run qa:static
```

API:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\api
npm run typecheck
npm test
```

Web:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\web
npm run typecheck
```

Dashboard:

```powershell
cd C:\Users\guill\OneDrive\Documentos\GitHub\NFC-Tokenizacion\apps\dashboard
npm run typecheck
```

## Decision recomendada

Para el piloto actual:

```txt
Red: Polygon Amoy
Modo: TOKENIZATION_MODE=polygon
Auto tokenizacion: true
Minter: wallet dedicada con gas testnet
Privacidad: UID hash + salt
Metadata: prefix sandbox primero, IPFS despues
Recipient: wallet demo o tenant wallet
```

Cuando el piloto este estable, pasar a executor/KMS antes de mainnet.
