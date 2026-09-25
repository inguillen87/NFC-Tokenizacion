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
