# S7 — Publicación y aceptación observada

Verificado el 18/09/2026 a las 21:24 Argentina (19/09 00:24 UTC).

## Artefactos activos
API `2026.09.18-api-campaigns.1`: commit ef6cbcdc8261824ba75371c944719cabeb6a9f45, deployment dpl_8uji3xDYQiWAFX7S41zVYrmeKJbv, api.nexid.lat.
Dashboard `2026.09.18-dashboard.17`: commit 903d72628c89481a42a232c81b72957eef723b00, deployment dpl_CnzSem2eqGVxjB1BMZQVPFB8ijzb, app.nexid.lat.
Web pública sin cambio: dpl_DZtDvciZMLTC6k1VBvgkpJWHxM5u, `2026.09.18-web-recalls.2`.
API y dashboard fueron verificados READY con gitDirty=0 y promovidos después de comprobar los alias anteriores. La pérdida de conexión del CLI de API no fue un fallo del build: se confirmó el artefacto por metadata. La primera subida del dashboard falló antes de crear deployment y se repitió una vez.

## Pruebas ejecutadas
Dashboard: 865 pruebas, 863 aprobadas, cero fallidas y dos omitidas; TypeScript, build y gate de secretos aprobados. No se presentan como pruebas nuevas todas las regresiones existentes.
API: build y regresiones completos aprobados, incluidas siete pruebas nuevas de política S7. Diecisiete escenarios adicionales usan los handlers reales y PostgreSQL 17 local, con sesiones y datos sintéticos.
Navegador local: configurar con respuesta perdida, recuperar el mismo recibo, presentar, aprobar con otra cuenta, simular, descargar informe y recargar. Cuatro variantes 1440/390 claro/oscuro sin incidencias axe reportadas en la superficie ensayada. No equivale a certificación de accesibilidad.
Después de promover: seis casos públicos de navegador aprobados; salud de API 200, SUN sin parámetros 400, consulta de campañas sin sesión 401 y ruta privada protegida. No se usó una URL NFC válida para consumir un contador.

## Lectura privada real
Se abrió /campaigns/review?tenant=demobodega en el Chrome ya autenticado del titular. La fuente real devolvió 200, protocol nexid.campaign-launch.v1, scope demobodega y un borrador. Se abrió su detalle y se comprobó dispatchEnabled=false. No se ejecutó POST/PATCH/DELETE de negocio.
El borrador existente está archivado; su lectura no lo restaura ni lo aprueba. Para un ensayo nuevo se utiliza un borrador activo guardado desde el editor anterior.
El navegador del titular también emitió `Cannot redefine property: ethereum`. No impidió la consulta o apertura del detalle. No se aisló su origen y no se afirma ausencia total de errores de ese navegador ni se modificó su wallet.

## Conservación y costo
La migración aditiva 0107 se aplicó con comprobación del hash de ambas funciones respecto del SQL probado. Se confirmaron cero planes configurados y cero operaciones de revisión productivas tras las comprobaciones; se conservaron un borrador y cuatro registros de consentimiento.
Balmec conserva 10 etiquetas activas y 10 inactivas; hash de sdm_config f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90, igual al inicial. No cambió el verificador, las claves, TTStatus, SDK, GS1/QR ni los retiros.
Vercel confirma Neon nfc-token-api en Free/free_v3. Esta fase no llama a proveedores de mensajes ni realiza cargos de mensajería. Sí usa las lecturas/escrituras normales de la base cuando se consulta o simula; no promete infraestructura gratuita a cualquier escala.

## Alcance pendiente
Aprobación y presupuesto son para el ensayo, no una autorización de entrega ni un límite a la factura real. Restan proveedor y plantilla aprobados, supresiones, consentimiento al despachar, reserva y límite real de gasto, envío idempotente y resultados reconciliados. La entrega completa de S7 no se declara terminada.
