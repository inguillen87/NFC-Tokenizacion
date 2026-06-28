# Polygon ownership layer

Polygon es la capa de propiedad digital del Enterprise Trust Layer de nexID. Su rol es representar claims, certificados, warranty transfer y transferencias controladas, no auditar cada interaccion del producto.

## Que resuelve

Polygon aporta un registro publico verificable para:

- Certificado NFT o token de trazabilidad.
- Claim de producto por consumidor, tenant o wallet custodial.
- Transferencia controlada de garantia o titularidad digital.
- Evidencia publica de mint/transferencia/revocacion si el contrato lo soporta.
- Link verificable desde passport, portal consumidor, dashboard o marketplace.

La propiedad digital puede complementar la titularidad comercial o legal, pero no la reemplaza automaticamente. El alcance legal depende de terminos del tenant, jurisdiccion, factura, garantia y contrato comercial.

## Que no resuelve

Polygon no debe usarse para:

- Guardar todos los taps.
- Guardar PII o datos crudos del consumidor.
- Guardar UID crudo de los chips.
- Guardar payload SUN, CMAC, `K_META`, `K_FILE` o secretos KMS.
- Publicar inventario sensible, rutas logisticas completas, precios o condiciones comerciales.
- Simular autenticidad fisica sin validacion SUN previa.

## Fuente de verdad previa al mint

Un mint o claim solo puede nacer desde un evento validado por nexID:

1. El usuario toca un tag NFC.
2. La API valida SUN/SDM, replay, tamper, batch, manifest y tenant.
3. El backend crea un evento DPP interno.
4. El policy engine decide si el evento habilita claim/tokenizacion.
5. Se crea una solicitud de tokenizacion.
6. El executor/minter firma la transaccion Polygon.
7. nexID guarda `tx_hash`, `token_id`, contrato, red y estado.

Un refresh del navegador, una URL copiada o un replay sospechoso no deben habilitar ownership, rewards ni tokenizacion.

## Politica de mint

La politica recomendada para produccion es **claim-driven**, no **every-tap-on-chain**.

| Caso | Mint/claim recomendado |
| --- | --- |
| Primer tap valido y fresco, usuario decide reclamar | Si |
| Tap valido anonimo sin claim | No por defecto |
| Tap replay/snapshot/link copiado | No |
| Producto abierto o tamper observado | Depende de politica del tenant; nunca automatico sin regla |
| Transferencia de garantia/titularidad digital | Si hay owner actual, comprador/recipient validado y regla del tenant |
| Reemision por disputa o reemplazo | Solo con aprobacion y registro interno |
| Evento logistico | No en Polygon; usar DPP/IOTA proof si aplica |

En pilotos controlados puede existir auto-tokenizacion para un lote allowlisted. Esa configuracion no debe presentarse como modelo general para todos los taps de produccion.

## Datos permitidos en Polygon

Los datos on-chain deben ser minimizados y publicos por diseno.

| Campo | Recomendacion |
| --- | --- |
| `chip_uid_hash` | Hash derivado con salt secreto; nunca UID crudo |
| `asset_ref` | Identificador publico sin UID real |
| `token_uri` | Metadata sanitizada, sin PII |
| `tenant_ref` | Slug o referencia publica si el tenant lo aprueba |
| `batch_ref` | Identificador de lote publico o derivado |
| `event_digest` | Hash opcional de evento canonico, no evento completo |

Los Merkle roots y checkpoints agregados pertenecen por defecto a la capa IOTA proof/audit, no al contrato Polygon de ownership.

Ejemplo conceptual:

```txt
uid_hex + TOKENIZATION_UID_SALT -> chip_uid_hash
chip_uid_hash -> public_asset_id
public_asset_id -> asset_ref/token_uri
```

## Roles operativos

| Rol | Responsabilidad |
| --- | --- |
| Owner del contrato | Administracion del contrato, roles y upgrades si existen |
| Minter | Firma mints autorizados |
| Executor | Servicio backend que valida solicitud y firma transaccion |
| API nexID | Crea requests, valida policy y registra resultado |
| Tenant admin | Aprueba reglas de claim, revocacion y visibilidad |

Para piloto puede usarse una wallet minter dedicada con gas testnet. Para produccion enterprise, la firma debe moverse a executor/KMS, HSM o proveedor de custodia segun riesgo.

## Estados de tokenizacion

| Estado | Significado |
| --- | --- |
| `not_requested` | El DPP existe, pero no se solicito tokenizacion |
| `eligible` | El evento cumple condiciones para claim/mint |
| `pending` | Solicitud creada, esperando firma o confirmacion |
| `minted` | Transaccion enviada y token emitido |
| `confirmed` | Transaccion confirmada por red/RPC |
| `failed` | Error verificable; no vender como mint exitoso |
| `revoked` | Certificado marcado como revocado si el contrato/modelo lo permite |

## Controles enterprise

- Separar owner, minter y operator.
- No usar wallet personal como minter.
- No exponer private keys en frontend ni variables `NEXT_PUBLIC_*`.
- Aplicar allowlist por tenant, lote y batch.
- Rate limit por tenant y por producto.
- Registrar auditoria interna para cada solicitud.
- Monitorear gas, nonce, RPC, tasa de error y confirmaciones.
- No hacer fallback silencioso a modo simulado cuando `TOKENIZATION_MODE=polygon`.

## Relacion con IOTA

Polygon responde: **quien tiene el certificado, claim o garantia digital transferible**.

IOTA responde: **que hash, Merkle root o checkpoint fue anclado para auditoria**.

Un producto puede tener Polygon sin IOTA. Un tenant puede usar IOTA para pruebas de logistica sin tokenizar propiedad. En enterprise, ambas capas se activan por politica y no por promesa generica de "todo en blockchain".
