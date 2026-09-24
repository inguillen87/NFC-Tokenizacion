# NexID — runtime restringido y catálogos sin reescritura

Fecha: 2026-09-24. Estado: candidato probado localmente, no desplegado en producción.

## Continuidad

Base API: `bcf3af5d9b67ee28351c74fb655386d9adb487f1`, aceptación integral del proveedor y compatibilidad de tickets texto/enum. Rama nueva: `codex/nexid-supplier-runtime-acceptance-api-20260924`. Cotizaciones, proveedores y acuses anteriores se conservan. El panel `c9d0b132`, main y los otros worktrees no se modificaron.

La aceptación anterior ejecutaba el circuito con el dueño SQL de la base desechable. Este incremento también lo ejecuta desde un proceso distinto y un login SQL nuevo: sin superusuario, BYPASSRLS, creación de bases/roles, herencia, replicación, objetos propios ni membresías que permitan recuperar el dueño. El worker no recibe las credenciales del migrador.

## Problema encontrado y corrección

Los inicializadores de operaciones de proveedor, catálogos de soportes/chips y perfiles SUN incluían escrituras heredadas: actualización de proveedores de ledger, upsert de catálogo y siembra de perfiles/datos de demostración. Suprimir sólo el DDL de producción no suprimía esas escrituras. El runtime restringido fallaba por permisos; una cuenta con permisos amplios podía reescribir configuración al inicializar el proceso.

En el candidato, producción consulta los catálogos y la presencia del esquema, sin insertar o actualizar nombres, costos, configuración ni perfiles SUN desde esas inicializaciones. Un catálogo incompleto produce un error explícito: no se fabrica configuración ni se eleva el rol para repararlo. El fallo no queda cacheado como éxito y permite reintentar después de la corrección autorizada.

La consulta de negocio conserva el control de migraciones. La política de producción y del test restringido es la misma en `db.ts`; el adaptador sólo admite ese modo tras sus controles de entorno test, confirmación y destino loopback. El camino local de desarrollo existente se conserva separado.

No se modificaron migraciones, el enum de tickets, `release.json`, el lockfile ni dependencias. Este incremento no agrega una migración ni aplica las anteriores pendientes.

## Permisos efectivos, no sólo intenciones

El manifiesto explícito y congelado concede únicamente las tablas, funciones y columnas de bloqueo requeridas por el recorrido. No agrega permisos automáticamente al observar un fallo. Se comprobaron las ACL efectivas de 37 tablas, 595 columnas y 43 funciones, sin desvíos contra ese perfil.

Se ejecutaron 40 operaciones prohibidas y PostgreSQL las rechazó con 42501: recuperar el dueño, crear tablas/temporales, reescribir el registro de migraciones, editar catálogos/perfiles, deshabilitar triggers, modificar payload o metadata de paquetes y editar/borrar/truncar los historiales cubiertos.

Los permisos de bloqueo por columna son privilegios SQL reales. Este login compartido de aplicación **no es una credencial SQL aislada por empresa**: la separación de tenant/actor sigue dependiendo de la autorización de aplicación y de las funciones y constraints correspondientes. No se presenta como acceso de base de datos para proveedores o usuarios finales ni como certificación de todos los módulos.

## Recorrido y custodia

Sobre las 132 migraciones y el prerrequisito real de logística se ejecutan handlers productivos por HTTP local: borrador/envío, aclaraciones, cotización/aceptación, conversión a orden, especificación con aprobador independiente, proveedor, exportación cifrada, envío manual, acuse y tickets enum. Las sesiones están persistidas; las identidades y los datos de negocio son de prueba.

El exportador y el descifrado en memoria son reales. No se imprime material de claves ni contraseñas. Un digest de catálogos/perfiles antes y después exige que no hayan cambiado; es una comprobación de invariancia del fixture, no una prueba de autenticidad externa.

El proceso restringido recibe su conexión efímera y contexto por stdin, sin URL de dueño en argumentos, entorno o archivos. La salida está limitada a 1 MiB y la ejecución a 180 segundos. En error o exceso se termina el worker y se espera `close`, incluidos sus pipes, antes de eliminar el rol. Se exige un único recibo final; stderr se cuenta pero no se imprime, persiste ni devuelve.

La ejecución positiva verificó conexiones cerradas, rol eliminado, cluster detenido y directorio de datos retirado. No quedan esquemas de prueba del harness. Esto no certifica KMS/HSM ni custodia física.

## Validación local terminada

| Verificación | Resultado |
| --- | --- |
| Esquema completo | 132/132 migraciones |
| Recorrido con login restringido / HTTP real | 52 comprobaciones aprobadas |
| Operaciones prohibidas | 40 rechazadas por PostgreSQL |
| ACL efectivas | 37 tablas, 595 columnas, 43 funciones; sin desvíos |
| Regresión focal API | 470 pruebas aprobadas, cero fallos |
| Seguridad del harness | 62 pruebas aprobadas, cero fallos |
| Pruebas nuevas del incremento | 36, ya incluidas en los totales anteriores |
| Build API | Completo y aprobado con sus suites de regresión |
| Catálogos/perfiles | Sin cambios durante el recorrido |
| Limpieza | Rol eliminado, cluster detenido y datos efímeros retirados |

Motor local: PostgreSQL 17.10 Windows, versión exacta 170010. El CI mantiene la matriz 16.4/18.4 y el gate API, habilitados para la rama candidata. Sus resultados se verifican por SHA después del push; la configuración de un workflow no se cuenta como ejecución aprobada.

Evidencia durable: `docs/releases/2026-09-24-supplier-runtime-local-validation.json`. No contiene credenciales ni material de las exportaciones.

## Producción y siguiente puerta

Consulta canónica del 24/09/2026 a las 22:45 UTC: dashboard `2026.09.23-dashboard.41`, API `2026.09.23-api-supplier-requests.2` y web `2026.09.21-web-support.1`.

No se desplegó producción, aplicó SQL en Neon, cambió un rol remoto, activaron flags ni enviaron mensajes, paquetes o pedidos reales. La aprobación local de un perfil SQL no sustituye la comprobación del usuario y las ACL efectivas del despliegue.

La siguiente puerta consiste en verificar por lectura los catálogos, migraciones y permisos reales del entorno objetivo, preparar la promoción coordinada API/BFF/panel y dejar explícito el orden de activación. Cualquier migración pendiente necesita la autorización correspondiente. Un código de catálogo ausente debe corregirse por migración o administración autorizada, no concediendo permisos de dueño al runtime ni restaurando la siembra automática.

Continúan fuera de este cierre: middleware/TLS de Next, entrega externa y acuse autenticado del proveedor, KMS/HSM administrado, primer conector ERP/WMS real, costos monetarios por empresa y aceptación física del piloto NFC. El acuse manual permanece identificado como declaración de NexID.
