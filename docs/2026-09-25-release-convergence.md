# NexID — convergencia de candidata avanzada y corrección productiva

## Alcance de este sprint

Se integra la candidata comercial con protección de lecturas (`7e3b7f9db153266dd7763d70111e93784c47bb1d`, código `6e03bb78`) y la corrección de acceso/notificaciones ya publicada (`95e54eae57cfcbd21cce7af9066956e5cbd1f757`, código `cb2a845d`). Rama nueva: `codex/nexid-release-convergence-20260925`.

El merge mantiene ambas ascendencias. No se hace merge a main, rebase, force-push ni sustitución de una rama por la otra. Las ramas originales permanecen intactas. La API compatible sigue siendo la candidata separada `52ffff7714801d93d12dede02a387adf9a4f0de0`; la API contenida incidentalmente en la rama del panel no debe seleccionarse como reemplazo del backend avanzado.

La candidata conserva cotizaciones/aceptación, cancelación, técnicos, proveedor/especificación, recepción de manifiestos, acuse documental y disponibilidad del circuito. Conserva también los controles de lectura frente a acceso revocado, borradores, cancelación de consultas y operaciones de resultado incierto.

Se incorpora la explicación de acceso global de runtime y la campana restringida a su contexto autorizado. La publicación futura de la candidata no debe reintroducir el falso 404 ni las consultas globales desde una cuenta de empresa. No se modifican los permisos para conseguir esa presentación.

## Resolución de integración

Los conflictos estuvieron en el workflow y en el manifiesto de preservación de fuentes. Se unieron todas las ramas y suites de navegador anteriores, incluida la prueba del hotfix, sin eliminar pruebas ni agregar continue-on-error.

La cabecera necesitaba conservar código exclusivo de la rama avanzada. Por eso no se reemplazó el archivo completo con la versión productiva: sobre su contenido avanzado se aplicaron únicamente el import de la política de notificaciones y los parámetros de autorización/contexto de la campana. El resultado se verificó contra esa transformación explícita.

## Preservación verificable

El manifiesto nuevo deriva los hashes de commits inmutables, no de aceptar como correcto todo lo que haya quedado en el directorio. Verifica los 489 archivos fuente finales: 484 sin cambios frente a la candidata avanzada, dos archivos reemplazados con la corrección publicada, una cabecera combinada mediante los dos cambios revisados y dos archivos nuevos del hotfix.

El control anterior de runtime se conserva y ahora fija los 484 archivos inalterados. El control nuevo incluye también los cinco archivos afectados por el hotfix. Así quedan protegidos, entre otros, el workspace de solicitudes y su BFF, que antes tenían revisiones específicas separadas.

No se alteraron los protocolos ni los archivos de la API, packages, dependencias, migraciones o variables de entorno. No se cambió el contrato de release para insinuar que el circuito pendiente ya esté habilitado.

## Pruebas nuevas de coexistencia

21 pruebas nuevas ejecutan el forwarder comercial real con sesión y transporte inyectados. Comprueban que denegar el diagnóstico global no bloquee por accidente las consultas autorizadas de una empresa; que aceptar/rechazar una cotización conserve el cuerpo y la clave de operación; y que asignar técnicos, proveedor o acuses no se habilite para una empresa.

También comprueban que el superadministrador deba seleccionar empresa para consultar su circuito, que una denegación de auditoría no se confunda con un permiso comercial y que el técnico limitado conserve únicamente su bandeja asignada y la solicitud de aclaraciones. Demo, denegación general, empresa ajena y respuestas 401/403/404 no recuperan acceso por pasar por el aviso explicativo de runtime.

Estas pruebas llegan hasta la frontera del BFF con transporte sintético. No prueban que una operación SQL productiva haya sido autorizada o realizada. Los controles del backend permanecen intactos y su aceptación pertenece a la API candidata correspondiente.

## Validación local

La suite completa del panel aprobó 1.652 pruebas, con cero fallos y dos omisiones existentes. El total incluye las 21 nuevas de convergencia y las 34 del hotfix incorporado; estas últimas no se anuncian como implementadas nuevamente. TypeScript y compilación de producción completos aprobaron.

