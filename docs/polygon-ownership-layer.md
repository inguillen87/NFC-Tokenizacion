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
- Guardar payload SUN, CMAC, claves de encoding o secretos KMS.
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

Los Merkle roots y checkpoints agregados pertenecen por defecto a la capa IOTA proof/audit, no al contrato Polygon de propiedad digital.

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

## Demo publica buyer-controlled en Amoy

La demostracion publica de nexID cierra el recorrido completo sin presentar una wallet de prueba como un cliente real:

1. nexID emite un NXDT con metadata HTTPS sanitizada.
2. Una transaccion `Transfer` mueve el token desde la wallet piloto de plataforma a una wallet demo compradora aislada.
3. `ownerOf(tokenId)` debe devolver esa wallet receptora.
4. La wallet receptora firma un mensaje EIP-191 ligado a `chainId`, contrato, token, owner y URL canonica del certificado.
5. La API acepta `buyer_controlled` solo si recibo, evento `Transfer`, `ownerOf` y signer recuperado coinciden.

Superficies publicas:

- Certificado legible: `https://nexid.lat/proof/ownership`
- Evidencia JSON: `https://api.nexid.lat/public/polygon/ownership`
- Catalogo combinado Polygon/IOTA: `https://api.nexid.lat/public/proof/demo-cases`
- Verificador operativo: `npm run polygon:verify-proof-demo --workspace=api`

La firma que aparece en el certificado es una declaracion publica e informativa. El mensaje dice expresamente que no autoriza login, compra ni transferencia. Para una operacion real, el portal usa un challenge efimero, de un solo uso y con expiracion; una firma estatica nunca debe reutilizarse como sesion o autorizacion.

La clave privada de la wallet demo vive solo en `apps/api/.env.local`, archivo ignorado por Git. Vercel recibe unicamente direccion publica, firma y hash de la transferencia. El fixture esta en Polygon Amoy, no representa identidad de comprador, propiedad legal ni readiness automatico para mainnet.

### Integridad de metadata publica

La metadata del fixture usa una URL HTTPS para compatibilidad con wallets y explorers. El certificado y el verificador independiente validan en cada lectura:

- `schema_version = nexid-ownership-certificate-v3`.
- `environment = testnet`.
- `chain_id = 80002`.
- El mismo contrato que devuelve el token on-chain.
- URL externa, imagen y limites de prueba esperados por nexID.

Esto detecta metadata equivocada, degradada o servida para otra red/contrato. No convierte HTTPS en almacenamiento inmutable ni content-addressed; una evolucion productiva debe versionar y fijar el contenido con un digest o URI content-addressed cuando el caso contractual lo requiera.

### Como lo explica un equipo comercial

- **Hecho probado:** el NFT salio de la wallet de nexID y la red indica otra wallet como owner actual.
- **Control probado:** una firma publica recupera exactamente la wallet que `ownerOf` devuelve.
- **Privacidad preservada:** identidad, factura, garantia, UID NFC y datos CRM no aparecen en Polygon.
- **Limite honesto:** el NFT no autentica por si solo el objeto fisico; esa decision depende del tap NFC/QR y la policy nexID anterior al claim.
- **Paso a produccion:** reemplazar wallets demo por onboarding de comprador, challenge de un solo uso, policy tenant, custodia/KMS y condiciones legales del cliente.

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
