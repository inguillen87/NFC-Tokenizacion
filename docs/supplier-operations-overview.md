# Operaciones con proveedores y lotes NFC

Este documento resume el flujo operacional para proveedores que codifican tags NFC nexID y para equipos internos que reciben, activan y auditan lotes.

Para detalles criptograficos de claves y manifest, ver `docs/nexid-key-lifecycle.md`. Para el contrato de entrega a fabrica y Tenant Vault, ver `docs/supplier-encoding-pack-tenant-vault.md`.

## Objetivo

Que cada lote fisico tenga:

- Tenant y batch creados antes de codificar.
- Claves controladas por sub-batch.
- Paquete de encoding claro para proveedor, limitado al sub-batch autorizado.
- Manifest recibido y validado.
- Pruebas de calidad antes de venta.
- Eventos DPP registrados.
- Proof IOTA opcional solo para evidencia seleccionada.

## Responsabilidades

| Responsable | Responsabilidad |
| --- | --- |
| nexID ops | Crear tenant, batch, politica y paquete de encoding |
| nexID security | Generar claves de sub-batch y protegerlas mediante AES-256-GCM envelope ligado a tenant, BID, rol y versión. La API NFC piloto usa una KEK versionada como secreto de despliegue; no es KMS gestionado ni HSM. El executor blockchain soporta por separado el modo piloto `kms_wrapped` con Google Cloud KMS SOFTWARE, que sólo puede declararse activo para un entorno con readiness y receipt fresco |
| Proveedor | Codificar tags segun especificacion y devolver manifest |
| Tenant | Aprobar producto, arte, volumen y politica comercial |
| QA | Validar evidencia SUN/SDM derivada por servidor, UIDs del manifest, pares anti-replay y, para TagTamper, una transición electrónica cerrada-abierta. La instalación, adhesión y apertura física del packaging se atestan por separado; el receipt QA actual registra `physical_ceremony_verified=false` |
| Compliance | Definir si se requiere proof IOTA o reportes privados |

## Flujo operacional

1. Crear tenant y batch.
2. Definir chip model, por ejemplo `NTAG 424 DNA TagTamper`.
3. Dividir el pedido en sub-batches cuando aplique por SKU, rollo, carton, region, artwork o ventana QA.
4. Generar o registrar claves de encoding por sub-batch.
5. Guardar claves cifradas en backend; nunca en frontend.
6. Exportar paquete de encoding para proveedor.
7. Proveedor codifica tags y devuelve manifest.
8. Importar manifest en nexID.
9. Para un trial, ejecutar QA de integración sobre diez tags o sobre el total cuando el pack tenga menos de diez.
10. Aprobar o rechazar el alcance evaluado y conservar el receipt inmutable.
11. Activar el lote piloto sólo después de una aprobación QA aplicable a ese mismo manifest y configuración.
12. Registrar eventos DPP relevantes.
13. Anclar en IOTA solo si la politica enterprise lo requiere.

La ceremonia fija de diez tags demuestra integración SUN/SDM, anti-replay y TagTamper del pack de prueba. No constituye aceptación estadística de un lote productivo. El runtime actual implementa un `pack_purpose` inmutable y trata `trial_integration` como `NON_SELLABLE`, pero todavía no implementa el estado de fabricación completo, una sesión QA server-owned ni un plan AQL aprobado por el tenant. Por eso, una aprobación actual debe tratarse sólo como `trial_integration_only`; no habilita una afirmación de aceptación productiva.

Antes de habilitar producción, calidad del tenant debe aprobar lote, nivel de inspección, AQL, tamaño de muestra, límites accept/reject y selección server-side estratificada por rollo, cartón o pallet. El endpoint de activación actual comprueba manifest, cantidad y `qa_status`, y aplica el gate de propósito antes de cualquier override: un trial, un lote sin clasificar o un lote productivo sin la estrategia QA v2 no puede activarse mediante break-glass. Todavía no enlaza un receipt de aceptación productiva ni un estado de fabricación versionado. Esa ampliación permanece como control P0, no como capacidad desplegada.

En el camino normal, la activación exige manifest importado con cantidad exacta y `qa_status=passed`, además de un propósito comercial elegible. El override break-glass disponible para superadmin o `supplier:activate_override` exige motivo y auditoría, pero no puede convertir un trial `NON_SELLABLE` ni una integración QA fija en aprobación productiva o AQL.

## Paquete de encoding

El proveedor solo debe recibir lo necesario para programar el sub-batch autorizado. En copy externo usar "claves de encoding por sub-batch"; los nombres internos y valores reales viajan solo dentro del paquete cifrado.

Puede incluir:

