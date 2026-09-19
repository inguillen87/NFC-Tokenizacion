# Recorrido del lote — aceptación de la combinación productiva vigente

Verificación: 19 de septiembre de 2026.

## Artefactos activos, no los candidatos alternativos

API 2026.09.19-api-trace.1:
514d3d578f8f6cd14386d6add56e2730d3b4ebf1,
dpl_D46RvBTcasFiRDfeLCB6PaRfaFMm, api.nexid.lat.
Dashboard 2026.09.19-dashboard.21:
757b3e71f00b6e844565e216dcc2f15b0650c5da,
dpl_Hn95zucM6jputH6R2vzL37Qy3hgM, app.nexid.lat.
Web 2026.09.19-web-consumer.1 conservada:
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg, nexid.lat.

Durante el trabajo se detectó una publicación concurrente del mismo tramo del
plan. El control previo al despliegue rechazó sobrescribirla. Se conservaron los
artefactos activos, que incluyen custodia, lectura logística por permiso y una
única consulta SQL. Los candidatos 64349d8e/8d8396a3 quedaron en sus ramas y NO
constituyen lo desplegado. No se mezclaron los dos contratos o interfaces.

Se cargaron las revisiones productivas exactas en los worktrees aislados propios,
se repitieron sus pruebas y se contrastaron de nuevo los dominios. No se alteraron
los worktrees concurrentes ni se emitió otro despliegue sólo por cambiar la evidencia.

## Recorrido publicado

Desde Lotes o el expediente: /batches/[bid]/traceability. Tres vistas: Recorrido,
Relaciones por evento y Envíos vinculados. Permite filtrar fechas UTC (1 a 93 días,
inclusivos), buscar GTIN, lote, serie o envío sobre la consulta y abrir la evidencia
del movimiento. Seleccionar relaciones y cambiar pestañas no vuelve a consultar.

Los eventos EPCIS distinguen observación, agrupación, separación, asociación y
transformación. Se conservan momento declarado, momento registrado, cantidades
con unidad, roles de referencias y advertencias de corrección/error. Los vínculos
abren el expediente del lote registrado; no se inventan cajas o pallets a partir
del nombre ni se reconstruye su pertenencia actual por una cadena incompleta.

Los movimientos de custodia y los envíos se muestran solamente cuando la cuenta
tiene el acceso logístico correspondiente. El vínculo es a través de los precintos
de este lote; no asegura que los artículos transportados correspondan al lote.
El estado de envío es actual al consultar y se presenta separado del período.

HTML autónomo y JSON comparten la misma instantánea y SHA-256. No existe descarga
CSV en esta revisión productiva. No se ejecutan scripts ni recursos remotos en el
informe. Cambiar las fechas retira datos y exportaciones hasta otra consulta válida.

Interfaz claro/oscuro, cronología, relaciones padre/hijo y entradas/salidas,
filtros locales, foco visible y desplazamiento al detalle en móvil con movimiento
reducido. No altera otros módulos ni genera capturas, gastos o mensajes al abrir.

## Pruebas repetidas sobre las revisiones activas

API: build completo y regresiones aprobados, incluidas siete pruebas específicas.
Dashboard: TypeScript y build aprobados; 895 pruebas, 893 aprobadas, cero fallidas
y dos omitidas. Ambos controles de secretos pasaron.

15 escenarios con PostgreSQL real local y handler real de consulta: referencias
por lote, deduplicación, ADD/OBSERVE/DELETE, transformación, tiempos, UOM, permisos,
alcance ajeno, fuentes ausentes, proyección sin secretos, referencias no autorizadas,
ubicaciones sensibles, límites y conservación de datos. Los eventos se sembraron
como datos sintéticos en el esquema local. No se probó ingesta de un lector físico.

Siete comprobaciones de navegador Next/React/BFF con PostgreSQL real pasaron:
relaciones y correcciones, transformación, búsqueda local, permisos logísticos,
exportación e integridad, cambio de fechas, caída de fuente y tenant ajeno.
Cuatro casos visuales 1440/390, claro/oscuro sin hallazgos axe en la superficie.
El informe HTML se renderizó sin red externa. No equivale a certificación WCAG.

Se usaron puertos propios 4311/3211/15722, no los de otros procesos concurrentes.
El script de navegador se copió a Temp con esos puertos y su localizador inicial
se limitó al panel visible: el encabezado general y el del panel tienen el mismo
título. No se modificó código de la aplicación para conseguir la aceptación.
Las sesiones son un adaptador sintético local, no la sesión productiva del titular.

## Verificación de producción y preservación

Se confirmaron los tres aliases antes del cierre. API health 200, SUN sin
parámetros 400, markers públicos 200 y consulta privada del recorrido sin sesión
401. Seis comprobaciones públicas de navegador pasaron.

El intento de abrir el panel en el Chrome autenticado del titular fue rechazado
por el canal de control remoto CDP con 403 antes de abrir una página. No es una
respuesta de la aplicación de NexID y no confirma ni niega los permisos de su
cuenta. Esa comprobación privada queda sin confirmar; no se intentó deshabilitar
seguridad del navegador ni cambiar su sesión para eludir el rechazo.

La consulta productiva posterior conserva cero eventos EPCIS, cero vínculos de
identificadores, cero identidades GS1 y un envío global. Balmec mantiene diez tags
activos, diez inactivos y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se añadieron datos de ejemplo para llenar su recorrido vacío.

La integración de Neon continúa en Free/free_v3. No se aplicó una migración,
no se alteró el verificador SUN, claves, contadores, TTStatus, QR/GS1, portal del
consumidor, campañas, SDK o transacciones Polygon/IOTA. Las lecturas de sesión
conservan su comportamiento normal; el servicio nuevo no escribe eventos.

El cierre es un visor operativo y una exportación sobre registros reales, no una
integración física UHF terminada, topología actual, paginación histórica ilimitada
ni una captura visual de nuevos movimientos. Esos siguientes trabajos permanecen
separados en el plan original.
