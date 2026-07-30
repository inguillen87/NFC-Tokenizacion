# Ceremonia física NFC y evidence pack sanitizado

## Estado honesto

La API de Supplier QA ya deriva evidencia SUN/SDM desde diagnósticos y eventos
canónicos, exige pares anti-replay y, para `ntag424_dna_tt`, una transición
electrónica cerrada-abierta. Ese receipt conserva correctamente
`physical_ceremony_verified=false`: una respuesta CMAC válida y un TTStatus
decodificado no prueban por sí solos qué objeto fue fotografiado, quién lo
manipuló, cómo se instaló el inlay ni si el envase real funcionará en línea.

El validador local
[`validate-physical-nfc-evidence-pack.mjs`](../../../apps/api/scripts/validate-physical-nfc-evidence-pack.mjs)
prepara evidencia sanitizada para revisión humana. Comprueba integridad y
consistencia; nunca emite certificación física, aceptación productiva, KMS
gestionado ni HSM.

El contrato `v1` es cerrado: claves JSON duplicadas, propiedades desconocidas,
aliases camelCase de campos sensibles y tipos implícitamente convertibles se
rechazan. El digest del pack enlaza los bytes exactos de `evidence-pack.json` y
los digests calculados de cada artefacto; no se calcula solamente sobre el
objeto JSON ya parseado.

## Dos alcances diferentes

- `loose_tag_sample`: sirve para inventariar y probar las muestras NTAG 424 DNA
  o TT sueltas. Puede demostrar que el paquete está íntegro y que contiene
  receipts electrónicos con la secuencia esperada. No evalúa adhesivo, RF sobre
  producto, sellado, packaging ni línea industrial.
- `package_integration`: exige contexto del envase real lleno, sustrato,
  posición y método de aplicación. Aun completo, queda sólo
  `eligible_for_manual_review`; las aprobaciones industriales independientes de
  RF, adhesivo, artwork, línea y placement TT siguen gobernadas por Supplier
  Packaging Governance.

Ninguno de los dos alcances es un plan AQL ni acepta un lote productivo.

## Ceremonia con teléfono y tags

Para cada muestra declarada en el manifest sanitizado:

1. Asignar un `sample_ref` opaco. El UID crudo permanece en el backend; el pack
   usa únicamente `uid_fingerprint` batch-scoped. El exportador autenticado debe
   producir ese fingerprint mediante el esquema de seudonimización aprobado;
   el CLI offline sólo comprueba formato y consistencia cruzada, no puede probar
   por sí solo cómo fue derivado. Cada `sample_ref` debe tener un fingerprint
   distinto: repetir una misma huella para inflar la cohorte bloquea el pack.
2. Fotografiar la muestra intacta sin personas, documentos, patentes, pantallas
   con URLs SUN ni otra PII. Exportar la foto sin EXIF/XMP/text chunks.
3. Hacer un tap real contra `/sun`. Conservar un receipt sanitizado generado
   desde la evidencia canónica del servidor, no una declaración manual ni el
   URL con `picc_data`, `enc` o `cmac`.
4. Reenviar exactamente la lectura ya consumida mediante la herramienta QA y
   conservar el receipt `replay_suspect`. No guardar ni copiar el URL SUN crudo
   dentro del evidence pack.
5. Para cada NTAG 424 DNA TT, todos los samples de la cohorte necesitan estado
   electrónico cerrado. Además, seleccionar al menos una muestra sacrificial,
   fotografiarla intacta, cortar/abrir físicamente el loop, fotografiar el
   resultado y obtener una lectura posterior `opened`/`valid_opened` con counter
   mayor. La secuencia exigida es estrictamente `intact < replay < opened`, tanto
   para receipts como para las fotos físicas relacionadas. Esa muestra debe
   quedar revocada en el backend.
   `opened`/`valid_opened` se rechaza para `ntag424_dna` sin TagTamper.
6. Un segundo operador debe comparar físicamente `sample_ref`, fotos, objeto y
   contexto. El CLI no autentica al operador ni reemplaza esa revisión.

Para agroquímicos o semillas, repetir `package_integration` sobre el bidón lleno,
tapa/cierre real o bolsón lleno. Una muestra sobre escritorio no permite aprobar
detuning por líquido, adhesión, abrasión, pliegues, stacking ni compatibilidad
con la etiquetadora.

`tagtamper_bridges_opening` sólo pertenece a `ntag424_dna_tt`; declararlo para
un carrier `ntag424_dna` sin TT bloquea el pack por inconsistencia física.

## Estructura local

```text
evidence-pack/
  evidence-pack.json
  manifest/manifest-sanitized.json
  receipts/sample-01-intact.json
  receipts/sample-01-replay.json
  receipts/sample-01-opened.json       # TT sacrificial
  photos/sample-01-intact.png
  photos/sample-01-opened.png          # TT sacrificial
```

