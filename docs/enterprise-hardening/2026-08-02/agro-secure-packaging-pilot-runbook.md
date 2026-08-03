# AGRO_SECURE_PACKAGING_PILOT — runbook operativo

Estado: contrato operativo reutilizable. No constituye evidencia de despliegue, migración de producción, validación física de etiquetas ni certificación HSM.

## 1. Objetivo y límites de verdad

El piloto demuestra una cadena auditable desde la construcción del packaging hasta la experiencia post-tap, sin lógica exclusiva de un cliente. Configuración inicial recomendada:

- un SKU y una región/canal;
- 5.000 unidades divididas en cinco sub-batches de 1.000;
- Packaging Lab obligatorio con preset `AGRO_SECURE_PACKAGING_PILOT`;
- GS1 Digital Link como fallback visible de identidad;
- `ntag424_dna` por defecto;
- `ntag424_dna_tt` solo cuando la cola conductiva cruza la apertura real y abrir obliga a romperla;
- un webhook firmado;
- fase de campo de 60 a 90 días.

Verdades que nunca se mezclan:

- GS1/QR identifica; no autentica criptográficamente el objeto físico.
- NTAG 424 DNA sin TT autentica el mensaje SUN/SDM; no produce estado de apertura.
- NTAG 424 DNA TT solo presenta cerrado/abierto con TTStatus canónico completo y construcción física aprobada.
- Polygon representa ownership/tokenización cuando una política autorizada lo solicita.
- IOTA es prueba de integridad opcional y por hitos; no se escribe por cada tap.
- El cifrado envelope actual protege secretos en aplicación, pero no es KMS administrado ni HSM.

## 2. Preflight de release

Antes de tocar un entorno compartido:

1. Confirmar que checkout y artefacto corresponden al mismo commit.
2. Ejecutar todas las migraciones en una base PostgreSQL descartable autorizada con el runner transaccional canónico.
3. Verificar que 0087, 0088, 0089, 0090, 0091, 0092, 0093, 0094, 0095 y 0096 están en `schema_migrations` y que sus capabilities/guards existen.
4. Resolver el ACL de Packaging Lab y el de 0091–0096 para el rol runtime real usando `packaging-lab-database-acl.md` y `enterprise-0091-0096-runtime-acl.md`; las migraciones revocan `PUBLIC` y no inventan un rol de producción. En particular, 0094 deja `nexid_persist_sun_scan_v1(jsonb)` como único entry point SUN otorgable, mantiene privadas sus bases internas, endurece el `search_path` y revoca `CREATE` público sobre el schema `public`. La 0095 conserva ese límite y exige que el insert del recibo TT use la PK nombrada exacta. La 0096 agrega catálogo RBAC, grants tenant-scoped, serialización durable de cambios de autoridad, dual control QA y riesgo determinista sin cambiar CMAC/SDM/TTStatus.
5. Reconciliar de forma auditada cualquier key row histórico asociado a un carrier no-SUN; después validar `batches_supplier_carrier_key_scope_v1`.
6. Ejecutar los gates de la sección 10.
7. Confirmar que repositorio, artefactos, logs y capturas no contienen secretos crudos.
8. Mantener producción cerrada si falta cualquiera de estos comprobantes.

Nunca usar `DATABASE_URL` de producción para QA destructiva. El validador de instalación completa exige `NEXID_DISPOSABLE_DATABASE_URL`, nombre `codex_qa_*`, endpoint Neon explícito y frase de confirmación. El validador de rol runtime reutiliza el mismo fail-closed con `NEXID_SUN_ATOMIC_QA_DATABASE_URL`, `NEXID_SUN_ATOMIC_QA_EXPECTED_HOST`, `NEXID_SUN_ATOMIC_QA_EXPECTED_ENDPOINT_ID` y `NEXID_SUN_ATOMIC_QA_CONFIRMATION`; tampoco acepta un destino de producción.

Orden de rollout compatible:

1. desplegar primero la aplicación rolling-safe;
2. aplicar 0090, 0091, 0092, 0093, 0094, 0095 y 0096 en el orden canónico del repositorio;
3. otorgar al rol runtime real los `EXECUTE` mínimos documentados solo sobre wrappers públicos; nunca otorgar las bases internas SUN ni helpers renombrados del importador;
4. ejecutar preflight y postchecks;
5. habilitar el flujo keyless.

La aplicación anterior contra DB 0090 puede seguir creando carriers SUN compatibles. El flujo keyless productivo requiere 0091; el importador reforzado requiere 0092; la verdad TT durable requiere 0093; el rol runtime SUN de privilegio mínimo requiere el boundary 0094; RBAC/riesgo y la serialización de autoridad requieren 0096. Estas migraciones no cambian CMAC, SDM, TTStatus ni la semántica física del tag: separan autoridad de base de datos y corrigen exposición ACL. Intentos antiguos de escribir claves falsas en carriers no-SUN fallan cerrados.