```json
{
  "order_id": "SUP-2026-00041",
  "batch_id": "NXD2606-A01",
  "sub_batch_id": "NXD2606-A01-R001",
  "bid": "NXD2606-A01-R001",
  "chip_model": "NTAG 424 DNA TagTamper",
  "encoding_keys": "<REDACTED_SECURE_CHANNEL>",
  "url_template": "<VALIDATION_URL_TEMPLATE_REDACTED>",
  "manifest_format": "sub_batch_id,bid,uid_hex,ic_type,roll_id,qc_status,timestamp"
}
```

Nunca debe incluir:

- Master keys.
- Database URLs.
- Private keys de Polygon.
- Secretos de executor.
- Tokens de Vercel, base de datos o admin.
- Credenciales internas.
- PII de consumidores.

## Manifest del proveedor

Formato minimo recomendado:

```csv
sub_batch_id,bid,uid_hex,ic_type,roll_id,qc_status,timestamp
NXD2606-A01-R001,NXD2606-A01-R001,04AABBCCDDEEFF,NTAG424DNA_TT,R001,PASS,2026-06-27T00:00:00Z
```

El manifest es stock y allowlist. No es prueba de autenticidad por si solo. Cada tap permite validar el mensaje SUN/SDM contra las claves y reglas del lote; esa validacion no certifica por si sola contenido, origen, condicion ni custodia fisica.

## Tenant Vault

Tenant Vault es la superficie de evidencia visible para tenant y operaciones. Debe mostrar estado de orden, sub-batches, fingerprint del pack exportado, importacion de manifest, hashes, reportes QA, ZIP/PDF/JSON y eventos DPP autorizados.

Tenant Vault no es una pantalla de secretos. No debe exponer claves de encoding, master keys, database URLs, private keys, tokens admin ni paths internos de storage. Si se necesita prueba externa, publicar o anclar solo hash, digest, proof envelope o Merkle root sanitizado.

## Checklist de recepcion

1. Confirmar cantidad recibida contra orden de compra.
2. Importar manifest y verificar formato.
3. Escanear muestra intacta y esperar UID decodificado.
4. Reusar la misma URL y esperar `REPLAY_SUSPECT`.
5. Probar muestra TagTamper si aplica y esperar estado abierto.
6. Confirmar que no hay UIDs fuera de manifest.
7. Confirmar que el lote pertenece al tenant correcto.
8. Confirmar que el batch no duplica `bid`.
9. Registrar resultado QA como evento DPP.
10. Activar lote solo despues de aprobar QA.

## DPP y proof layer

Eventos operativos que conviene registrar internamente:

- `supplier_batch_created`.
- `supplier_pack_exported`.
- `supplier_manifest_received`.
- `quality_check_completed`.
- `sun_cryptographic_verification`.
- `packaging_physical_test_attested`.
- `batch_activated`.
- `tamper_observed`.

Los nombres `sun_cryptographic_verification` y `packaging_physical_test_attested` son el contrato DPP objetivo. El runtime actual conserva nombres históricos como `TAP_VALID`, `TAP_INVALID`, `REPLAY_SUSPECT`, `qa_passed` y `qa_failed`; no debe afirmarse que los eventos objetivo ya fueron migrados hasta que exista migración, backfill y compatibilidad de consumidores.

Eventos que pueden anclarse en IOTA si el tenant lo pide:

- Hash del manifest sanitizado.
- Merkle root de manifest o QA sanitizado.
- Checkpoint de recepcion del lote.
- Digest de QA aprobado.
- Handoff logistico critico.

No anclar en IOTA:

- Manifest completo con UIDs.
- Datos de proveedor no publicos.
- Facturas, precios o condiciones comerciales.
- Cada tap de consumidor.

## Relacion con Polygon

La operacion con proveedores no dispara automaticamente mints en Polygon. Polygon se usa mas adelante cuando hay ownership, claim o certificado aplicable.

Un lote puede estar operativo sin Polygon si solo se requiere autenticacion DPP. Un lote puede tener Polygon habilitado para claims sin usar IOTA. Un lote puede usar IOTA para auditoria logistica sin emitir NFT.

## Criterio de listo

Un lote piloto esta listo para uso controlado cuando:

- El batch existe y esta asociado al tenant correcto.
- Las claves estan cifradas en backend.
- El proveedor recibio solo el paquete autorizado.
- El manifest fue importado y validado.
- La verificación SUN criptográfica pasó para la muestra y el contexto de configuración registrados.
- La prueba física de packaging fue aprobada y atestada por separado cuando el producto o el perfil TagTamper la requiere.
- Replay fue bloqueado.
- El alcance QA corresponde al uso real: integración trial o plan de aceptación productiva aprobado por calidad del tenant.
- La politica de Polygon/IOTA esta documentada para el tenant.
- No hay secretos ni PII en archivos compartidos con proveedor.

Un lote productivo no cumple este criterio todavía: requiere el plan de aceptación y el enlace transaccional con fabricación descritos arriba.
