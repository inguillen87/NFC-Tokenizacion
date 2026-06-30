# Commercial Trust Layer copy guide

Esta guia define lenguaje aprobado para explicar las capas de confianza de nexID en superficies comerciales, propuestas enterprise y documentacion publica. Complementa `docs/blockchain-architecture.md`, `docs/polygon-ownership-layer.md`, `docs/iota-proof-audit-layer.md` y `docs/enterprise-trust-faq.md`.

## Posicionamiento base

nexID valida productos fisicos con NFC/QR, registra eventos DPP en su backend y usa capas publicas solo cuando agregan valor verificable.

- Polygon: propiedad digital, certificados, NFT, claims y transferencias controladas.
- IOTA: capa probatoria opcional para hashes, Merkle roots, auditoria, DPP y evidencia logistica.
- Backend nexID: fuente operativa de verdad para SUN/SDM, replay, tamper, tenant, batch, CRM, analytics y politicas.

La frase corta:

> nexID separa autenticidad fisica, DPP privado, propiedad digital en Polygon y proof IOTA opcional.

## Copy aprobado

- "Polygon se usa para propiedad digital, certificados, claims y transferencias cuando la politica del tenant lo habilita."
- "IOTA puede activarse como proof layer opcional para hashes, Merkle roots, DPP y evidencia logistica."
- "Los datos sensibles permanecen off-chain; la red publica recibe metadata sanitizada, referencias derivadas o digests."
- "No escribimos cada tap en blockchain. Los taps se registran en nexID y solo eventos seleccionados se tokenizan o anclan."
- "Tenant Vault muestra evidencia operativa, manifest, QA y hashes sin exponer secretos internos."
- "Supplier Encoding Pack entrega claves de encoding solo para el sub-batch autorizado y por canal cifrado; la fabrica no recibe KMS, database URLs ni private keys."
- "Offline Verifier permite app o lector controlado para campo sin señal, con claves derivadas por dispositivo y veredicto final al sincronizar."

## Copy a evitar

- "Partner oficial de Polygon/IOTA" salvo que exista acuerdo publico verificable.
- "Zero fees", "sin costo de red" o "proof gratis garantizado".
- "Cada tap queda on-chain."
- "La blockchain contiene toda la trazabilidad."
- "El NFT reemplaza automaticamente la propiedad legal."
- "IOTA emite NFTs o reemplaza la propiedad digital en Polygon."
- "El proveedor recibe acceso KMS."
- "Wallet, certificado o claim habilitados sin tap fresco ni policy."
- "La app consumer contiene la master key."
- "Usamos la misma master key para todos los tags para que nunca falle."
- "Cualquier navegador autentica 100% offline."

## Matriz de claims

| Claim visible | Estado correcto |
| --- | --- |
| Producto autentico | Requiere validacion SUN/SDM o regla QR equivalente |
| Producto reclamable | Requiere tap fresco, policy y controles de riesgo |
| Certificado Polygon | Requiere solicitud, tx_hash real y estado confirmado o pendiente explicito |
| Proof IOTA | Requiere digest/root anclado o estado pendiente/fallido explicito |
| Evidencia DPP | Puede vivir solo en backend si el tenant no requiere proof publico |
| Datos logisticos | Publicar solo hashes/checkpoints; rutas completas quedan privadas |
| Veredicto offline | Local y provisional salvo app/lector controlado con claves derivadas; backend finaliza replay y policy al sincronizar |

## Frases por audiencia

### Marca enterprise

"La marca conserva la fuente de verdad en nexID: validacion fisica, eventos DPP, CRM y auditoria. Polygon agrega certificados y propiedad digital cuando hay claim. IOTA puede agregar prueba externa de hashes o Merkle roots para auditoria y logistica."

### Proveedor/fabrica

"El proveedor codifica tags con un paquete acotado al sub-batch. Recibe claves de encoding de ese alcance, route template redacted en documentacion publica y formato de manifest. No recibe KMS, base de datos, private keys, tokens admin ni PII."

### Operador offline

"El operador puede usar una app o lector controlado para validar en campo cuando no hay señal. La lectura local usa claves derivadas por device/batch y queda en cola cifrada; nexID sincroniza y confirma replay, policy, auditoria, garantia u ownership cuando vuelve la conectividad."

### Consumidor final

"El consumidor ve autenticidad, origen, garantia, beneficios y, si aplica, certificado digital. No necesita entender blockchain ni publicar datos personales en redes publicas."

### Auditor/compliance

"El auditor puede verificar un digest o Merkle root contra el evento DPP autorizado sin exponer PII, UID crudo, manifest completo ni datos comerciales sensibles."

## Regla de degradacion

- Si IOTA no esta habilitado, SUN, DPP, dashboard y Polygon pueden seguir funcionando.
- Si Polygon o el RPC fallan, el claim queda pendiente o fallido; no se muestra mint exitoso sin evidencia real.
- Si SUN/SDM no valida, no se habilita claim ni certificado confiable aunque una red publica este disponible.
