# FAQ enterprise de confianza: Enterprise Trust Layer, Polygon e IOTA

Este FAQ alinea el discurso comercial y tecnico de nexID para clientes enterprise. Debe usarse cuando se explica autenticidad NFC, Enterprise Trust Layer, ownership en Polygon, proof layer IOTA, privacidad y auditoria.

## Respuesta corta

nexID valida productos fisicos con NFC criptografico y registra eventos DPP en su backend. El Enterprise Trust Layer es la combinacion de fuente de verdad privada, politicas de tenant y capas publicas opcionales. Polygon se usa para propiedad digital, NFT, certificados, claims y transferencias de garantia/titularidad. IOTA puede usarse como capa opcional para hashes, Merkle roots, auditoria, DPP y logistica. Los datos sensibles no se publican on-chain y no todos los taps se escriben en blockchain.

## Mapa de capas

| Capa | Rol | Que puede publicar | Que no debe publicar |
| --- | --- | --- | --- |
| Backend nexID + DPP | Fuente de verdad operacional: valida SUN, replay, tamper, tenant, batch y policy | Estados resumidos, certificados visibles y auditoria autorizada | PII abierta, secretos, UID crudo o eventos internos completos |
| Polygon ownership layer | Certificados NFT, claims, warranty transfer y titularidad digital controlada | `tx_hash`, `token_id`, contrato, red, `token_uri` sanitizado, `asset_ref` publico | Todos los taps, manifest completo, rutas logisticas, datos comerciales o PII |
| IOTA proof layer opcional | Prueba externa para auditoria, DPP, logistica y compliance | Hashes, Merkle roots, checkpoints, proof envelopes minimizados | Ownership/NFT, PII, UID crudo, payload SUN completo o contratos comerciales |

## Preguntas frecuentes

### Cada tap va a blockchain?

No. Cada tap relevante se registra en nexID para auditoria, antifraude y analytics. Solo algunos eventos se tokenizan o anclan segun politica del tenant. Cuando hay alto volumen o auditoria periodica, la estrategia correcta es usar hashes y Merkle roots/checkpoints, no una transaccion por tap.

Ejemplos de eventos que pueden ir on-chain:

- Claim de producto.
- Mint de certificado NFT.
- Transferencia de garantia/titularidad digital.
- Checkpoint de lote.
- Handoff logistico critico.
- Digest o Merkle root de auditoria.

Un tap comun, un refresh de pagina o un replay no deben generar automaticamente una transaccion on-chain.

### Que rol cumple Polygon?

Polygon es la capa de ownership. Se usa para emitir o registrar certificados, NFTs, claims, warranty transfer y transferencias controladas.

La pregunta que responde Polygon es: "quien tiene o reclamo el certificado digital de este producto?".

### Que rol cumple IOTA?

IOTA es una capa opcional de prueba y auditoria. Se usa para anclar hashes, Merkle roots o checkpoints de eventos DPP, manifest, logistica o calidad.

La pregunta que responde IOTA es: "esta evidencia existia y no fue modificada desde cierto momento?".

### IOTA reemplaza a Polygon?

No. IOTA no reemplaza ownership/NFT/claim. Si el caso de uso es propiedad digital o certificado transferible, la capa sigue siendo Polygon. Si el caso de uso es evidencia, auditoria o logistica, IOTA puede complementar.

### Se puede desactivar IOTA?

Si. IOTA debe ser una capacidad configurable. Si esta apagado, nexID sigue validando NFC, mostrando DPP, registrando eventos y operando Polygon ownership si esta habilitado.

### Que datos se publican on-chain?

Solo datos publicos, minimizados o hashes:

- `tx_hash`, `token_id`, contrato y red.
- `asset_ref` publico.
- `token_uri` con metadata sanitizada.
- Hashes, digests o Merkle roots de eventos seleccionados.
- Referencias publicas de lote/producto si el tenant lo aprueba.

### Que datos nunca se publican on-chain?

- PII de consumidores.
- Emails, telefonos, documentos, direcciones o perfiles de compra.
- UID crudo de chips.
- `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX` o private keys.
- Payload SUN completo.
- Manifest completo de UIDs.
- Contratos comerciales, precios, margenes, facturas o rutas logisticas completas.

### Tiene costo operativo?

No debe venderse asi. Puede haber redes testnet sin valor real para piloto, pero produccion depende de gas, RPC, proveedor, volumen, custodia, monitoreo y operacion. El modelo correcto es optimizar que solo los eventos con valor probatorio o de propiedad generen transacciones.

### Que significa usar hashes o Merkle roots?

Significa que nexID conserva el evento completo off-chain y publica solo una huella criptografica verificable. Para un evento seleccionado se puede publicar un `event_digest`. Para muchos eventos, se calcula un Merkle root: el auditor puede verificar que un evento autorizado pertenece al conjunto sin publicar todo el lote, todos los taps ni datos sensibles.

### Existe una alianza formal con Polygon o IOTA?

No se debe afirmar eso salvo que exista un acuerdo publico y verificable. La documentacion debe decir que nexID integra o puede integrar esas redes como capas tecnicas.

### Un NFT prueba propiedad legal del producto?

No automaticamente. Un NFT o certificado digital puede probar un claim digital dentro del sistema nexID y aportar trazabilidad verificable. La propiedad legal depende de factura, terminos del tenant, jurisdiccion y reglas comerciales.

### Que pasa si Polygon esta caido o el RPC falla?

nexID puede dejar la solicitud en estado pendiente y reintentar. No debe mostrar un mint como exitoso si no existe `tx_hash` real o confirmacion suficiente.

### Que pasa si IOTA falla?

La validacion NFC, DPP, dashboard y Polygon no deben caerse. El evento puede quedar con proof pendiente o fallido. La ausencia de proof IOTA no invalida automaticamente la autenticidad SUN ni el ownership Polygon.

### El consumidor necesita wallet?

Depende de la politica del tenant. nexID puede operar con wallet del usuario, wallet custodial o recipient default para pilotos. En todos los casos, la explicacion al consumidor debe ser clara: que se esta reclamando, donde queda el certificado y que derechos otorga.

### Como se protege la privacidad?

La arquitectura separa datos internos de pruebas publicas. El backend valida y guarda la informacion necesaria bajo control de acceso. Las redes publicas reciben identificadores derivados, hashes o metadata sanitizada.

### Como se verifica una prueba enterprise?

Para Polygon, se revisa contrato, `token_id`, owner/recipient, `token_uri` y `tx_hash`.

Para IOTA, se solicita el evento autorizado, se canonicaliza, se calcula el digest y se compara contra el digest o Merkle root anclado.

En ambos casos, la verificacion no requiere exponer PII ni secretos criptograficos.

## Frases aprobadas

- "nexID usa Polygon para ownership digital y certificados tokenizados."
- "IOTA puede activarse como proof layer opcional para hashes, Merkle roots, evidencia DPP y logistica."
- "La fuente de verdad operacional vive en nexID; blockchain se usa para pruebas o propiedad cuando aporta valor."
- "No todos los taps van on-chain."
- "No publicamos PII ni datos crudos de negocio en redes publicas."
- "Enterprise Trust Layer separa autenticidad fisica, ownership digital y prueba externa de auditoria."

## Frases a evitar

- "Anclaje publico de cada tap."
- "Costo operativo cero de red, RPC o custodia."
- "Alianza formal" o "partner oficial" con una red sin respaldo publico.
- "El NFT reemplaza la factura o propiedad legal."
- "Toda la cadena logistica esta publicada on-chain."
- "La geolocalizacion exacta del consumidor queda en blockchain."
