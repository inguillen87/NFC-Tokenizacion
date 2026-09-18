# S6 piloto — estado de publicación, 18 de septiembre de 2026

## Preparado, probado y enviado a GitHub

API candidata: ffc2ae84950b062ec86d28cf2bcebacc0fc9fcf3,
2026.09.18-api-pilot.1, deployment dpl_CfPfG6fzor5EnwBrr2QsHzD13tHH.
Dashboard candidato: 6c32614c4b8cb96e192db2fee4a3691f82ffb551,
2026.09.18-dashboard.15, deployment dpl_2t98DJY5kpQonaMdb5S7yJ2oTG16.
Ambos se enviaron con --prod --skip-domain y metadatos gitDirty=0.
NO se ejecutó promote. La ruta nueva /analytics/pilot todavía no está publicada.

## Bloqueo observado

A las 18:33 aproximadamente (Argentina), ambos deployments seguían QUEUED.
No habían terminado un build remoto que pueda aceptarse y promoverse.
Vercel informa el incidente Elevated Errors Triggering Deployments, iniciado
18/09/2026 a las20:32UTC y actualizado a las20:56UTC, todavía en investigación:
https://www.vercel-status.com/incidents/bwkmw4hmrgmk
La coincidencia es consistente con el bloqueo; no se afirma un diagnóstico interno
individual del proveedor. No se crearon deployments duplicados ni se cancelaron trabajos ajenos.
Tampoco se cambió de proveedor ni se aumentó un plan para sortearlo.

## Producción comprobada, sin reemplazo

https://app.nexid.lat/release.json: HTTP200, 2026.09.18-dashboard.14.
https://api.nexid.lat/release.json: HTTP200, 2026.09.18-api-channels.1.
API /health:200; /sun sin parámetros:400, rechazo esperado (no es un TAP físico).
Un intento de releer el alias por Vercel API falló durante el incidente; se
contrastaron los marcadores HTTP actuales. No se da por validado el reporte
privado productivo: el código candidato no está promovido.

La integración Vercel/Neon nfc-token-api sigue available con billingPlan Free/free_v3.
Balmec: DEMO-2026-02, perfil ntag424_dna_tt, estado active,10 tags activos y10inactivos.
Hash de su configuración antes y después idéntico:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No hubo modificaciones a tags, claves, contadores, producto o estado del precinto.

## Validación terminada y pendiente

Local: 857 tests del dashboard aprobados,2omitidos y0fallidos (859total),
seis nuevos tests de API, diez casos del servicio en PostgreSQL real desechable,
pruebas integradas de generación/exportación/permisos/fallos y cuatro variantes
visuales sin incidencias axe en la superficie evaluada. Builds y gates de secretos
locales correctos. HTML/CSV/JSON derivan del mismo snapshot y no consultan al exportar.

Pendiente: READY de ambos artefactos, verificación de proyecto/SHA, health y
protección de rutas; volver a comparar los dominios con las bases esperadas antes
de promover API y luego dashboard. Si otro trabajo avanzó producción, comparar
las revisiones y reconciliar; nunca sobreescribirlo usando un baseline viejo.
Finalmente: comprobar la generación y descarga en la sesión real autorizada del
cliente. El test CDP de lectura/descarga está preparado en el Temp del titular,
pero no se ejecutó contra una ruta inexistente ni se inventó su resultado.
