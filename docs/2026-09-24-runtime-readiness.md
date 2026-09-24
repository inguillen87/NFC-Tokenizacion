# NexID — diagnóstico del runtime y ledger verificado por lectura

Fecha: 2026-09-24. Base: `5b220796`. Rama candidata: `codex/nexid-runtime-readiness-20260924`. No hay un despliegue productivo nuevo en esta sesión.

## Avance: lectura directa, no inferencia de un dump

Se usó la CLI de Neon ya autorizada para obtener una conexión temporalmente en memoria a la rama seleccionada. La identidad del endpoint se contrastó primero con la API de control y después con `current_setting('neon.endpoint_id')` desde SQL. La conexión usó TLS verify-full y `default_transaction_read_only=on`; el sondeo se ejecutó en una transacción REPEATABLE READ READ ONLY que terminó con ROLLBACK. La consulta fue fija, sin SQL ni destino tomado de un usuario HTTP.

No se escribieron contraseñas/conexiones en archivos, argumentos o logs. Sólo el informe local conserva los identificadores de la infraestructura. No se consultaron filas de clientes ni se aplicaron migraciones, permisos o modificaciones de negocio.

Resultado al 2026-09-24T23:51:09.439Z:

- El ledger contiene **79 entradas**, incluyendo 0115 y 0116. Queda confirmado su registro, no sólo la existencia de sus tablas: no corresponde reejecutarlas por la versión .41 del panel.
- Los requisitos de migraciones del runtime base están presentes; los códigos de los catálogos de soportes y proveedores de ledger también. Esto no verifica precios ni configuración comercial.
- Las migraciones 0117, 0118, 0119, 0120 y 0121 no figuran en el ledger observado. Coincide con las estructuras/fuentes pendientes identificadas en el corte anterior.
- El repositorio tiene 48 archivos históricos adicionales no registrados en ese ledger. **No se debe convertir la diferencia entre 79 entradas y 132 archivos en una orden para ejecutar todo lo faltante.** Es preciso reconciliar el baseline histórico y su esquema antes del runner; esta sesión no marcó migraciones como aplicadas ni reparó el ledger.

La conexión usada para inspección es administrativa. **Todavía no prueba qué DATABASE_URL ni qué usuario SQL utiliza el despliegue canónico de Vercel.** No se presenta esa cuenta como el rol productivo de la aplicación.

## Implementación: respuesta desde el runtime real

Se agregó `GET /admin/diagnostics/runtime-readiness` al candidato. Autentica una sesión humana persistida de superadministrador y respeta las denegaciones de audit.read. Tener auditoría de una empresa, ser técnico asignado o enviar headers de identidad no permite consultarlo. No acepta parámetros de tenant, rol, conexión o SQL; no agrega POST/PATCH/DELETE.

La consulta de diagnóstico es una única sentencia fija de lectura: identidad real de conexión, endpoint Neon si existe, versión PostgreSQL, indicadores de privilegios, ledger, códigos de catálogos y existencia/EXECUTE de un conjunto cerrado de funciones. No invoca esas funciones ni modifica permisos; no devuelve URL de conexión, secretos, datos comerciales, clientes o precios. La autenticación existente puede actualizar su propia sesión conforme al mecanismo habitual; el diagnóstico de datos no tiene una escritura de negocio.

La respuesta distingue `schema_or_ledger_missing`, `execute_privilege_missing` y `named_prerequisites_present`. Compara flags habilitados con sus requisitos. También incluye sólo metadata de despliegue permitida (entorno, ID y commit cuando están disponibles); no toma esa identidad de headers ni de parámetros de consulta. Los valores ausentes o inválidos no se inventan.

La presencia de los requisitos nombrados no equivale a aceptación completa: `promotionAllowed` y `migrationExecutionAllowed` permanecen false. No certifica cuerpos/checksums, ACL de todas las tablas, contenido del baseline histórico, compatibilidad del panel o evidencia física. Las lecturas no eluden el watermark de migraciones del runtime; cuando falta el esquema básico se informa indisponibilidad en vez de autoarreglarlo.

El resultado es privado y no cacheable; errores sanitizados y sin eco de excepciones. Se rechazan observaciones incompletas, duplicadas, sobredimensionadas, incoherentes o de más de un minuto. Límite del resultado: 512 IDs de migración, 128 códigos por catálogo y únicamente las firmas de función esperadas. No se promete un timeout SQL nuevo: se conservan los límites del transporte/runtime configurado.

## Validación ejecutada

- 37 pruebas unitarias nuevas: autorización real, denegaciones, selectores maliciosos, proyección sin secretos, flags, datos parciales y ausencia de permisos.
- 540 pruebas focales API aprobadas; build API completo con las suites existentes aprobado; auditoría de dependencias y escaneo de secretos aprobados.
- Integración local con las 132 migraciones: 61 comprobaciones en el recorrido de dueño y 62 con un login SQL restringido, por TCP/HTTP y handlers reales. El nuevo diagnóstico verifica que la identidad devuelta coincide con la conexión SQL de ese proceso.
- Las 40 operaciones prohibidas del perfil restringido siguen rechazadas. El diagnóstico detecta funciones no concedidas a ese perfil, en vez de otorgarlas sólo para conseguir un estado favorable.
- Se cerraron conexiones y se eliminó el rol temporal. Cluster PostgreSQL 17.10 detenido, directorio de datos efímeros retirado. Datos e identidades de integración sintéticos; sin proveedor externo ni NFC físico.

El mismo query de diagnóstico también se ejecutó en la transacción de lectura de la rama remota seleccionada, con el resultado de ledger/catálogos indicado arriba. Eso valida SQL y proyección sobre esa base, no que la ruta HTTP nueva esté publicada.

CI de API y matriz PostgreSQL 16.4/18.4 habilitados para la rama candidata. Se deben verificar sus resultados sobre el SHA subido; la configuración de CI no se cuenta como un éxito. Evidencia sanitizada: `docs/releases/2026-09-24-runtime-readiness-validation.json`.

## Producción y cierre siguiente

- api: `2026.09.23-api-supplier-requests.2`, comprobado 2026-09-24T23:57:13.066Z.
- dashboard: `2026.09.23-dashboard.41`, comprobado 2026-09-24T23:57:14.038Z.

No se cambió el panel, release.json, dependencias, esquema, flags ni rol remoto. El inspector previo y los bloques de cotización/proveedor/acuse permanecen intactos.

El siguiente cierre es publicar este diagnóstico de forma controlada, comprobarlo con una sesión autorizada contra el despliegue identificado y relacionar el endpoint devuelto con la rama prevista. Luego se debe validar el delta real de migraciones en un entorno aislado y aplicar únicamente lo autorizado. La mera respuesta del diagnóstico no autoriza un despliegue o una migración.