`evidence-pack.json` referencia cada archivo por path relativo y digest
`sha256:`. Los paths absolutos, `..`, backslashes, symlinks, archivos no
declarados y archivos declarados pero ausentes se rechazan. El recorrido tiene
límites de profundidad, entradas, archivos y bytes. Cada archivo se abre una
sola vez y se comprueba por identidad `lstat`/`fstat`/`realpath` antes y después
de leerlo para detectar sustituciones dentro de un directorio mutable.
El CLI no bloquea el directorio después de terminar: para archivar o transferir
la evidencia hay que conservar exactamente los bytes validados y volver a
comparar `evidence_pack_digest`, no releer más tarde paths mutables como si
fueran el mismo snapshot.

`ceremony.performed_at` es el timestamp de finalización. Receipts y fotos deben
pertenecer a la ventana de las 24 horas anteriores (con cinco minutos de
tolerancia de reloj) y la finalización no puede estar en el futuro. Para una
ceremonia que dure más, cerrar packs separados; no ampliar retrospectivamente
la ventana de un pack ya emitido.

Contrato mínimo del pack:

```json
{
  "schema_version": "nexid-physical-nfc-evidence-pack/v1",
  "evidence_class": "sanitized_physical_review_candidate",
  "ceremony": {
    "ceremony_id": "nexid-samples-2026-01",
    "ceremony_scope": "loose_tag_sample",
    "performed_at": "2026-07-30T12:05:00.000Z",
    "operator_ref": "sha256:<64 hex>",
    "site_ref": "sha256:<64 hex>"
  },
  "scope": {
    "batch_ref": "SAMPLES-2026-01",
    "carrier_profile_code": "ntag424_dna_tt",
    "expected_sample_count": 10
  },
  "physical_context": {},
  "artifacts": [
    {
      "path": "manifest/manifest-sanitized.json",
      "kind": "sanitized_manifest",
      "media_type": "application/json",
      "sha256": "sha256:<64 hex>"
    },
    {
      "path": "photos/sample-01-intact.png",
      "kind": "physical_photo",
      "media_type": "image/png",
      "metadata_sanitized": true,
      "sample_ref": "sample-01",
      "observation": "intact",
      "captured_at": "2026-07-30T12:00:00.000Z",
      "sha256": "sha256:<64 hex>"
    }
  ],
  "samples": [
    {
      "sample_ref": "sample-01",
      "uid_fingerprint": "sha256:<64 hex>",
      "sacrificial": true,
      "observations": [
        {
          "observation": "intact",
          "receipt_artifact": "receipts/sample-01-intact.json",
          "photo_artifact": "photos/sample-01-intact.png"
        },
        {
          "observation": "replay",
          "receipt_artifact": "receipts/sample-01-replay.json"
        },
        {
          "observation": "opened",
          "receipt_artifact": "receipts/sample-01-opened.json",
          "photo_artifact": "photos/sample-01-opened.png"
        }
      ]
    }
  ],
  "claims": {
    "physical_ceremony_verified": false,
    "physical_tag_certification": false,
    "tagtamper_physical_certification": false,
    "production_lot_accepted": false,
    "managed_kms": false,
    "hsm_backed": false
  }
}
```

El manifest sanitizado usa
`schema_version=nexid-sanitized-nfc-manifest/v1`, el mismo `batch_ref` y una
lista de `{sample_ref, uid_fingerprint}`. Un receipt usa
`schema_version=nexid-sanitized-sun-receipt/v1` y debe contener el mismo scope,
observation, counter, timestamp, `server_evidence_digest`,
`canonical_event_ref`, `server_evidence_verified=true`,
`raw_sun_values_included=false` y `physical_ceremony_verified=false`.

Las imágenes JPEG, PNG y WebP se decodifican completamente con límites de
dimensiones/píxeles. Se rechazan codecs truncados, CRC PNG inválidos, animación,
EXIF, XMP, IPTC, ICC, comentarios/text chunks, chunks no admitidos y patrones
reconocibles de UID, URL SUN, claves o tokens en los bytes del archivo. Esto no
es OCR, análisis de la escena ni detección de esteganografía: una persona debe
seguir comprobando que los píxeles no muestran pantallas, documentos, rostros,
patentes, UIDs ni URLs. Re-encodear sin metadata reduce riesgo, pero no convierte
una foto en certificación independiente.

## Ejecución

Desde la raíz del repositorio:

```powershell
npm.cmd run supplier:physical-evidence:validate -- --pack="C:\ruta\evidence-pack" --pretty
```

Un resultado correcto dice `eligible_for_manual_review` y mantiene siempre:

```json
{
  "manual_identity_and_custody_review_required": true,
  "physical_ceremony_verified": false,
  "physical_tag_certification": false,
  "production_lot_accepted": false,
  "managed_kms": false,
  "hsm_backed": false
}
```

El CLI no se conecta a base de datos, Vercel, Google Cloud, Polygon, IOTA ni al
backend SUN. Tampoco firma ni publica el pack. El exportador autenticado de
receipts sanitizados y la revisión humana de las muestras físicas siguen siendo
trabajo necesario antes de completar una ceremonia real. El warning
`server_receipt_authorship_not_independently_verified` permanece deliberadamente:
estructura, hashes y consistencia local no sustituyen firma de autor, consulta al
backend, cadena de custodia, revisión visual ni evidencia del objeto físico.
