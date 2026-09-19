# Cierre productivo: rectificación y levantamiento de avisos

Fase de gestión de avisos cerrada y publicada el 18 de septiembre de 2026 (Argentina).
No declara completados todos los sprints ni el acuse directo del distribuidor.

## Combinación efectiva publicada

- API: 2026.09.18-api-notices.1, SHA 0388be2505809e45f9261d2ebdb94ea9b166ba13,
  deployment dpl_EwpHrn1ewGMzVbePFefm7Ab6335v, dominio api.nexid.lat.
- Pasaporte: 2026.09.18-web-notices.1, SHA 97200947244ceed362a3eafe5662c2d0a7031dd8,
  deployment dpl_85svivuUFUyQRPUT7n4jmNxp7Q99, dominio nexid.lat.
- Dashboard: 2026.09.18-dashboard.18, SHA 8cc69dd856547982cabbafa2709daf572e68e8f9,
  deployment dpl_7ABCQfAd77ZFo6ZKbxBuvs1xYRq8, dominio app.nexid.lat.

Los tres artefactos están READY, con gitDirty=0 y metadatos de proyecto/SHA
comprobados. Se promovieron API, pasaporte y dashboard en ese orden, después
de verificar los alias previos para no sobrescribir una publicación concurrente.

Migración 20260918224500_0108_recall_notice_reviews.sql aplicada y registrada en
una transacción con timeout y precondición de esquema. Añade tablas de propuesta,
versión pública y comprobantes; no modifica registros de productos o etiquetas.
El cuerpo de la función instalada coincide con el código probado:
ddf8df37c38eac0aabf46298bb38bdcd86f6d0ccb4bd7a5b1b79ab36f64a627f.

## Circuito entregado

Propuesta -> comparación antes/después -> revisión independiente con MFA ->
aplicación atómica -> aviso o resolución visible -> historial e informe.
Levantar el aviso exige seguimiento cerrado. La resolución conserva el aviso
anterior y no equivale a liberar stock, verificar inocuidad o alterar autenticidad NFC.

## Verificación realizada

Dashboard: 868 pruebas aprobadas, cero fallidas y dos omitidas; TypeScript y build.
Web: 571 pruebas aprobadas y build. API: build y regresiones, 46 pruebas de política,
cuatro de contrato y 20 escenarios con PostgreSQL real local. La regresión anterior
de retiros conservó sus 19 escenarios aprobados con el esquema aditivo.
El navegador integrado local probó comparación, pérdida de respuesta, reintento,
aprobación por otra persona, cierre, levantamiento, resolución pública y exportación.
Cuatro variantes visuales (1440/390, claro/oscuro) sin incidencias axe en la superficie
evaluada; no se presenta como una certificación WCAG ni un TAP físico nuevo.

Producción: API /health respondió 200; /sun sin argumentos respondió el 400 esperado.
Avisos públicos v1 y v2 respondieron 200 para Balmec, sin avisos inventados. El BFF
v2 del pasaporte confirmó protocolo y alcance. Se verificó la protección de la
página privada y pasaron seis casos de navegador sobre la release pública.

En el Chrome autenticado del titular se abrió Retiros y cuarentenas de Balmec:
fuente database, consulta 200, tenant demobodega, lote DEMO-2026-02, canRead=true,
canWrite=true y cero casos. El nuevo endpoint privado devolvió el 404 esperado
para un caso inexistente, no un error de permisos o infraestructura. No se creó
un retiro real para completar una prueba y no hubo escrituras de negocio.
La prueba estricta registró un error ethereum; el diagnóstico de procedencia lo
localizó en chrome-extension://.../evmAsk.js, no en código de la plataforma.
Una reconexión Playwright agotó el tiempo; la consulta CDP posterior confirmó
el acceso y la procedencia de esa advertencia. No se modificaron extensiones.

## Conservación y cierre del día

Neon sigue en Free (free_v3); no se cambiaron planes ni tamaños de cómputo.
Después de publicar: cero casos de retiro, propuestas, avisos efectivos y recibos
nuevos. Balmec mantiene 10 etiquetas activas, 10 inactivas y el hash de configuración
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
No se tocaron claves, contadores, TTStatus, usuarios, campañas ni contratos SDK.
Los servicios locales de esta fase se cerraron; otros proyectos quedaron intactos.

Versiones anteriores registradas para incidente previo al primer uso:
API dpl_8uji3xDYQiWAFX7S41zVYrmeKJbv, web dpl_DZtDvciZMLTC6k1VBvgkpJWHxM5u,
dashboard dpl_CnzSem2eqGVxjB1BMZQVPFB8ijzb. Una vez aplicadas rectificaciones reales,
no volver a una API que muestre el aviso original: preferir roll-forward o una
reversión compatible que conserve la proyección vigente. No borrar datos ni retirar
advertencias como mecanismo de rollback. Este registro documental no requiere
otro despliegue: las revisiones de código productivo son las indicadas arriba.
