# Dashboard 2026.09.17-dashboard.5 — mapa profesional y operación de rollos

Base de producción: 96ede1445da59661e821f8ffa800a0aca04609f0.
Proyecto: nexid-dashboard. API SUN, web pública, esquemas y planes no se modifican.

## Entrega visible

El mapa original RealtimeMapLibreMap continúa en el CRM; no se quitó.
Se agregó `/analytics/map` con el mismo motor y sus capas de calles, control,
satélite y relieve. Tiene densidad, eventos, proximidad, zoom, pantalla completa,
consulta por empresa/lote/período, búsqueda local y tabla de evidencia.
Analítica muestra este mapa independientemente del resultado de sus agregados,
reutilizando la consulta física existente. Los permisos de analytics y eventos
sensibles se verifican también en el servidor. No se fabrican coordenadas,
consentimientos, personas identificadas ni ventas a partir de un TAP.
La vista dedicada consulta como máximo 100 lecturas por solicitud explícita.
Los filtros dentro de la muestra y cambios de capas no generan polling de DB.
Los filtros de país de Analítica se aplican a la muestra, no alteran los registros.

En Lotes se agregó un selector para abrir la configuración de un rollo existente.
En el detalle: cuatro pasos, ficha comercial común, recepción del manifiesto y
accesos al protocolo de calidad y al mapa del lote. La ficha común guarda solo
campos editados, con confirmación, sin sobrescribir las propiedades de otro rubro.
La ficha avanzada de vino se conserva, separada de la identidad común.

La recepción admite CSV/TXT de hasta 1 MiB: prechequeo, validación del servidor,
confirmación explícita e importación sin activar. La validación se invalida al
cambiar archivo o luego de cinco minutos. No se reintenta automáticamente una
importación incierta ni se permiten excepciones de cantidad en este asistente.

## Evidencia y límites

Browser QA local con servidor sintético enlazado solo a loopback, sin Neon:
mapa renderizado, filtros y capa de eventos, escritorio/móvil sin overflow;
ficha guardada enviando solo `product_name`; validación antes de importar;
checkbox obligatorio; una importación confirmada y `activateImported=false`.
Las capturas de QA son sintéticas; no certifican nuevos TAP físicos.
Tests: `apps/dashboard/tests/map-roll-workspace.test.mjs` y
`apps/dashboard/tests/map-roll.browser.mjs`. Las pruebas de producto continúan
validando los permisos previos. El test estructural del editor fue actualizado
para cubrir las dos superficies de configuración bajo el mismo permiso.

Esta entrega no completa todo Passport Studio ni el onboarding industrial global.
Parte de un lote previamente provisionado. La provisión del chip, los secretos,
la asignación de roles, la aceptación física y la autorización de activación
conservan sus controles. Una tarjeta no aprueba QA ni convierte una demo en datos.
No se habilitan IA, WhatsApp, blockchain por TAP, servidores ni planes pagos.

## Publicación

Compilar y verificar TypeScript, suite dashboard y scanner antes de commit.
Crear un único deployment de dashboard con `--prod --skip-domain`, verificar
`release.json` y login, y promover solo si no cambió el alias activo.
Referencia anterior para reversa de interfaz: dpl_2t5ajgRpv5e4x4MP1H5yFbh8Bdso.
No aplicar migraciones. Confirmar después alias, versión, rutas públicas y Free.

Validación previa confirmada: TypeScript y build Next.js correctos; 728 pruebas,
726 aprobadas, cero fallos y dos omitidas. El control de secretos revisó 2.228
archivos y no detectó material prohibido. Browser local final: mapa con dos
ubicaciones y una lectura sin coordenadas, filtro funcional, ficha guardada,
una importación confirmada sin activación y cero errores JS no capturados.