## 3. Construcción y Packaging Lab — sin CLI

Desde Dashboard, abrir **Supplier orders**, crear o seleccionar una orden y aprobar primero su especificación industrial. En el detalle:

1. Abrir **Packaging Lab**.
2. Elegir `AGRO_SECURE_PACKAGING_PILOT` o configuración manual.
3. Revisar formato propuesto, no asumirlo como aprobado. Para bolsa, el preset propone PET transparente convertido en rollo y zona plana fuera de costuras/pliegues. Para TT propone un puente tapa-cuello pendiente de prueba sacrificial. Para UHF propone placement logístico y prohíbe claves SUN.
4. Identificar producto/SKU y tipo de envase.
5. Registrar zona exacta y evidencia HTTPS o `evidence://` sin credenciales ni query sensible.
6. Para TT, confirmar que la cola cruza la apertura real y abrir obliga a romperla.
7. Crear el proyecto. El backend deriva tenant, orden, carrier, revisión y hash aprobados; no acepta esos campos desde el navegador.
8. Registrar cada ensayo obligatorio con medida y evidencia.
9. Aprobar con un segundo actor. Excepción de un solo operador: permiso especial, MFA y motivo auditado.
10. Descargar PDF/CSV; ambos deben excluir claves NFC y payloads SUN crudos.

El preset propone una construcción; no aprueba, certifica ni reemplaza la prueba física. La aprobación queda ligada a spec, placement, SKU, revisión de packaging y digest de tests. Un cambio relevante invalida la asociación.

## 4. Orden 5.000 y custodia por carrier

Crear con `total_quantity=5000` y `sub_batch_size=1000`. El recibo debe contener cinco sub-batches aislados con BID globalmente único.

Para `ntag424_dna` y `ntag424_dna_tt`, cada sub-batch genera un par aleatorio K_META/K_FILE de 16 bytes:

- envelope de aplicación con AAD tenant/BID/rol/versión;
- jamás en formulario, respuesta normal, Tenant Vault metadata, auditoría o Packaging Lab;
- fingerprints fuera del export privilegiado;
- nunca reutilizado entre tenants/sub-batches.

Para QR, GS1, NTAG213/215/216, UHF, wristband, keycard e IoT, la orden es keyless: no genera, persiste, descifra ni exporta K_META/K_FILE y no usa sentinelas.

El pack es un contenedor JSON nexID AES-256-GCM (`.zip.enc`) que cifra un ZIP interno con instrucciones y artefactos carrier-specific por BID, `manifest-template.csv`, hashes y `CHECKSUMS`; no es un ZIP password-protected estándar y requiere una herramienta compatible de descifrado. La contraseña se genera fuera de la respuesta API, viaja por canal separado y no se persiste en navegador, ticket, email del pack ni logs.

## 5. Manifiesto, QA y activación

1. Recibir manifiesto TXT/CSV del proveedor.
2. Ejecutar dry-run desde la interfaz.
3. Resolver BID incorrecto, UID duplicado, cantidad, carrier o formato inválido.
4. Importar solo con dry-run íntegro.
5. Para SUN productivo, completar Supplier Production Acceptance v2; para carriers keyless, usar el plan de muestreo vigente aprobado por el tenant y un recibo vigente de Packaging Lab.
6. Para SUN, verificar muestra segura, CMAC válido y replay rechazado. Esta ruta conserva su recibo de activación y no se reemplaza por evidencia keyless.
7. Para QR/GS1/UHF/NFC estático, registrar capturas recientes de UID y destino codificado exacto; esto prueba encoding, no autenticación criptográfica.
8. Para TT, verificar muestra cerrada y apertura sacrificial real posterior; la base solo acepta `4343`, `4F4F` o `4F43` y persiste un recibo sin UID/PII/claves.
9. Revisar el gate de cada sub-batch.
10. Activar solo si coinciden manifiesto, cantidad, QA productiva y recibo vigente de Packaging Lab.

Un override no convierte evidencia ausente en válida. Activación y archivado comparten locks transaccionales; una carrera debe bloquear/revalidar, nunca activar con un snapshot obsoleto.

## 6. Prueba post-tap y DPP agro

Ejecutar con muestras físicas configuradas:

- 424 sin TT válido → `VALID_AUTHENTIC`; texto “sin sello electrónico”.
- TT cerrado → `VALID_CLOSED` solo con `4343`, perfil exacto y packaging aprobado.
- TT abierto → `VALID_OPENED` con `4F4F`.
- TT abierto previamente → `VALID_OPENED_PREVIOUSLY` con `4F43`.
- TT incompleto, contradictorio o desconocido → `SUN_PROFILE_MISMATCH`; nunca inferir apertura.
- replay, CMAC inválido, UID desconocido/inactivo, BID incorrecto o profile mismatch → acciones sensibles bloqueadas.

