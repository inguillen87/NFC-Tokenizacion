# Cancelación de solicitudes comerciales — API, migración y rollout

Fecha: 2026-09-24. Candidato desde `f9512224` en `codex/nexid-request-cancellation-api-20260924`. Panel par: `codex/nexid-request-cancellation-ui-20260924`, desde `b628cb3c`. No desplegado en producción; no se aplicó SQL en Neon.

## Contrato

GET/POST `/admin/supplier-requests/{requestId}/cancellation?tenant={slug}`, protocolo `nexid.supplier-request-cancellation.v1`. Respuestas privadas y sin caché. El GET confirma capacidad desplegada y devuelve el registro actual. El POST sólo acepta motivo, versión de solicitud y versión de aclaraciones; tenant, actor y sesión se fijan desde el contexto autenticado.

La autoridad es la existente `supplier_order.create`, dentro del tenant o como superadmin. No se concede ese permiso a usuarios nuevos. Un operador limitado no puede cancelar, ni siquiera por wildcard. La sesión, membresía, perfil y denegaciones se revalidan dentro de la transacción y antes de recuperar un recibo anterior.

El endpoint está cerrado por defecto: `SUPPLIER_REQUEST_CANCELLATION_ENABLED=true` es una condición adicional necesaria. Sin ella devuelve 503 antes de consultar el tenant o una base de datos. Con el flag, debe existir `nexid_cancel_supplier_request_v1(jsonb)` y el rol de conexión debe poder ejecutarla. No se introduce un permiso PUBLIC ni se adivinan grants de producción.

## Persistencia y concurrencia

Migración: `20260924010000_0117_supplier_request_cancellation.sql`.
SHA256 de bytes LF: `be81286a20d58815b290b0781947c1a4f1a899b0a4a6d008f1901f3b43bbf581`.

- Sólo permite `submitted → cancelled`. Borradores y pedidos técnicos preparados no se cancelan aquí; no hay reapertura ni borrado.
- La solicitud conserva título, construcción, cantidad, destino, notas y evidencia de envío. Añade motivo, actor y fecha con constraints consistentes; el estado terminal es inmutable.
- Clave de idempotencia en el namespace existente de operaciones: colisiones con create/patch/submit o cambios de actor, razón, versiones o solicitud son conflictos, no nuevas cancelaciones.
- Orden de bloqueos compatible con asignaciones: autoridad, clave de operación, fila de solicitud y revalidación de autoridad. La conversión y las aclaraciones compiten por la misma fila; se comparan ambas revisiones.
- Estado, auditoría y operación se escriben en una transacción. Un trigger de constraint diferido exige un recibo/auditoría coincidentes para aceptar el estado terminal. Fallar cualquiera de las escrituras revierte la cancelación.
- Historial de aclaraciones y responsables sigue consultable por NexID/empresa según sus permisos. Los técnicos limitados mantienen el filtro enviado/preparado y pierden el acceso operativo a canceladas; no se borran asignaciones históricas.
- No se modifica la función industrial de crear órdenes ni sus controles de claves, packaging o aceptación física.

La migración requiere las anteriores 0113–0116. Es forward-only, con transacción/ledger a cargo del runner. DDL: lock_timeout 5 segundos y statement_timeout 60 segundos para fallar antes que esperar indefinidamente. No se ignoran fallos por locks.

## Validación ejecutada

- `npm run build:api`: aprobado completo, incluidas suites de seguridad y compilación.
- `node scripts/qa/run-s9-api-unit.mjs`: 297 casos aprobados, cero fallos; entorno sin credenciales o URLs de aplicación heredadas.
- Harness PostgreSQL real aislado: 52 pruebas aprobadas, sin omisiones; 13 nuevos casos. Se conservaron las migraciones y los triggers reales de autorización de la prueba existente. El núcleo técnico de crear órdenes sigue siendo un fixture explícito; no es una prueba de generación de llaves reales.
- Nueva matriz cubre rechazo de borrador/orden preparada, terminalidad, recibo exacto, claves duplicadas, actor/tenant ajenos, revocación, motivos inseguros, fallos de auditoría/operación, SQL directo sin recibo y carreras cancelación/conversión/aclaración/asignación.
- Seguridad estática de migraciones, auditoría de dependencias y escaneo de secretos aprobados.
- Sin conexiones a producción ni registros de negocio reales. Cluster local detenido y esquemas de prueba retirados por el harness.

Los tests HTTP nuevos están incluidos en test:supplier-security y en el runner focal. El workflow existente de PostgreSQL/build queda habilitado para la rama candidata; no contiene ningún paso nuevo de migración remota o despliegue. El estado de CI se comprueba por commit, no por este texto.

## Secuencia de activación obligatoria

1. Revisar el candidato y sus tests; verificar el esquema completo y el rol real en un entorno aislado autorizado. Esta sesión no sustituyó esa validación por una prueba sobre clientes.
2. Preparar lectores compatibles con `cancelled` en API, BFF, dashboard y consumidores. El panel canónico .41 no lo entiende. Mantener el flag desactivado mientras se actualizan.
3. Verificar migraciones previas 0115/0116 y aplicar 0117 sólo con autorización explícita, usando el runner y su ledger. Confirmar permisos del rol real sin grants amplios automáticos.
4. Publicar/verificar la API y el dashboard compatibles, todavía sin escrituras de cancelación habilitadas. Validar el contrato y los límites de tenant/rol con identidad autorizada.
5. Activar el flag únicamente cuando los lectores estén listos y realizar el primer recorrido real autorizado.

Rollback operativo: desactivar nuevas cancelaciones con el flag y conservar el esquema aditivo, recibos e historial. No restaurar clientes que rechacen el nuevo estado una vez que exista. No reabrir registros cancelados, borrar auditoría ni intentar cancelar una orden técnica para revertir el despliegue.

Fuera de alcance: cotización/precio, impuestos, compra, cancelación de pagos, fabricación, stock, expedición, notificaciones externas y certificación física de etiquetas.

## Hallazgo del CI del primer candidato

El run 35953745137 aprobó la regresión focal y PostgreSQL 18.4, pero encontró una prueba preexistente no determinista de expiración SUN: el caso futuro +61 segundos podía pasar a +60 si cruzaba el segundo real durante el test. Se fijó el reloj desde el inicio de ese test y se conservó su restauración en finally. No se modificó la duración, tolerancia, firma ni lógica de expiración de producción. La corrección no consiste en omitir ni relajar la aserción; el CI debe repetirse sobre el commit corregido.
