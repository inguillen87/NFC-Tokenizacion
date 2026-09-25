# NexID — aceptación de actualización con expedientes existentes

Fecha local: 2026-09-24. Base de código: `4eeb1fef5c89b5faa0a1e7b8cadbec738ba44b65`.
Rama candidata: `codex/nexid-supplier-upgrade-acceptance-20260924`.
Alcance: pruebas y herramientas de aceptación local. No cambia código de la API productiva, archivos SQL, permisos remotos ni flags.

## Problema que cierra

La reconstrucción completa desde cero no demuestra que un expediente existente conserve sus datos al aplicar el siguiente bloque de migraciones. Tampoco justifica ejecutar 48 archivos históricos porque no figuren en el ledger observado.

La prueba nueva usa el runner canónico `db-apply.mjs` sin modificarlo. Reconstruye en PostgreSQL local vacío el esquema del repositorio hasta 0116 (127 archivos), reproduce el patrón de los 79 IDs observados y crea solicitudes, aclaraciones, responsables y tickets sintéticos antes de aplicar 0117–0121.

**No es una copia del esquema vivo ni de registros de clientes.** Sólo los nombres de migraciones del informe anterior se reutilizan como fixture; se excluyeron host, endpoint, rol, credenciales y datos de negocio. Reproducir su patrón de ledger en una base local conocida no certifica que la estructura histórica de Neon sea idéntica.

## Comprobaciones ejecutadas

1. El runner sin `--only` rechaza los 48 huecos históricos. La negativa conserva datos y ledger.
2. Intentar 0115/0116 con el runner no las ejecuta porque ya están registradas.
3. Un fallo intencional al insertar 0117 en el ledger revierte sus columnas y cambios de funciones, además de conservar todos los registros.
4. Sólo se ejecutan, en orden, 0117, 0118, 0119, 0120 y 0121. Se comparan conteos y huellas de los valores de todas las columnas originales de 14 tablas después de cada paso.
5. Se comprueban por separado los nuevos valores por defecto: ningún registro previo aparece cotizado o cancelado sólo por migrar; las nuevas tablas de eventos permanecen vacías.
6. El ledger de la simulación pasa de 79 a 84 entradas y mantiene documentados sus 48 huecos históricos. No se marca artificialmente el resto como aplicado.
7. Repetir el delta no ejecuta SQL de migraciones ni cambia registros; los recibos antiguos de creación y envío siguen recuperables.
8. La asignación previa sigue legible por el técnico. Una cancelación explícita de prueba, posterior al upgrade, funciona sobre la solicitud antigua, retira el acceso operativo y conserva su aclaración original.

La prueba cubre 20 comprobaciones de integración. Las 14 tablas incluyen usuarios, membresías, sesiones, permisos, solicitudes, operaciones, aclaraciones, asignaciones, auditoría, tickets y catálogos. Las huellas se usan para comparar, no para divulgar contenido.

## Seguridad y límites del ejecutor

El programa rechaza argumentos de línea de comandos adicionales y utiliza la autorización de pruebas efímeras existente: entorno test, confirmación literal, PostgreSQL versionado, usuario `nexid_e2e`, host loopback y base dedicada inicialmente vacía. No admite Neon ni una URL elegida por parámetros HTTP.

La creación del esquema y la modificación del ledger son exclusivamente del fixture local. Los archivos temporales contienen sólo fuentes SQL del repositorio; se eliminan después. Las conexiones y el cluster local se cierran y su directorio de datos se retira. No se heredan credenciales productivas hacia los procesos hijos ni se imprimen diagnósticos completos del driver.

El plan contiene exactamente cinco migraciones. Un archivo posterior no revisado, un ID desconocido, duplicado, ruta, requisito previo ausente o delta registrado fuera de orden provoca rechazo. Los arrays devueltos son copias inmutables. El resultado conserva `productionExecutionAllowed: false` y `liveBaselineVerified: false`.

La operación de fallo intencional no cambia el runner: una restricción de prueba sobre el ledger fuerza un error después del DDL de 0117 y se retira al terminar. Esto valida su transacción real, no una implementación sustituta de las migraciones. La comparación de registros utiliza las columnas existentes antes de migrar; también se verifican explícitamente los nuevos campos por defecto.

## Validación local

- 28 pruebas nuevas del plan y las restricciones de ejecución.
- Regresión focal API: 568 aprobadas, cero fallos/omisiones.
- Suite de seguridad de las pruebas efímeras: 123 aprobadas, cero fallos/omisiones.
- Compilación completa de API aprobada con sus suites de regresión.
- Integración en PostgreSQL 17.10: 20 comprobaciones aprobadas.
- Se reprodujo además el orden del workflow: las cuatro suites PostgreSQL existentes se ejecutan primero y dejan el destino apto para la prueba de upgrade; después pasan las mismas 20 comprobaciones.

Las 28 pruebas nuevas están incluidas en los totales focal/de seguridad, no deben sumarse como pruebas distintas. Se corrigieron dos errores del fixture durante su desarrollo: coerción ambigua UUID/text en una sesión sintética y comparación inicial que no distinguía columnas añadidas de valores previos. No se alteraron los SQL productivos para conseguir la aprobación.

El workflow de API se habilita para la rama candidata y agrega el upgrade sobre PostgreSQL 18.4 desechable. El resultado remoto debe verificarse sobre el commit subido; esta configuración por sí sola no constituye un resultado aprobado.

## Siguiente puerta de publicación

Esta prueba demuestra preservación sobre un baseline reconstruido y un patrón de ledger conocido. Todavía falta cotejar ese baseline con la estructura efectiva del endpoint usado por la API productiva. No habilita por sí sola las migraciones de Neon ni las funciones comerciales.

Antes de ejecutar remotamente: lectura autenticada de la conexión real, comparación del esquema/dependencias y hashes del delta, prueba aislada de esa combinación, autorización de las migraciones nominadas y publicación de API/panel compatibles con escrituras inicialmente apagadas. No ejecutar todas las diferencias históricas ni registrar migraciones como aplicadas sin evidencia.
