# Enterprise E2E efimero: tap SUN a incidente y ticket

## Objetivo

Este harness verifica, sobre PostgreSQL real y descartable, la historia operativa:

1. generar un payload SUN sintetico con claves aleatorias de proceso;
2. ejecutar la implementacion CMAC/SDM de produccion sobre ese input sintetico;
3. persistir el tap con `nexid_persist_sun_scan_v1`;
4. observar el evento por la ruta SSE tenant-scoped;
5. recuperarlo por la ruta de polling administrativo;
6. abrir el incidente mediante la ruta autenticada;
7. comprobar ticket, historial, idempotencia y aislamiento entre tenants;
8. envejecer el incidente abierto mas alla de 30 dias y comprobar que las senales operativas actuales siguen mostrandolo aunque quede fuera de la cohorte SLI seleccionada.
9. crear, autenticar, limitar por scope y revocar una API key tenant-scoped;
10. ejercer reservas de rate limit concurrentes y compartidas en PostgreSQL;
11. crear y rotar un webhook, comprobar su secreto cifrado, auditoria append-only, outbox idempotente, lease y firma v2; y
12. verificar la entrega con un receptor in-process permitido solo en test, sin DNS, sockets ni `fetch`.

No es una certificacion de un tag fisico, de TagTamper, del packaging ni de un
entorno desplegado. Tampoco ejecuta Polygon, IOTA, WhatsApp, una entrega webhook
por red ni otros efectos externos. La evidencia generada por el harness se
identifica como sintetica y efimera.

## Limites de seguridad

El comando no lee `DATABASE_URL` como entrada. Exige
`NEXID_E2E_DATABASE_URL` y falla antes de migrar salvo que se cumplan todos los
predicados:

- `NODE_ENV` y `VERCEL_ENV` son exactamente `test`;
- la confirmacion coincide exactamente con
  `I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE`;
- `NEXID_E2E_EXPECTED_POSTGRES_VERSION` declara una version soportada y
  PostgreSQL confirma exactamente ese `server_version_num` antes de cualquier
  DDL;
- el protocolo es PostgreSQL;
- el hostname es `localhost`, `127.0.0.1` o `::1`;
- la URL no contiene query parameters ni fragmentos que el driver pueda usar
  para reemplazar host, rol, puerto u opciones ya validados;
- el rol es exactamente `nexid_e2e`;
- la base es `nexid_e2e` o comienza con `nexid_e2e_`;
- la URL usa la credencial exclusiva del rol descartable;
- PostgreSQL confirma la misma base y rol, no informa un endpoint Neon, es
  escribible y no contiene ninguna relacion en `public`.

El harness no contiene `DROP`, `TRUNCATE`, limpieza de esquemas ni fallback a
una base compartida. Las migraciones se aplican solamente después del
preflight de base vacia. Las claves K_META, K_FILE y KEK se generan en memoria
y no se imprimen ni reutilizan. Aunque el codigo usa la variable historica
`KMS_MASTER_KEY_HEX`, en este harness es un secreto aleatorio de proceso usado
por el envelope AES-256-GCM de aplicacion: no es una clave de KMS administrado,
no es HSM y no aporta evidencia de no exportabilidad.

## Ejecucion local

Se necesita PostgreSQL 16.4 o 18.4 local con una base nueva y vacia:

```powershell
$env:NODE_ENV = "test"
$env:VERCEL_ENV = "test"
$env:NEXID_E2E_CONFIRMATION = "I_UNDERSTAND_NEXID_E2E_USES_AN_EMPTY_LOCAL_DATABASE"
$env:NEXID_E2E_EXPECTED_POSTGRES_VERSION = "18.4"
$env:NEXID_E2E_DATABASE_URL = "postgresql://nexid_e2e:<password-local>@127.0.0.1:5432/nexid_e2e"
npm.cmd run test:e2e:ephemeral
```

No usar una base existente, aunque sea de desarrollo: el preflight la
rechazara. Para repetir la prueba se debe crear otra base vacia con nombre
`nexid_e2e_<sufijo>` o recrear explicitamente la base local fuera del harness.

## CI

[`enterprise-ephemeral-e2e.yml`](../../../.github/workflows/enterprise-ephemeral-e2e.yml)
ejecuta una matriz PostgreSQL 16.4/18.4 sin secretos de repositorio, instala el
lockfile, ejecuta primero las pruebas negativas del safety gate y luego la
historia completa en cada pull request, cada push a `main`, cada merge queue y
cada ejecucion manual. Cada job verifica que la version real del servidor
coincida con la version declarada por su entrada de matriz antes de crear la
tabla de migraciones. No hay filtro `paths`, por lo que un cambio indirecto de
criptografia, autenticacion, migraciones o persistencia no puede omitir esta
frontera. El contenedor y todos sus datos desaparecen al finalizar el job. Las
acciones externas estan fijadas por SHA, ambas imagenes PostgreSQL por digest y
el runner por version de sistema operativo (`ubuntu-24.04`), evitando tags
moviles como `@v4`, `postgres:latest` y `ubuntu-latest`.

## Evidencia y estado local

El resultado exitoso es un JSON sin secretos con las fronteras comprobadas y
los conteos durables. Declara `evidence_class=synthetic_ephemeral_software_fixture`,
`physical_nfc_tag_scanned=false`, `physical_tag_certification=false`,
`tagtamper_physical_certification=false`, `managed_kms=false` y
`hsm_backed=false`. Un resultado local no debe describirse como prueba de
produccion ni como validacion de los tags de muestra.

El 2026-07-30 esta historia se ejecuto independientemente sobre PostgreSQL 16.4
y 18.4 embebidos y descartables. Ambas corridas aplicaron 74/74 migraciones y
completaron el mismo E2E: SUN sintetico mediante la implementacion CMAC/SDM,
SSE y polling tenant-scoped, incidente, ticket e historial, API key creada y
revocada, rate limit PostgreSQL concurrente, webhook rotado y auditado, outbox
idempotente, lease y firma v2 verificada sin red. En ambas se observaron el
rechazo cross-tenant y el replay idempotente.

Esta evidencia local no reemplaza la ejecucion de los jobs CI fijados por
digest ni certifica staging, Neon, produccion, Polygon/IOTA, DNS/TLS webhook,
un receptor externo o un tag NFC fisico.
