# NexID — aislamiento de las regresiones del build productivo

El candidato API `5c49059e` falló al compilar en Vercel Production antes de promoverlo: dos pruebas de webhook heredaban NODE_ENV=production y su ejecutor SQL sintético no respondía a la consulta del registro de migraciones. Una reproducción aislada detectó también pruebas de autorización/catálogos que asumían un entorno de prueba limpio.

Se separan las regresiones del build de la compilación de Next. El primer proceso recibe únicamente variables del sistema permitidas, NODE_ENV/VERCEL_ENV=test y telemetría desactivada: no recibe DATABASE_URL, credenciales, flags de negocio, proxies o preloads de producción. `next build` sigue siendo un comando posterior del proceso original y conserva el entorno real de despliegue. Un error de las regresiones impide compilar Next.

La lista completa de comandos anteriores se conserva en `build:regressions`; se agrega una suite de diez pruebas sobre aislamiento, preservación de comandos, propagación de errores y conservación del entorno padre. Las dos pruebas de webhook ahora ejercitan explícitamente el esquema gestionado por migraciones y comprueban una consulta de watermark contra un registro sintético, sin omitir el control del runtime.

Validación local: el proceso padre se ejecutó con NODE_ENV=production, VERCEL_ENV=production y watermark 0121. Las regresiones completas finalizaron con código cero. No se modifican fuentes de runtime, migraciones, permisos, funciones SQL ni dependencias. El workflow nuevo reproduce el build con entorno productivo y ninguna credencial de cliente.

Este documento no declara publicación ni aplicación del delta. El cierre de infraestructura autorizado —sólo 0117–0121 y nuevas escrituras apagadas— se registra después de comprobar el candidato corregido, el respaldo, los datos y los dominios.
