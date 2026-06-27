# Modelo de eventos DPP

El Digital Product Passport de nexID se construye sobre eventos. Cada evento describe una accion verificable o auditable del ciclo de vida del producto, desde proveedor y activacion hasta tap, claim, auditoria y logistica.

## Objetivos del modelo

- Tener una fuente de verdad privada, consultable y auditable.
- Separar evento completo interno de metadata publica.
- Permitir Polygon para ownership/claim cuando corresponde.
- Permitir IOTA proof opcional para hashes o checkpoints.
- Evitar PII y datos crudos de negocio en cualquier cadena publica.

## Entidad canonica

Ejemplo conceptual de evento interno:

```json
{
  "event_id": "evt_01H...",
  "tenant_id": "ten_01H...",
  "batch_id": "NXD2606-A01",
  "product_ref": "prod_public_or_internal_ref",
  "event_type": "physical_authentication",
  "occurred_at": "2026-06-27T00:00:00Z",
  "actor_type": "consumer_device",
  "trust": {
    "sun_verdict": "VALID_CLOSED",
    "freshness": "fresh",
    "replay": false,
    "tamper": "closed",
    "risk_score": 0
  },
  "privacy": {
    "uid_storage": "internal_or_hashed",
    "pii_present": false,
    "public_safe": false
  },
  "anchors": {
    "polygon": null,
    "iota": null
  }
}
```

El formato exacto puede vivir en codigo o base de datos. Este documento fija el contrato conceptual: no todo evento interno es publico ni on-chain.

## Tipos de evento

| Tipo | Uso | Polygon | IOTA opcional |
| --- | --- | --- | --- |
| `supplier_batch_created` | Lote creado para proveedor | No | Hash de configuracion sanitizada |
| `supplier_manifest_received` | Manifest recibido y validado | No | Hash del manifest sanitizado |
| `batch_activated` | Lote habilitado para scans | No | Checkpoint de lote |
| `physical_authentication` | Tap SUN validado o rechazado | No por defecto | Solo checkpoint/agregado si aplica |
| `tamper_observed` | TagTamper abierto o invalido | No por defecto | Si requiere auditoria |
| `ownership_claim_requested` | Usuario inicia claim | Puede derivar en Polygon | Digest opcional |
| `ownership_claim_confirmed` | Claim aceptado | Si | Digest opcional |
| `polygon_token_minted` | NFT/certificado emitido | Si | Digest opcional del resultado |
| `logistics_handoff` | Cambio de custodia o etapa logistica | No | Si |
| `quality_check_completed` | Inspeccion o QC | No | Si |
| `dispute_opened` | Reclamo, falsificacion o conflicto | No directo | Si |
| `proof_anchor_created` | Registro de anchor IOTA | No | Si |

## Estados de confianza

### Autenticidad fisica

| Campo | Valores sugeridos |
| --- | --- |
| `sun_verdict` | `VALID_CLOSED`, `VALID_OPENED`, `VALID_UNKNOWN_TAMPER`, `REPLAY_SUSPECT`, `NOT_REGISTERED`, `INVALID`, `SUN_PROFILE_MISMATCH` |
| `freshness` | `fresh`, `snapshot`, `replay`, `unknown` |
| `tamper` | `closed`, `opened`, `opened_previously`, `invalid`, `unknown`, `not_supported` |

### Propiedad digital

| Campo | Valores sugeridos |
| --- | --- |
| `ownership_state` | `not_claimed`, `eligible`, `claim_pending`, `claimed`, `blocked_replay`, `disputed`, `revoked` |
| `polygon_state` | `not_requested`, `pending`, `minted`, `confirmed`, `failed`, `revoked` |

### Prueba de auditoria

| Campo | Valores sugeridos |
| --- | --- |
| `proof_state` | `not_enabled`, `not_required`, `eligible`, `pending`, `anchored`, `failed` |
| `proof_network` | `iota`, `none` |

## Evento publico vs evento interno

El evento interno puede contener datos que ayudan a operar la plataforma. El evento publico o proof envelope debe ser minimo.

| Dato | Evento interno | Publico / on-chain |
| --- | --- | --- |
| `event_id` | Si | Puede usarse ref derivada |
| `tenant_id` interno | Si | No; usar `tenant_ref` publico si aplica |
| UID crudo | Solo si es estrictamente necesario | Nunca |
| `chip_uid_hash` | Si | Si esta derivado y aprobado |
| PII consumidor | Si hay base legal y control de acceso | Nunca |
| Geolocalizacion precisa | Solo si hay permiso y necesidad | Nunca |
| Pais/region aproximada | Si | Solo si no reidentifica |
| Estado tamper | Si | Puede publicarse como estado resumido |
| Precio/factura/contrato | Backend privado | Nunca |

## Canonicalizacion para proof

Para anclar en IOTA se debe canonicalizar un subconjunto estable del evento. Ejemplo:

```json
{
  "canonicalization": "nexid-dpp-v1",
  "event_id": "evt_public_or_derived",
  "event_type": "logistics_handoff",
  "tenant_ref": "tenant_public_ref",
  "batch_ref": "NXD2606-A01",
  "product_ref": "public_asset_id",
  "occurred_at": "2026-06-27T00:00:00Z",
  "trust_summary": {
    "sun_verdict": "VALID_CLOSED",
    "tamper": "closed"
  }
}
```

Luego:

```txt
canonical_json -> sha256 -> event_digest -> IOTA proof envelope
```

Si el evento contiene datos no publicos, esos campos no entran al JSON canonico usado para on-chain.

## Reglas de negocio

- Un tap valido puede crear evento DPP, pero no necesariamente un NFT.
- Un tap replay puede crear evento de riesgo, pero no habilita claim.
- Un producto puede tener DPP sin Polygon si el tenant no vende propiedad digital.
- Un producto puede tener Polygon sin IOTA si no requiere proof layer adicional.
- Un producto puede tener IOTA proof sin Polygon si solo se audita logistica o calidad.
- Todo estado visible al cliente debe distinguir entre "registrado internamente", "minted en Polygon" y "proof anclado en IOTA".
