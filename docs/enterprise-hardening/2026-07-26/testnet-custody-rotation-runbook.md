# Testnet chain custody rotation runbook

Estado: tooling implementado, probado y ejecutado en las dos testnets. Las
rotaciones convergieron, el publisher legacy quedo revocado y un segundo plan
resulto sin mutaciones pendientes. La evidencia, owners, publishers y hashes de
transaccion estan en
`docs/enterprise-hardening/2026-07-26/production-hardening-evidence.md`. Las
redes admitidas por este tooling siguen siendo exclusivamente IOTA EVM testnet
`1076` y Polygon Amoy `80002`.

## Resultado buscado

Cada contrato termina con roles separados:

- `governance`: owner administrativo KMS-wrapped;
- `publisher`: firmante operativo KMS-wrapped;
- `legacy publisher`: desautorizado despues de transferir ownership;
- ninguna ruta implementa ni expone `renounceOwnership`.

Los ciphertext se leen desde archivos locales; las claves legacy solo se
aceptan mediante variables de entorno. Los tokens OAuth de Google se separan
por rol, se usan en memoria para REST KMS, se eliminan del entorno del proceso
al primer uso y nunca se imprimen ni se escriben en el journal.

## Controles del ejecutor

El comando empieza en `plan`. `apply` exige el literal
`APPLY_NEXID_TESTNET_CUSTODY_ROTATION`. Antes de firmar valida:

1. chain ID fijo;
2. bytecode en el contrato y owner esperado;
3. `SCHEMA_VERSION=2` para IOTA;
4. roles target distintos de owner/publisher legacy;
5. para IOTA, governance exactamente
   `0xC617de00DF0F0Cb92Cb1b763CD81AF0c7aE40C7B`;
6. top-ups acotados por target y cap total;
7. gas estimado mas margen dentro de caps por transaccion.

El journal `.nexid-custody/*.json` se escribe con reemplazo atomico y modo
`0600` donde el sistema lo soporta. Antes de broadcast persiste la transaccion
firmada y su hash, de modo que un retry reanuda la misma transaccion. Una vez
confirmada elimina el raw firmado. El journal no contiene claves, tokens OAuth
ni ciphertext.

## Generar publisher y governance nuevos para Polygon

Crear el directorio de ciphertext fuera de Git. El script se niega a
sobrescribir archivos y, si la segunda envoltura falla, elimina solo el output
nuevo que creo en esa misma ejecucion.

```powershell
$env:NEXID_CUSTODY_GENERATION_APPROVED='GENERATE_NEXID_POLYGON_TESTNET_CUSTODY_WALLETS'
$env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN='<token del SA publisher>'
$env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN='<token del SA governance>'
try {
  npm run custody:generate:polygon --workspace=executor -- `
    --environment staging `
    --publisher-key-resource 'projects/PROJECT/locations/REGION/keyRings/RING/cryptoKeys/POLYGON_PUBLISHER_KEK' `
    --governance-key-resource 'projects/PROJECT/locations/REGION/keyRings/RING/cryptoKeys/POLYGON_GOVERNANCE_KEK' `
    --publisher-output 'C:\secure\nexid\polygon-publisher.ct.b64' `
    --governance-output 'C:\secure\nexid\polygon-governance.ct.b64' `
    --transport rest
} finally {
  Remove-Item Env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_CUSTODY_GENERATION_APPROVED -ErrorAction SilentlyContinue
}
```

La salida contiene solo las dos direcciones publicas y las rutas de sus
ciphertext. Guardar esas direcciones en el inventario de custodia y restringir
IAM de cada KEK al operador que corresponda.

## Configuracion comun

Para `IOTA`, reemplazar `CHAIN` por `IOTA`; para Polygon, por `POLYGON`.

```text
CHAIN_CUSTODY_RPC_URL=https://...
CHAIN_CUSTODY_CONTRACT_ADDRESS=0x...
CHAIN_CUSTODY_LEGACY_OWNER_ADDRESS=0x...
CHAIN_CUSTODY_LEGACY_PUBLISHER_ADDRESS=0x...
CHAIN_CUSTODY_TARGET_GOVERNANCE_ADDRESS=0x...
CHAIN_CUSTODY_TARGET_PUBLISHER_ADDRESS=0x...
CHAIN_CUSTODY_GOVERNANCE_KMS_KEY_RESOURCE=projects/.../cryptoKeys/...
CHAIN_CUSTODY_GOVERNANCE_CIPHERTEXT_PATH=C:\secure\...governance.ct.b64
CHAIN_CUSTODY_GOVERNANCE_WRAP_ROLE=governance
CHAIN_CUSTODY_PUBLISHER_KMS_KEY_RESOURCE=projects/.../cryptoKeys/...
CHAIN_CUSTODY_PUBLISHER_CIPHERTEXT_PATH=C:\secure\...publisher.ct.b64
CHAIN_CUSTODY_PUBLISHER_WRAP_ROLE=publisher
CHAIN_CUSTODY_KMS_TRANSPORT=rest
NEXID_KMS_ENVIRONMENT=staging
NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN=<token del SA governance>
NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN=<token del SA publisher>
```

