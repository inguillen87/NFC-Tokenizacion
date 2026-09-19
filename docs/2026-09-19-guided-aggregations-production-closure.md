# Agrupaciones guiadas — cierre productivo del 19/09/2026

## Combinación exacta publicada

API: 2026.09.19-api-intake.2,
5631b475c77fa5469191a0ce0ea5545f8bbb00ce,
dpl_6vrnMdc1LhCbp2hRuVD5bsYDAKBy, api.nexid.lat.
Dashboard: 2026.09.19-dashboard.24,
375d5d2e15135dc62c95d0493dfbd7042b809072,
dpl_BwWhUCFBUwrWbn25Smpr9z5aGZ9f, app.nexid.lat.
Web conservada: 2026.09.19-web-consumer.1,
e94720e2519c28f0b2ce32db67bd04be0255a093,
dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg, nexid.lat.

Se verificaron los baselines actuales de las tres aplicaciones antes de trabajar:
la admisión de movimientos .23 ya estaba publicada. Se desarrolló una ampliación,
no una segunda versión paralela del motor o del formulario. Los artefactos nuevos
fueron construidos de fuentes limpias, con SHA/proyecto comprobados en Vercel.

## Resultado operativo

Registrar movimientos -> Unidades, cajas y pallets permite seleccionar un
contenedor y de 1 a 49 identidades serializadas del registro autorizado. Agrupar,
separar elementos elegidos y observar son acciones distintas y explícitas.
La búsqueda admite otro lote de la misma empresa; antes de registrar se revalida
cada identidad y se presenta un esquema con padre/unidades para revisión.

La captura usa el motor EPCIS, MFA, permisos, idempotencia y outbox ya existentes.
La separación agrega un evento histórico; no elimina la agrupación anterior,
no borra registros ni demuestra que el contenedor quedó vacío. Los comprobantes
quedan disponibles en la misma sección del usuario después de recargar.

La interacción conserva campos al cambiar de pestaña, no consulta al escribir,
pliega resultados después de validar, enfoca la revisión y permite iniciar otro
movimiento sin borrar la captura confirmada. Claro/oscuro, foco, contraste y
movimiento reducido se evaluaron en la superficie modificada.

## Pruebas completadas

Dashboard: 918 pruebas, 916 aprobadas, cero fallidas y dos omitidas. TypeScript,
build y control de secretos aprobados. API: build y todas sus regresiones pasaron,
incluidas cinco pruebas nuevas del selector. Nueve pruebas del generador y contrato
se incluyen en la suite del dashboard. Dependencias y lockfile sin cambios.

12 escenarios nuevos con PostgreSQL real local y el generador de la UI: selección
50+5, otro lote, límites/alcance, revocación, preview sin captura, seis confirmaciones
simultáneas con un solo comprobante, referencia comercial repetida, separación,
observación y conservación de configuración. Se repitieron además los 16 casos
previos del motor de captura, incluyendo rollback y compatibilidad SDK.

Nueve comprobaciones de navegador con Next/React/BFF y PostgreSQL real pasaron:
preparación/revisión, relación entre lotes, pérdida de respuesta después del commit,
recuperación del mismo intento, descarga, separación y observación, comprobantes
tras recarga, continuación del selector, fallo de fuente y MFA. Se comprobó también
que Preparar otro movimiento limpia sólo la preparación local.
Cuatro variantes 1440/390 claro/oscuro no reportaron incidencias axe en la superficie.
No se afirma certificación WCAG completa. Los eventos, etiquetas y sesiones de las
pruebas eran fixtures locales; no hubo registro de agrupaciones en producción.

## Publicación verificada

Los dos despliegues terminaron READY y se promovieron API primero, luego dashboard,
comprobando antes que los aliases base no hubieran cambiado concurrentemente.
Los dominios finales se consultaron nuevamente y apuntan al par anterior.
El frontend público conserva exactamente su artefacto previo.

La API respondió /health 200, /sun sin parámetros 400 y su marcador .intake.2.
La búsqueda privada sin sesión respondió 401 en el dominio productivo. En staging,
el acceso sin sesión fue rechazado y la página de admisión redirigió al login sin
renderizar la interfaz privada. /novedades respondió 200 y el marcador del dashboard
confirmó .24. Seis comprobaciones públicas de navegador posteriores pasaron.

Se intentó una comprobación privada de sólo lectura en el Chrome existente.
El canal de control remoto CDP rechazó la conexión WebSocket con 403 antes de crear
una página. Esa respuesta no provino de NexID ni confirma un problema de roles.
La comprobación con la sesión productiva del titular queda sin confirmar. No se
modificaron navegador, extensiones, credenciales o permisos para eludir el rechazo.

## Preservación y límites

La base conservó cero eventos EPCIS, cero capturas y la migración máxima 0111.
Balmec conserva 10 etiquetas activas, 10 inactivas y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se crearon GTIN, series, agrupaciones o clientes ficticios para rellenar el
asistente. Un primer uso requiere identidades GS1 autorizadas de esa empresa;
el piloto NFC TagTamper no se convierte automáticamente para poder demostrarlo.

La integración continúa en Neon Free/free_v3. No hay migración, nuevo proveedor,
polling, cambio de plan, campaña paga o transacción Polygon/IOTA en esta entrega.
SUN/SDM, TTStatus, claves, contadores, motores de captura e importación existentes
y aplicación del consumidor permanecen sin cambios.

El cierre permite declarar agrupaciones serializadas, no reconocer físicamente
cajas/pallets o certificar contenido actual. SSCC/EPC de un gateway UHF, lectura de
hardware, cantidades a granel y transformación guiada son alcances independientes.
La importación EPCIS por archivo y el formulario de observación anterior se conservan.

Reversa base API dpl_4LMMe8jTYc9x5gbQdDanhCufqXa9;
dashboard dpl_6QdU9HXBZxAFoYoJhSBDDXAwFQwq. Una reversión de aplicación no debe
borrar las declaraciones que la empresa haya registrado con la herramienta.
