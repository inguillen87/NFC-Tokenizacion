# Runbook operativo de Proof Layer

Este runbook cubre la operacion de las capas Polygon ownership e IOTA proof de nexID. La fuente de verdad operativa sigue siendo nexID: SUN/NFC, policy tenant, DPP privado y base de datos. Blockchain es una capacidad opcional y nunca habilita autenticidad fisica por si sola.

## Alcance y limites

- Polygon representa ownership, certificados y transferencias controladas.
- IOTA registra evidencia hash-only, Merkle roots y checkpoints seleccionados.
- Ninguna capa recibe PII, UID NFC crudo, secretos SUN/KMS, manifest completos ni datos comerciales privados.
- Un fallo de IOTA no debe bloquear SUN, DPP privado, passport ni Polygon.
- Un fallo de Polygon no puede convertirse en mint simulado o ownership confirmado.
- IOTA EVM Testnet y Polygon Amoy son entornos de prueba; no constituyen readiness legal o comercial para mainnet.
- nexID no afirma partnership oficial ni costo operativo cero de ninguna red.

## Modos soportados

### IOTA runtime de anchors

`IOTA_PROVIDER_MODE` controla la escritura desde `POST /admin/proof/anchors`:

| Modo | Uso | Resultado esperado |
| --- | --- | --- |
| `disabled` | Default seguro | La lectura sigue disponible; una escritura responde `ledger_provider_runtime_disabled` |
| `mock` | Desarrollo local | Reserva el anchor y lo deja `submitted` sin evidencia publica; esta prohibido cuando `NODE_ENV=production` |
| `iota_evm_contract_v2` | Writer V2 nativo | Persiste identidad e idempotencia antes de publicar, delega la firma y reconcilia receipt, calldata, evento y storage |
| `iota_notarization_sdk_later` | Reserva de arquitectura | Responde `external_anchor_adapter_not_enabled`; no simula soporte |

Variables de la API:

```txt
IOTA_PROVIDER_MODE=disabled
IOTA_EVM_RPC_URL=
IOTA_EVM_EXPECTED_CHAIN_ID=1076
IOTA_EVM_MIN_CONFIRMATIONS=1
IOTA_EVM_ANCHOR_CONTRACT_V2=
IOTA_PROOF_EXECUTOR_URL=
IOTA_PROOF_EXECUTOR_SECRET=
INTERNAL_PROOF_ANCHOR_KEY=
IOTA_EXPLORER_BASE_URL=
```

El writer de nuevas evidencias es V2-only e invoca `anchorEvidence(...)`. `IOTA_EVM_ANCHOR_CONTRACT` queda reservado para verificar historicos V1 y nunca habilita nuevas escrituras. En produccion la API ignora cualquier private key local; el publisher se configura en el executor aislado. `IOTA_ALLOW_LOCAL_SIGNER=true` existe solo para desarrollo no productivo y no es una configuracion aceptable de release.

Variables del executor:

```txt
IOTA_PROOF_EXECUTOR_SECRET=
IOTA_EXECUTOR_SIGNER_MODE=private_key
IOTA_EVM_RPC_URL=
IOTA_EVM_EXPECTED_CHAIN_ID=1076
IOTA_EVM_ANCHOR_CONTRACT_V2=
IOTA_EVM_PRIVATE_KEY=
```

`private_key` es un modo de testnet/piloto. El target enterprise sigue siendo un signer no exportable en KMS/HSM o custodia administrada con aprobacion dual y rotacion documentada.

### Fixture publico IOTA V2

El fixture V2 puede verificarse sin alojar una private key y usa el mismo contrato/calldata que el writer nativo:

```txt
IOTA_EVM_RPC_URL=https://json-rpc.evm.testnet.iota.cafe
IOTA_EVM_ANCHOR_CONTRACT_V2=0xde7284812D0c81080Cc7B2f60d6D9769343Aa2B0
IOTA_EVM_DEPLOYER_ADDRESS=0x2f320d2B0D8AE483637D8f5509480228509165cB
```

`npm run iota:verify-proof-v2 --workspace=api` comprueba chain ID, publisher autorizado, transaccion, receipt, calldata, `EvidenceAnchored`, `proofId` y registro del contrato para los tres casos publicos. La direccion V2 por si sola no habilita escrituras: tambien se requieren modo explicito, executor autenticado y policy de ledger aprobada para el tenant.

### Polygon ownership

La escritura se habilita solo de forma explicita:

```txt
TOKENIZATION_MODE=off
TOKENIZATION_USE_LOCAL_MINTER=false
TOKENIZATION_UID_SALT=
POLYGON_RPC_URL=
POLYGON_CONTRACT_ADDRESS=
POLYGON_MINTER_ADDRESS=
POLYGON_MINTER_PRIVATE_KEY=
```

- `off`: no crea transacciones.
- `simulated`: solo desarrollo/control interno; nunca debe persistir `anchored` ni un hash de blockchain real.
- `polygon`: requiere policy aprobada, RPC, contrato, salt y executor/minter autorizado.
- `TOKENIZATION_USE_LOCAL_MINTER=true` es una excepcion operativa de piloto. Produccion debe mover firma a executor aislado, KMS/HSM o custodia enterprise.

La prueba publica buyer-controlled usa solo datos publicos en runtime: token ID, hashes de transaccion, wallet, firma EIP-191 archivada y contrato. `PUBLIC_PROOF_DEMO_POLYGON_BUYER_PRIVATE_KEY` permanece exclusivamente en `apps/api/.env.local` y no se carga en Vercel.

## Preflight antes de desplegar

Ejecutar desde la raiz del monorepo:

```powershell
npm.cmd run test:proof-demos --workspace=api
npm.cmd run tokenization:check --workspace=api
npm.cmd run build --workspace=api
npm.cmd test --workspace=web
npm.cmd run typecheck --workspace=dashboard
```

Para verificacion live de fixtures publicos, con acceso de red:

```powershell
npm.cmd run polygon:verify-proof-demo --workspace=api
npm.cmd run iota:verify-proof-v2 --workspace=api
```

Los comandos live deben fallar si RPC, chain, contrato, recibo, eventos, owner, metadata, source o signer no coinciden. Un error de red no se interpreta como prueba invalida ni como prueba confirmada: es estado no disponible.

## Checklist de release

1. Confirmar que no hay secrets en variables `NEXT_PUBLIC_*`, logs, build artifacts o respuestas JSON.
2. Confirmar que `IOTA_PROVIDER_MODE` y `TOKENIZATION_MODE` son explicitos para el ambiente.
3. Revisar `GET /admin/proof/providers`: `runtime_status`, `write_enabled` y flags `rpc/contract/signer` deben coincidir con el despliegue esperado.
4. Verificar que `mock` no este habilitado en produccion.
5. Ejecutar build y suites de proof, Polygon transfer y wallet control.
6. Ejecutar los verificadores live desde una red independiente del proveedor de hosting.
7. Abrir `/proof/verify` y `/proof/ownership` en desktop y mobile; no aceptar badges confirmados sin verificacion RPC.
8. Confirmar que explorers, contratos, chain IDs y warnings de testnet corresponden al ambiente.
9. Revisar que el certificado Polygon exija metadata semanticamente ligada a schema, entorno, chain ID y contrato.
10. Registrar commit, fecha, operador, salida sanitizada y decision de release en el sistema interno de auditoria.

## Operacion normal

### Crear evidencia IOTA desde admin

1. Autenticar un admin con permiso `proof:write` y tenant scope valido.
2. Enviar `event_ids` tenant-scoped y un `public_resource_id` con formato `sha256:<64 hex>`, derivado con separacion de dominio de tenant, tipo de recurso e ID interno. El ID interno permanece en `resource_id` off-chain y nunca se copia al campo publico. Los hashes directos estan deshabilitados en produccion por default.

   Contrato canonico v1: normalizar cada valor con Unicode NFC y `trim`; convertir tenant y `resource_type` a minusculas; serializar exactamente `JSON.stringify(["nexid.public-ledger.resource.v1", tenant, resource_type, resource_id])`; aplicar SHA-256 sobre sus bytes UTF-8 y prefijar el hexadecimal minusculo con `sha256:`. No usar email, telefono, URL, UUID, UID NFC ni otro dato personal como `resource_id` de entrada.

3. Enviar `Idempotency-Key`; un retry HTTP debe devolver el mismo anchor y nunca otra transaccion.
4. La API valida que todos los eventos pertenezcan al mismo tenant/recurso, ordena por `created_at,id`, calcula Merkle root, `memoHash` y `proofId`, y persiste el anchor antes de tocar la red.
5. El executor valida chain, bytecode, version de contrato, publisher y `proofId`; devuelve `202 submitted` apenas obtiene `tx_hash`.
6. El worker autenticado llama `POST /internal/proof/anchors/worker`, toma filas con `FOR UPDATE SKIP LOCKED` y reconcilia receipt, calldata exacto, evento, storage y confirmaciones.
7. Solo despues de esa reconciliacion el estado pasa a `confirmed`. Verificar luego por `POST /public/proof/verify` con `event_hash` y `anchor_id`.