El DPP muestra primero identidad, cultivo/variedad/familia, lote/registro/canal, ficha técnica, hoja de seguridad, EPP, stewardship, soporte y procedencia. Los CTA son idempotentes y tenant-scoped. Estados QR, offline, replay, mismatch o riesgo alto fallan cerrados para acciones sensibles.

## 7. GS1, offline y fallback

El resolver GS1 reconsulta la identidad activa y liga exactamente registry ID, tenant, batch/BID, GTIN, lote y serie antes de proyectar el mismo DPP público. Nunca confía en `tenant`, `bid` o `trust_level` del query para elevar confianza.

En modo offline:

- mostrar solo información pública firmada/cacheada;
- mostrar `VERIFICATION_PENDING`;
- guardar en cola local eventos mínimos permitidos;
- bloquear ownership, tokenización y afirmaciones finales;
- sincronizar idempotentemente y aceptar el backend como autoridad.

## 8. Webhook y conector enterprise

Configurar endpoint HTTPS tenant-scoped y verificar:

- HMAC v2 y rotación;
- request ID e idempotency key;
- retry/backoff, intentos y latencia persistidos;
- todo intento reclamado termina con receipt inmutable, incluso cambio de destino, endpoint deshabilitado o lease perdido;
- delivered/retry/dead-letter y replay manual auditado;
- envelope sin UID crudo, PII ni claves;
- `cropwise_physical_product_event` es mapping genérico preparado para integración, no certificación de integración nativa.

## 9. Polygon e IOTA

Polygon se prueba como ownership/NFT después de autorización comercial y control de wallet. IOTA se prueba como ancla opcional de hashes/Merkle por hito. Provider deshabilitado o RPC inválido se muestra como no disponible; nunca se fabrica un receipt.

No enviar a blockchain UID crudo, manifiestos, documentos, claves, direcciones privadas ni PII. No realizar transacciones por cada tap.

## 10. Gate técnico reproducible

Desde la raíz:

```powershell
npm.cmd run test:sun --workspace=api
npm.cmd run test:supplier-security --workspace=api
npm.cmd run test:webhooks --workspace=api
npm.cmd run test:gs1-epcis --workspace=api
npm.cmd run test:auth-security --workspace=api
npm.cmd run test:rate-limits --workspace=api
npm.cmd run test:polygon-transfer --workspace=api
npm.cmd run test:wallet-control --workspace=api
npm.cmd run test:proof --workspace=api
npm.cmd run build --workspace=api
npm.cmd test --workspace=web
npm.cmd run build --workspace=web
npm.cmd test --workspace=dashboard
npm.cmd run build --workspace=dashboard
npm.cmd run check --workspace=@product/nexid-server-sdk
npm.cmd run check:migrations:safety
npm.cmd run check:secrets
npm.cmd run check:placeholders
npm.cmd run qa:static
git diff --check
```

Para validar una instalación limpia en Neon descartable, definir fuera del repositorio `NEXID_DISPOSABLE_DATABASE_URL`, `NEXID_DISPOSABLE_NEON_ENDPOINT_ID` y la confirmación exigida por `apps/api/scripts/db-validate-disposable-neon-branch.mjs`, y ejecutarlo desde `apps/api`. Nunca imprimir ni persistir la URL en evidencia.

Con esas variables y la custodia SDK de QA configuradas fuera del repositorio:

```powershell
npm.cmd run db:disposable-neon:validate --workspace=api
npm.cmd run db:enterprise-release:preflight --workspace=api
npm.cmd run db:enterprise-runtime-role:qa --workspace=api
npm.cmd run db:authority-scope:qa --workspace=api
npm.cmd run db:sun-atomic:qa --workspace=api
npm.cmd run db:supplier-atomic:qa --workspace=api
```

El validador disposable exige una base vacía y aplica la cadena completa. El preflight es de solo verificación y puede reutilizar una base ya migrada; requiere `NEXID_RUNTIME_DB_ROLE` y una conexión `DATABASE_URL` autenticada directamente como ese mismo `session_user/current_user`, sin aceptar un owner usando `SET ROLE`. El validador de rol runtime crea un rol efímero sin login dentro de una transacción, prueba grants y denegaciones reales y revierte todo al finalizar; no crea ni modifica el rol de producción. El validador de authority scope ejecuta fixtures sintéticos en carreras reales de dos conexiones, exige endpoint directo no pooled, una base descartable aislada y limpieza acotada por UUID. Los validadores SUN y supplier son pruebas directas contra funciones PostgreSQL, no pruebas de rutas HTTP; cada uno debe ejecutarse una sola vez sobre su propia base Neon descartable, limpia y completamente migrada porque genera recibos append-only deliberadamente. Después se elimina esa base o rama descartable; nunca se borra evidencia para reutilizarla.