`NEXID_GCP_KMS_ACCESS_TOKEN` queda admitido solo como fallback compatible para
una operacion aislada de un unico rol. La rotacion Polygon completa debe usar
los dos tokens role-specific; no se comparte un token entre KEKs con IAM
separado.

El archivo preexistente
`C:\Users\guill\AppData\Local\Temp\nexid-iota-governance-20260725\wallet.enc`
fue creado el 2026-07-26 03:09:01 UTC con la version anterior del helper, que
hardcodeaba el AAD `nexid.wallet.wrap.v1|staging|iota|publisher`. Si se usa ese
ciphertext debe declararse explicitamente
`IOTA_CUSTODY_GOVERNANCE_WRAP_ROLE=publisher`; no adivinarlo ni reintentar con
roles alternativos.

La opcion preferida es reenvolverlo en memoria a role `governance`, sin crear
un archivo de plaintext. Source y target pueden usar KEKs/IAM distintos:

```powershell
$env:NEXID_CUSTODY_REWRAP_APPROVED='REWRAP_NEXID_IOTA_GOVERNANCE_AAD'
$env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN='<token con decrypt sobre source KEK>'
$env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN='<token con encrypt sobre target KEK>'
try {
  npm run custody:rewrap:iota-governance --workspace=executor -- `
    --source-key-resource 'projects/PROJECT/locations/REGION/keyRings/RING/cryptoKeys/SOURCE_KEK' `
    --target-key-resource 'projects/PROJECT/locations/REGION/keyRings/RING/cryptoKeys/TARGET_KEK' `
    --input 'C:\Users\guill\AppData\Local\Temp\nexid-iota-governance-20260725\wallet.enc' `
    --output 'C:\secure\nexid\iota-governance-role.ct.b64' `
    --expected-address '0xC617de00DF0F0Cb92Cb1b763CD81AF0c7aE40C7B' `
    --transport rest
} finally {
  Remove-Item Env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_CUSTODY_REWRAP_APPROVED -ErrorAction SilentlyContinue
}
```

El comando valida que el plaintext recuperado deriva exactamente la governance
esperada, usa CRC32C/AAD en decrypt y encrypt, escribe el nuevo ciphertext con
creacion exclusiva y limpia todos los buffers de plaintext en `finally`.

Caps por defecto: target `0.05` token nativo para cada rol, suma maxima de
top-ups `0.25`, gas limit `2,000,000` y costo maximo estimado por tx `0.05`.
Pueden bajarse por variables `CHAIN_CUSTODY_*`; el core rechaza targets cuya
suma exceda el cap.

## Preflight read-only

No requiere private key legacy ni token Google; tampoco descifra ciphertext.

```powershell
npm run custody:migrate --workspace=executor -- --domain iota --mode plan
npm run custody:migrate --workspace=executor -- --domain polygon --mode plan
```

Revisar que las acciones aparezcan en este orden:

- top-up de governance/publisher solo si falta saldo;
- self-transfer de governance KMS (IOTA y Polygon);
- autorizacion del target publisher;
- canary Polygon deterministico e idempotente;
- `transferOwnership` a governance;
- revocacion del publisher legacy usando governance;
- verificacion final.

El canary Polygon usa un `chipUidHash` deterministico, recipient governance y
metadata publica marcada testnet. Si ya existe, valida owner, hash, URI y asset
ref; una colision diferente aborta.

## Apply controlado

Ejecutar una red por vez. La clave legacy nunca se pasa como argumento ni se
guarda en archivo.

```powershell
$env:NEXID_CUSTODY_MIGRATION_APPROVED='APPLY_NEXID_TESTNET_CUSTODY_ROTATION'
$env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN='<token del SA governance>'
$env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN='<token del SA publisher>'
$env:IOTA_CUSTODY_LEGACY_OWNER_PRIVATE_KEY='<legacy-key-only-in-process-env>'
try {
  npm run custody:migrate --workspace=executor -- --domain iota --mode apply
} finally {
  Remove-Item Env:NEXID_GCP_KMS_GOVERNANCE_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_GCP_KMS_PUBLISHER_ACCESS_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:IOTA_CUSTODY_LEGACY_OWNER_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:NEXID_CUSTODY_MIGRATION_APPROVED -ErrorAction SilentlyContinue
}
```

Repetir para Polygon con
`POLYGON_CUSTODY_LEGACY_OWNER_PRIVATE_KEY`. Un retry vuelve a inspeccionar el
estado on-chain, reanuda cualquier raw firmado pendiente desde journal y no
repite roles, ownership ni canary ya confirmados.

## Gate posterior

La salida final debe confirmar simultaneamente:

- owner igual a governance target;
- publisher target autorizado;
- publisher legacy desautorizado;
- canary Polygon verificado (solo Polygon);
- ninguna accion pendiente al repetir `plan` salvo
  `verify_final_invariants`.

Despues de verificar ambos contratos, retirar las variables legacy del entorno
operativo. No borrar los ciphertext ni destruir versiones KMS como parte de
este script; esa decision requiere backup, evidencia de recovery e IAM audit.