Estados esperados: `pending` (reservado), `reconciling` (lease de worker), `submitted` (tx conocida), `confirmed` (prueba RPC completa) y `failed` (error terminal o presupuesto de reintentos agotado). Una fila `confirmed` en base de datos nunca alcanza por si sola para mostrar evidencia publica validada.

### Verificar ownership Polygon

1. Resolver chain ID y bytecode del contrato.
2. Leer `ownerOf`, `tokenURI`, binding hash y asset reference.
3. Validar recibo y eventos del mint contra el contrato y token configurados.
4. Si hay buyer claim, validar recibo de transferencia, owner actual y firma EIP-191 contra la misma wallet.
5. Validar metadata HTTPS: schema, testnet, chain ID, contrato, imagen y URL externa.
6. Verificar source con creation y runtime match. Una flag local nunca reemplaza Sourcify/explorer.
7. Recordar que HTTPS no es content-addressed: el control confirma el documento actual, no su inmutabilidad historica.

## Matriz de incidentes

| Sintoma | Estado honesto | Accion |
| --- | --- | --- |
| RPC timeout o DNS | `unavailable` / `read_only` | Probar RPC secundario aprobado, revisar status page y no alterar el ultimo estado confirmado |
| Chain ID inesperado | Falla cerrada | Bloquear escritura/veredicto y corregir endpoint |
| Contrato sin bytecode | Falla cerrada | Revisar red/direccion; no hacer fallback a mock |
| Receipt ausente | `submitted` | Reconciliar por tx hash; no reemitir mientras la transaccion pueda seguir pendiente |
| Receipt revertido o calldata/evento/storage distinto | `failed` | Bloquear confirmacion, preservar intento y escalar; nunca maquillar con otra tx |
| Worker no avanza | `pending` / `submitted` vencidos | Revisar scheduler, secreto interno y backlog; ejecutar un canary con limite bajo |
| Merkle root no coincide | Rechazo 400 | Corregir corpus/canonicalizacion; no anclar el root recibido |
| Metadata Polygon no coincide | Certificado `partial` | Corregir documento/config; no mostrar ownership verificado |
| Source no verificado | Check pendiente | Publicar/verificar source; no ocultar el control |
| Owner cambio despues del fixture | Buyer proof pendiente | Actualizar transferencia/firma mediante proceso autorizado; no editar solo la UI |
| `mock` solicitado en produccion | Rechazo 409 | Cambiar a `disabled` o configurar adapter externo real |
| Registry privado caido | Demo puede seguir read-only | Responder warning; no convertir fixture en registro productivo |

## Reintentos e idempotencia

- No enviar otra transaccion mientras el nonce anterior siga pendiente sin reconciliacion.
- Identificar cada operacion por `proofId` deterministico e `Idempotency-Key` tenant-scoped.
- Una tx confirmada se reconcilia; no se reminta ni se reancla para ocultar un error de lectura.
- Un evento corregido genera compensacion/revocacion o una nueva version; no se borra evidencia anterior.
- Mantener colas separadas para Polygon ownership e IOTA evidence.
- Conservar `evidence_anchor_attempts` y `evidence_anchor_members`: son la trazabilidad entre el corpus privado, el intento de publicacion y la prueba publica.

## Rotacion y recuperacion de signer

1. Pausar nuevas escrituras de la capa afectada; mantener lectura y SUN.
2. Revocar el rol on-chain del signer comprometido cuando el contrato lo permita.
3. Crear el reemplazo en KMS/HSM/custodia; nunca copiar claves por chat, ticket o log.
4. Autorizar el nuevo address con control dual y transaccion auditada.
5. Actualizar secretos del ambiente y reiniciar solo los workers necesarios.
6. Ejecutar preflight, una operacion canary y verificacion independiente.
7. Documentar ventana, addresses, transacciones y responsables sin incluir material secreto.

## Criterio para mainnet

No promover por el solo hecho de que testnet responda. Se requiere contrato de produccion versionado y source verificado, roles separados, signer no exportable, RPC redundante, alertas de nonce/gas/reorg, reconciliacion, SLA, retencion, threat model, revision legal por jurisdiccion y piloto con rollback. La metadata contractual debe ser versionada y, cuando corresponda, content-addressed o ligada por digest on-chain.