La evidencia histórica del 2026-08-02 validó primero 95/95 migraciones y todos los postchecks hasta 0093; un recibo incremental separado validó 96 migraciones hasta 0094 y el ACL de un rol runtime efímero. Se conservan como checkpoints históricos y no se reescriben.

La evidencia actual agrega cuatro comprobantes sanitizados:

- dos instalaciones Neon vacías e independientes pasaron 97/97 migraciones y postchecks hasta 0095: `evidence/neon-disposable-full-migration-validation-0095.json`;
- un rol runtime efímero transaccional pasó grants y denegaciones reales sobre el schema de 97 migraciones: `evidence/neon-disposable-runtime-role-acl-0095.json`;
- SUN directo a función pasó 13 eventos/13 recibos, concurrencia/replay, rollback, `4343`/`4F4F`/`4F43`, contradicciones o raw ausente fail-closed, `force_result` solo degradante, gates CMAC/SDM y append-only SQLSTATE `55000`: `evidence/neon-disposable-sun-tt-postgres-qa.json`;
- supplier directo a función pasó rollback atómico, carreras BID/UID, scope de manifiesto/carrier/claves, QR keyless con cero filas de claves y sin afirmar KMS/HSM, aislamiento autenticado entre dos tenants sin afirmar RLS, Packaging Lab/plan sintéticos, QA keyless y serialización activación/archivo: `evidence/neon-disposable-supplier-atomic-postgres-qa.json`.

Estos comprobantes no certifican Vercel/producción, el rol runtime real, las rutas HTTP, hardware NFC, KMS/HSM administrado, receptor webhook externo ni una escritura real Polygon/IOTA. Producción no fue modificada, no se escaneó una etiqueta física y no se archivaron claves crudas.

La migración 0096 y las carreras `db:authority-scope:qa` todavía requieren una
ejecución nueva en una rama Neon descartable autorizada. Las pruebas locales y
estáticas no sustituyen ese recibo remoto y no autorizan producción.

## 11. Evidencia visual obligatoria

Guardar en `docs/enterprise-hardening/2026-08-02/evidence/screenshots/`:

1. `01-packaging-lab-create.png`
2. `02-carrier-delivery-selector.png`
3. `03-seed-bag-placement.png`
4. `04-bidon-body-tt-cap-placement.png`
5. `05-supplier-order-5000.png`
6. `06-five-sub-batches.png`
7. `07-key-fingerprints.png`
8. `08-secure-supplier-export.png`
9. `09-manifest-dry-run.png`
10. `10-qa-matrix.png`
11. `11-activation-gate.png`
12. `12-agro-mobile-passport.png`
13. `13-risk-map.png`
14. `14-webhook-delivery-log.png`
15. `15-polygon-iota-proof-status.png`
16. `16-offline-pending.png`

Generar `SHA256SUMS` para las 16 y un `evidence-manifest.json` con schema `nexid-syngenta-screenshot-evidence/v1`. Cada entrada debe declarar `captured_at`, `source`, `contains_raw_secrets=false`, si se modificó producción, si hubo un NFC físico y una nota que delimite exactamente qué demuestra la captura. No incluir tokens, cookies, correos personales, UID completos, claves, passwords ni conexiones. No fabricar screenshots con mocks si el criterio exige estado persistido.

Validar el paquete antes de compartirlo:

```bash
npm run evidence:syngenta:screenshots
```

El gate exige los dieciséis nombres exactos, inventario sin archivos extra, PNG regulares no enlazados, dimensiones mínimas de 360×640, límite de 20 MiB por captura, manifest completo y hashes SHA-256 coincidentes. Un paquete ausente o parcial debe fallar; nunca se rellena con capturas históricas o simuladas.

## 12. Incidentes y rollback seguro

- Ante mismatch, replay, manifiesto inconsistente o pérdida de custodia: detener activación y acciones comerciales.
- Rotar/revocar API keys y secretos webhook mediante lifecycle auditable; no editar ciphertext manualmente.
- No borrar approvals, attempt receipts o evidencia append-only para “limpiar” una prueba.
- Las migraciones son aditivas. Si revierte código, conservar datos/gates; no eliminar controles en un rollback urgente.
- Estado externo ambiguo de Polygon/IOTA se reconcilia antes de reintentar; nunca reenviar a ciegas.

## 13. Criterio de salida

La demo controlada exige evidencia directa para los 17 criterios. Producción/cliente exige además migraciones verificadas, taps físicos, aprobación de packaging, credenciales rotadas, smoke tests remotos y las 16 capturas con checksum.
