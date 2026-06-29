# IOTA proof and audit layer

IOTA es una capa opcional de pruebas dentro del Enterprise Trust Layer de nexID. Su uso recomendado es anclar evidencia verificable de DPP, auditoria y logistica mediante hashes, Merkle roots y checkpoints sin publicar datos sensibles.

## Rol de IOTA en nexID

IOTA no es la capa de propiedad digital de nexID. No reemplaza a Polygon para NFT, certificados o claims. IOTA se usa cuando un cliente necesita demostrar que cierta evidencia existia en un momento dado y que no fue alterada despues.

Casos adecuados:

- Hash de un evento DPP canonico.
- Merkle root de un conjunto de eventos, por lote o por ventana temporal.
- Digest de manifest recibido del proveedor.
- Evidencia de handoff logistico.
- Checkpoint de control de calidad.
- Prueba de revocacion, disputa o inspeccion.

Casos no adecuados:

- Publicar todos los taps.
- Publicar PII.
- Publicar UID crudo.
- Publicar rutas logisticas completas o contratos comerciales.
- Publicar el manifest completo de UIDs.
- Vender IOTA como tecnologia sin costo operativo o como alianza formal si no existe soporte contractual verificable.

## Feature flag

IOTA debe poder deshabilitarse por tenant, ambiente o despliegue.

Ejemplo de contrato de configuracion:

```txt
IOTA_PROOF_ENABLED=false
IOTA_PROOF_MODE=disabled | selected_events | checkpoint
IOTA_PROOF_TENANT_ALLOWLIST=tenant_a,tenant_b
```

Si IOTA esta apagado:

- SUN sigue validando.
- DPP sigue registrando eventos.
- Polygon puede seguir tokenizando ownership.
- Dashboard debe mostrar `proof_not_enabled` o equivalente, no error operacional.

## Modelo de prueba

La cadena solo recibe un sobre de prueba minimizado. El evento completo queda off-chain.

```json
{
  "proof_version": "1.0",
  "network": "iota",
  "proof_type": "dpp_event_digest",
  "tenant_ref": "tenant_public_ref",
  "batch_ref": "batch_public_ref",
  "event_type": "logistics_handoff",
  "event_digest": "sha256:...",
  "merkle_root": null,
  "event_count": 1,
  "canonicalization": "nexid-dpp-v1",
  "created_at": "2026-06-27T00:00:00Z"
}
```

Campos internos que no deben ir al proof envelope:

- Nombre, email, telefono o documento del consumidor.
- UID crudo.
- Payload SUN completo.
- CMAC/ENC/PICC completos como dato operativo.
- Direccion completa de entrega.
- Precio, factura, margen o contrato.
- Observaciones internas no publicas.

## Checkpoints vs eventos individuales

Para enterprise, la estrategia recomendada es checkpoint por lote o ventana temporal, no anclaje de cada tap.

Si hay muchos taps o eventos de bajo valor probatorio individual, nexID debe calcular hashes por evento, construir un Merkle tree y anclar solo el Merkle root. El auditor puede verificar inclusion de un evento autorizado sin revelar el resto del conjunto.

| Estrategia | Cuando usarla | Riesgo/costo |
| --- | --- | --- |
| Evento individual seleccionado | Claim, disputa, inspeccion, handoff critico | Mas granular, mas operaciones |
| Checkpoint por lote | Alta de batch, cierre de produccion, recepcion de manifest | Buen balance de costo y auditoria |
| Checkpoint periodico | Auditoria diaria/semanal/mensual | Menos granular, mas eficiente |
| Sin IOTA | Tenants que no requieren prueba publica adicional | Menor complejidad |

## Veracidad comercial

- IOTA no debe presentarse como partner oficial salvo que exista un acuerdo publico y verificable.
- IOTA no debe venderse como capa de costo operativo cero; aun si una red o testnet no cobra valor real, existen costos de integracion, RPC, monitoreo, custodia, soporte y operacion.
- IOTA no debe describirse como la capa de NFT, propiedad digital o warranty transfer de nexID. Ese rol corresponde a Polygon cuando la politica lo habilita.

## Verificacion de evidencia

Un auditor o cliente enterprise debe poder:

1. Solicitar el evento DPP interno autorizado.
2. Canonicalizarlo con la version documentada.
3. Calcular `event_digest`.
4. Comparar el digest con la prueba anclada en IOTA.
5. Confirmar timestamp/red/identificador de prueba.

La verificacion no requiere revelar PII ni datos comerciales crudos. Si el cliente necesita evidencia completa, se entrega por canal privado y bajo control de acceso.

## Relacion con DPP

IOTA puede fortalecer un DPP cuando el pasaporte necesita prueba externa de:

- Recepcion de lote.
- Control de calidad.
- Cambio de custodia.
- Certificacion de origen.
- Inspeccion o disputa.

El DPP visible al consumidor puede mostrar un estado resumido:

| Estado | Significado |
| --- | --- |
| `proof_not_enabled` | El tenant no usa IOTA para este producto |
| `proof_pending` | Hay evento elegible esperando anchor |
| `proof_anchored` | El digest fue anclado y verificado |
| `proof_failed` | Fallo tecnico o rechazo de policy; revisar auditoria |

## Operacion y fallas

- Un fallo de IOTA no debe bloquear validacion SUN ni experiencia basica del passport.
- No se debe inventar un `proof_id` si el anchor no ocurrio.
- Los reintentos deben ser idempotentes usando `event_id` y `event_digest`.
- Si cambia la canonicalizacion, versionar `canonicalization` y mantener compatibilidad para verificaciones antiguas.
- Si se detecta un error en un evento, no borrar la prueba anterior: registrar correccion, revocacion o evento compensatorio.
