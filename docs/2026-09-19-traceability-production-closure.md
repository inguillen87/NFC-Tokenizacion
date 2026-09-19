# Recorrido del lote — cierre productivo 19/09/2026

## Artefactos publicados

API: 2026.09.19-api-trace.1, 514d3d578f8f6cd14386d6add56e2730d3b4ebf1,
dpl_D46RvBTcasFiRDfeLCB6PaRfaFMm en api.nexid.lat.
Dashboard: 2026.09.19-dashboard.21, 757b3e71f00b6e844565e216dcc2f15b0650c5da,
dpl_Hn95zucM6jputH6R2vzL37Qy3hgM en app.nexid.lat.
Web sin cambio: 2026.09.19-web-consumer.1, e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg en nexid.lat.

Builds READY con proyecto, SHA y gitDirty=0 verificados. Publicación de API
primero y dashboard después, con comparación del alias previo para no pisar
una entrega concurrente. Los tres dominios fueron confirmados tras la promoción.

## Resultado

Lotes y expediente enlazan /batches/[bid]/traceability. La consulta reúne eventos
EPCIS ligados al lote, relaciones por evento y custodia/envíos cuando el rol lo
permite. Permite filtrar fechas UTC, buscar en la selección, abrir referencias
y descargar HTML/JSON de la misma instantánea sin consultas adicionales.
No se creó otro almacén de datos, SDK ni módulo logístico con estado paralelo.

Agrupación, observación, separación y transformación se presentan como declaraciones
históricas, no pertenencia física actual. Se separan fecha declarada y registro.
Los estados actuales de envíos no se atribuyen al período de eventos. Un permiso
de lote no amplía la lectura de logística; los scopes originales se conservan.
Un error de fuente no se muestra como cero movimiento ni permite exportar datos
anteriores como si fueran la nueva consulta.

## Evidencia

895 pruebas de dashboard: 893 aprobadas, cero fallidas y dos omitidas. TypeScript
y build completos. API: siete pruebas específicas, toda la cadena de regresiones
y build aprobados. Gates de secretos aprobados y lockfile sin cambios.
15 escenarios con PostgreSQL real local y el handler de consulta real pasaron,
con eventos/sesiones sembrados sintéticamente y registro GS1 real de prueba.
No son ensayos físicos de un lector ni una nueva certificación del endpoint de
captura EPCIS. Los ensayos verificaron aislamiento, límites, referencias,
fechas, proyección mínima, fallos de fuente y conservación de tablas.

Siete comprobaciones integradas Next/React/BFF + PostgreSQL y cuatro superficies
1440/390 claro/oscuro aprobadas. Sin errores JavaScript ni hallazgos axe en el
área probada. No equivale a certificación WCAG. HTML exportado renderizado sin
recursos externos, mismo digest que el JSON y sin secretos o metadatos libres.

Comprobaciones posteriores: API health 200, SUN sin parámetros 400, marcadores
API/dashboard correctos y seis pruebas públicas de navegador aprobadas. La ruta
privada sin sesión redirige al login y no contiene el workspace ni datos privados.
La consulta API de staging sin sesión fue rechazada con 403 antes de devolver datos.

## Límite de comprobación privada

El primer intento conectó con el Chrome existente, pero no logró confirmar el
encabezado de la ruta privada antes del timeout. También registró el error
Cannot redefine property: ethereum; en ese intento no se capturó su stack, por
lo que no se atribuye concluyentemente a una extensión ni al producto.
Una segunda conexión CDP fue rechazada con 403 antes de abrir la página.
No se cambió la sesión, contraseña, navegador ni extensiones para eludirlo.
Por tanto la consulta privada productiva de Balmec sigue SIN confirmar en este
cierre. La aceptación funcional completa es la local descrita arriba.

## Preservación y pendientes

No se aplicó ninguna migración. La última registrada sigue siendo 0110.
La comprobación antes/después mantuvo cero eventos EPCIS, un envío global y cero
movimientos de custodia. No se crearon cajas/pallets/envíos de ejemplo en producción.
Balmec conserva diez tags activos, diez inactivos y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Vercel sigue informando Neon Free/free_v3. No se alteraron SUN/SDM, TTStatus,
claves, contadores, Polygon/IOTA o servicios pagos. Los procesos de prueba propios
4315/15716/3215 quedaron cerrados; otros trabajos no se detuvieron.

Límites explícitos: 50 eventos EPCIS, 50 movimientos de custodia, 20 envíos y
100 referencias por evento. No hay paginación profunda ni topología física actual.
Siguen pendientes la prueba con UHF/gateway real y la ampliación SSCC/EPC fuera
del perfil acotado actual. Un enlace del expediente no equivale a capturar datos
que todavía no llegaron al sistema.

Reversa previa API dpl_9LEp6zxrXfMpP6TB2g7rFSqYAzqb y dashboard
dpl_5PWgoZPTDFqtsy4CAcuvVXjjykFX. Esta entrega es sólo lectura de datos existentes.