Las pruebas locales de navegador cubren el aviso de runtime y notificaciones, la consola, la seguridad de lectura de solicitudes y la disponibilidad del circuito. Usan componentes reales con sesiones/transporte sintéticos, sin base de clientes ni cuenta productiva. Los conteos finales y el resultado remoto por commit se registrarán en la evidencia de cierre.

Una aserción inicial esperaba por error que toda la cabecera avanzada coincidiera con la antigua productiva; detectó la diferencia y se reemplazó por la transformación limitada y verificable descrita arriba, no por una copia que perdiera código avanzado. Otra aserción nombraba incorrectamente el archivo del cliente de disponibilidad; se corrigió el nombre contra el árbol real, conservando la comprobación de presencia y hash.

Sólo se retiró la carpeta .next regenerable del checkout anterior antes de compilar, tras comprobar que no estaba versionada ni asociada a un proceso Node de ese worktree. No se borraron fuentes, dependencias, configuraciones, evidencias o datos.

## Puertas de publicación

Este sprint integra y valida una candidata. No solicita un despliegue ni aplica migraciones de Neon. No convierte la aceptación sintética en aprobación del esquema vivo, no amplia roles y no cambia flags.

Pendientes reales: aceptar la identidad de conexión de la API productiva con una sesión global autorizada; conciliar el baseline observado y autorizar/aplicar únicamente el delta 0117–0121; publicar la pareja API/panel compatible con escrituras apagadas y validar los flujos antes de habilitarlos. No ejecutar por diferencia de cantidades las 48 migraciones históricas ausentes del registro inspeccionado.

La corrección productiva de runtime y las consultas fallidas históricas del navegador no demuestran que esos 403 sigan ocurriendo hoy. La revisión de esta candidata protege contra su reintroducción. Los avisos de content scripts o precarga no se dan por resueltos ni se modificaron extensiones o límites de listeners.

### Resultado local cerrado antes del commit

Las cuatro suites locales aprobaron 375 comprobaciones en 37 vistas: acceso/notificaciones 62/6, consola 100/12, seguridad de lecturas 124/7 y disponibilidad 89/12. No se detectaron infracciones de axe ni errores de cliente o solicitudes inesperadas en esos reportes. Se inspeccionó visualmente la pantalla restringida en móvil claro dentro de esta nueva compilación de pruebas.

La auditoría de dependencias, custodia de secretos y controles de formato aprobaron. La comprobación de diff confirmó que API, packages, manifiestos de dependencias, public/release.json y dashboard-release.ts no cambiaron respecto del padre avanzado. El workflow unificado conserva 17 suites de componentes distintas y la aceptación adicional del mapa con servidor Next real (18 invocaciones de navegador en total).

## Cierre verificado en GitHub

Código integrado: `e439c716f9fb093233ff048f44c3955c504f1792`. El commit conserva como padres `7e3b7f9d` y `95e54eae`; no se volvió a desarrollar ni publicar el hotfix anterior como si fuera un incremento nuevo.

GitHub Actions `36103871015`, job `107972012093`, terminó aprobado el 25/09/2026 a las 06:51:22 UTC sobre ese SHA. Incluye checks completos, compilación y las 18 invocaciones de navegador del workflow unido. No hubo omisión de suites para resolver el merge.

Se compararon además, desde ambos commits inmutables, las políticas compartidas de cotización, proveedor, acuse y disponibilidad. Las cuatro coinciden exactamente tras normalizar LF entre el panel `e439c716` y la API candidata `52ffff77`. Esto confirma alineación de esas políticas; no certifica por sí solo toda la compatibilidad de despliegue ni la base productiva.

Las comprobaciones de control de despliegue posteriores al CI confirmaron que producción continúa en panel `cb2a845d` y API `c21a0a77`, ambos READY. No se solicitaron despliegues, no se aplicaron migraciones y no se cambiaron permisos o flags en este sprint.

También se inspeccionó visualmente la captura móvil oscura del borrador conservado tras una bandeja parcial, además del aviso de acceso en móvil claro. Son resultados de componentes con datos sintéticos, no capturas de un cliente productivo.

Evidencia: `docs/releases/2026-09-25-release-convergence-validation.json`. El siguiente commit registra sólo documentación; no sustituye el SHA de código comprobado por el CI. La unificación del panel queda cerrada; la aceptación de la conexión y del delta productivo sigue siendo una puerta independiente.
