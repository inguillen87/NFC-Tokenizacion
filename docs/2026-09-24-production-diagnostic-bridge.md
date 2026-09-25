# NexID — incremento de diagnóstico sobre la API productiva

Base contrastada en Vercel: `fca60584bbbcc8ab18e1f06e578f0286723204ef`, release `2026.09.23-api-supplier-requests.2`. Rama independiente: `codex/nexid-production-diagnostic-bridge-20260924`.

## Alcance exacto

Se trasladaron solamente la ruta GET de diagnóstico y sus dos helpers desde el candidato `4eeb1fef`. Los 549 archivos preexistentes de `apps/api/src` conservan su contenido normalizado LF. Un test fija el digest del árbol previo y rechaza cambios fuera de los tres archivos añadidos. No se integraron en producción las ramas posteriores de cancelación, cotización, proveedor, acuses o runtime restringido.

Release prevista: `2026.09.24-api-runtime-diagnostics.1`. Se conservan todos los protocolos, requisitos de migraciones y compatibilidad con dashboard `.41` del despliegue base. No se modifica ninguna migración, configuración persistida, flag de negocio, dependencia ni permiso.

`GET /admin/diagnostics/runtime-readiness` exige sesión humana de superadministrador y respeta las denegaciones `audit.read`. Rechaza parámetros, métodos alternativos y headers que intenten sustituir identidad. Devuelve una proyección privada de la conexión usada por ese proceso, ledger, catálogos y funciones esperadas. No entrega cadenas de conexión, contraseñas, filas de clientes o precios. No migra ni activa funciones; `promotionAllowed` y `migrationExecutionAllowed` permanecen false.

El diagnóstico no omite el watermark de migraciones existente. La autenticación conserva su comportamiento habitual de sesión; la consulta diagnóstica es sólo lectura. La presencia de requisitos de base de datos no implica que todos los handlers nuevos estén publicados en este incremento reducido.

## Comprobaciones locales

294 pruebas focales aprobadas, incluidas 37 de diagnóstico y 3 de límites del incremento. Compilación completa de API aprobada con las suites del baseline. Se actualizó únicamente la etiqueta esperada de release en la regresión de tickets; sus afirmaciones de protocolos y migraciones se conservan.

El workflow existente se habilita para esta rama sin cambiar su SQL aislado, permisos, acciones fijadas o criterios de aprobación. El resultado remoto debe verificarse sobre el SHA concreto.

## Publicación controlada

Primero: build remoto con configuración de producción, sin asignar dominios. Después: verificar identidad de código, release, liveness y rechazo de acceso no autenticado, y revalidar que el alias canónico siga apuntando al baseline antes de promover. No se mezclan revisiones de otros worktrees.

La lectura autenticada del diagnóstico sigue siendo un cierre separado: sólo esa respuesta permite relacionar la conexión del proceso con el endpoint de Neon. No se declara esa relación por conocer la base de una consulta administrativa. No se crean cuentas ni se modifican contraseñas para completar QA.

Rollback: volver al despliegue base; al no haber migraciones ni escrituras de negocio nuevas, no existe un procedimiento inverso de datos. Estado de despliegue y evidencia remota se registrarán después de observar el resultado real, no por anticipado.

## Resultado observado: publicado en producción

Código desplegado: `c21a0a776247d5109706e52db5895e817ea42cb9`. La API canónica sirve `2026.09.24-api-runtime-diagnostics.1`; se confirmó el SHA y estado READY del despliegue, además del contenido íntegro de release.json. Promoción completada el 25/09/2026 a las 00:21:37 UTC (24/09, 21:21 en Argentina). El dashboard continúa en `2026.09.23-dashboard.41`.

GitHub Actions `36076352787`, sobre ese mismo SHA, terminó aprobado: regresiones focales, PostgreSQL desechable, compilación completa, secretos y limpieza. La evidencia durable está en `docs/releases/2026-09-24-production-diagnostic-bridge.json`. Un commit posterior sólo de documentación no cambia el código desplegado.

La etapa previa respetó una restricción importante: la protección de origen existente rechaza el acceso directo a las rutas de aplicación de Vercel incluso con autorización de la plataforma. Se verificaron liveness y tres rechazos de origen; no se desactivó la protección ni se recuperó su secreto. La validación de los handlers se completó después de promover, a través del dominio canónico protegido.

Las ocho comprobaciones canónicas aprobaron: release exacta con contratos .41, proceso disponible, rechazo de anónimo, rechazo de identidad por headers, rechazo de token local, rechazo de token demo, ausencia de POST y protección conservada del endpoint de solicitudes. No se aplicaron migraciones, cambiaron flags o permisos, ni se efectuaron escrituras de negocio.

Se abrió el diagnóstico en el Chrome existente mediante la ruta del panel `/api/admin/diagnostics/runtime-readiness`. La página respondió `Dashboard session required for admin proxy access.`. No había una sesión válida del panel disponible para esa consulta. Se leyó únicamente el JSON renderizado, sin cookies, credenciales, archivos del perfil ni portapapeles; la pestaña del diagnóstico permanece abierta y se restauró la pestaña que estaba seleccionada.

Por lo tanto, **la ruta está publicada pero la lectura autenticada positiva y la correspondencia conexión de API → rama Neon todavía no están certificadas**. El paso pendiente es iniciar sesión como superadministrador y volver a consultar esa pestaña. No se inventó ni se creó una cuenta para completar esta comprobación.

La preparación inicial de una copia local del commit agotó el espacio disponible antes de invocar Vercel. Se retiraron exclusivamente ese archivo temporal y su extracción incompleta, conservando fuente y reportes. Se utilizó el build remoto desde el SHA de GitHub, evitando duplicar el repositorio en el disco local.
