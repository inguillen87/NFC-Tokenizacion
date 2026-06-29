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
| nexID security | Generar/guardar claves, controlar KMS y rotacion |
| Proveedor | Codificar tags segun especificacion y devolver manifest |
| Tenant | Aprobar producto, arte, volumen y politica comercial |
| QA | Validar muestras fisicas, replay, tamper y manifest |
| Compliance | Definir si se requiere proof IOTA o reportes privados |

## Flujo operacional

1. Crear tenant y batch.
2. Definir chip model, por ejemplo `NTAG 424 DNA TagTamper`.
3. Dividir el pedido en sub-batches cuando aplique por SKU, rollo, carton, region, artwork o ventana QA.
4. Generar o registrar `K_META` y `K_FILE` por sub-batch.
5. Guardar claves cifradas en backend; nunca en frontend.
6. Exportar paquete de encoding para proveedor.
7. Proveedor codifica tags y devuelve manifest.
8. Importar manifest en nexID.
9. Activar lote en estado controlado.
10. Probar muestras fisicas.
11. Aprobar lote para produccion o venta.
12. Registrar eventos DPP relevantes.
13. Anclar en IOTA solo si la politica enterprise lo requiere.

## Paquete de encoding

El proveedor solo debe recibir lo necesario para programar el sub-batch autorizado. En copy externo usar `K_META` y `K_FILE`; la fabrica no necesita conocer nombres internos de KMS, base de datos ni infraestructura.

Puede incluir:

```json
{
  "order_id": "SUP-2026-00041",
  "batch_id": "NXD2606-A01",
  "sub_batch_id": "NXD2606-A01-R001",
  "bid": "NXD2606-A01-R001",
  "chip_model": "NTAG 424 DNA TagTamper",
  "K_META": "<32_HEX_CHARS>",
  "K_FILE": "<32_HEX_CHARS>",
  "url_template": "https://api.nexid.lat/sun?v=1&bid=NXD2606-A01-R001&picc_data=<PICC_DATA_DYNAMIC>&enc=<ENC_DYNAMIC>&cmac=<CMAC_DYNAMIC>",
  "manifest_format": "sub_batch_id,bid,uid_hex,ic_type,roll_id,qc_status,timestamp"
}
```

Nunca debe incluir:

- `KMS_MASTER_KEY_HEX`.
- `DATABASE_URL`.
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

El manifest es stock y allowlist. No es prueba de autenticidad por si solo. La autenticidad se valida en cada tap con SUN/SDM y claves del lote.

## Tenant Vault

Tenant Vault es la superficie de evidencia visible para tenant y operaciones. Debe mostrar estado de orden, sub-batches, fingerprint del pack exportado, importacion de manifest, hashes, reportes QA, ZIP/PDF/JSON y eventos DPP autorizados.

Tenant Vault no es una pantalla de secretos. No debe exponer `K_META`, `K_FILE`, `KMS_MASTER_KEY_HEX`, `DATABASE_URL`, private keys, tokens admin ni paths internos de storage. Si se necesita prueba externa, publicar o anclar solo hash, digest, proof envelope o Merkle root sanitizado.

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
- `batch_activated`.
- `quality_check_completed`.
- `physical_authentication`.
- `tamper_observed`.

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

Un lote esta listo para venta o piloto cuando:

- El batch existe y esta asociado al tenant correcto.
- Las claves estan cifradas en backend.
- El proveedor recibio solo el paquete autorizado.
- El manifest fue importado y validado.
- QA fisico paso con muestras intactas y tamper.
- Replay fue bloqueado.
- La politica de Polygon/IOTA esta documentada para el tenant.
- No hay secretos ni PII en archivos compartidos con proveedor.
