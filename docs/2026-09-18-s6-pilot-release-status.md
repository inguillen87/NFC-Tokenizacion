# S6 piloto — publicación y aceptación final

## Estado al cierre, 18 de septiembre de 2026

Publicado después de verificar READY y de comparar los aliases con sus bases.
API promovida primero; dashboard después. No se sobrescribió otro release.

API: ffc2ae84950b062ec86d28cf2bcebacc0fc9fcf3,
2026.09.18-api-pilot.1, deployment dpl_CfPfG6fzor5EnwBrr2QsHzD13tHH.
Dashboard: 6c32614c4b8cb96e192db2fee4a3691f82ffb551,
2026.09.18-dashboard.15, deployment dpl_2t98DJY5kpQonaMdb5S7yJ2oTG16.
Metadatos de artefactos: proyecto correcto, SHA correcto, gitDirty=0.
Ruta: /analytics/pilot, con selección explícita de empresa para superadministración
y alcance fijo para clientes. También enlazada desde Analítica y Lotes.

## Verificación productiva realizada

https://app.nexid.lat/release.json: HTTP200, 2026.09.18-dashboard.15.
https://api.nexid.lat/release.json: HTTP200, 2026.09.18-api-pilot.1.
API /health:200; /sun sin parámetros:400, rechazo esperado (no es un TAP físico).
GET del informe sin autenticación:401. Página privada sin sesión: redirección a
login y sin datos del informe en el HTML. Seis casos públicos de navegador pasaron.

La prueba de descarga del informe en el Chrome autenticado del titular no quedó
confirmada: la conexión CDP agotó18segundos antes de abrir la página o emitir
una consulta del reporte. No se toma exit0 del script como prueba positiva;
su archivo de resultado dice status=unconfirmed y reportRequests=0.
No se reinició Chrome, crearon sesiones, copiaron cookies ni alteraron cuentas
para sustituir esa comprobación. La generación/exportación completa está probada
con el runtime real sobre PostgreSQL local, no certificada en esa sesión productiva.

La integración Vercel/Neon nfc-token-api sigue available con billingPlan Free/free_v3.
Balmec: DEMO-2026-02, perfil ntag424_dna_tt, estado active,10 tags activos y10inactivos.
Hash de configuración antes/después idéntico:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No hubo modificaciones a tags, claves, contadores, producto o estado del precinto.
Sin migraciones nuevas ni cambios a la aplicación web pública o al SDK.

## Validación local terminada

857 tests del dashboard aprobados,2omitidos y0fallidos (859total),
seis nuevos tests de API, diez casos del servicio en PostgreSQL real desechable,
pruebas integradas de generación/exportación/permisos/fallos y cuatro variantes
visuales sin incidencias axe en la superficie evaluada. Builds y gates de secretos
correctos. HTML/CSV/JSON derivan del mismo snapshot y no consultan al exportar.

Los servicios temporales propios de prueba en3163/4263/15463 quedaron cerrados.
Los worktrees originales de otros trabajos no se modificaron.

## Historial de la espera de despliegue

A las18:33 aproximadamente ambos artefactos estaban QUEUED, sin promoción.
Vercel mantenía en investigación Elevated Errors Triggering Deployments,
iniciado18/09/2026 a las20:32UTC y actualizado a las20:56UTC:
https://www.vercel-status.com/incidents/bwkmw4hmrgmk
No se afirma que el incidente global se haya resuelto: estos dos builds llegaron
a READY a las18:37 de Argentina y luego superaron la verificación de artefactos.
No se crearon deployments duplicados ni se aumentaron planes ni se cancelaron trabajos ajenos.

Esta entrega cierra el bloque de informe del piloto dentro de S6. No incluye el
circuito de retiro comercial, cuarentenas, aprobaciones, avisos y devoluciones;
ese flujo conserva su propio cierre pendiente, separado de la autenticidad NFC.
