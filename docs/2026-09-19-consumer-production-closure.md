# Portal y SUN móvil — cierre de producción 19/09/2026

## Release efectivamente publicada

Web 2026.09.19-web-consumer.1:
- Fuente e94720e2519c28f0b2ce32db67bd04be0255a093.
- Artefacto READY dpl_YLYE5Hrok8Dvtm5TnGs8gotTLwtg, gitDirty=0.
- Dominio nexid.lat confirmado sobre ese artefacto tras promoción.
- Una sola construcción remota de la aplicación.

API api-tasks.1 (c27ab01f6716e312c001317618f8ac705f486817,
dpl_EF7fbwNt2JVZuPXFpGLrUjL1Jcw3) y dashboard .19
(d7025b862fb1aed77b3e56e58d79212617c1ba4c,
dpl_CvrjWucm6Qop7PTe6WbR9KpkRMbs) permanecieron sin modificación.
No se aplicó migración, no se cambió versión del SDK, executor o dependencia.

## Verificaciones previas y posteriores

585 pruebas web aprobadas, cero fallidas/omitidas. TypeScript, build completo,
gate de secretos, diff de alcance y release preflight aprobados. Se repitió el
recorrido integrado de 16 comprobaciones con Next real, servicio de retiros y
PostgreSQL 17.10 efímero. La sesión/colección del consumidor y las proyecciones
SUN eran fixtures declarados, no una autenticación real ni una prueba física nueva.
Diez superficies visuales: galería y ficha a 1440/390 en claro/oscuro, y señales
SUN móviles en ambos temas. Sin hallazgos axe graves/críticos; no certificación WCAG.

La navegación pública posterior a publicación comprobó:
- SUN demo móvil en español, inglés y portugués: HTTP 200, tres señales visibles,
  sin consulta a avisos productivos ni escrituras de negocio.
- /me/products anónimo redirige al login sin renderizar la colección privada.
- Entradas /, /demo-lab, /proof/verify y /proof/ownership responden HTTP 200.
Son ocho comprobaciones; las entradas no certifican todos los flujos internos de
las demos, transacciones blockchain, pagos ni dispositivos físicos.
No hubo errores JavaScript ni escrituras en el navegador limpio de estas pruebas.
API /health respondió 200 y /sun sin parámetros respondió 400 como corresponde.

## Sesión existente de Marcelo

Se conectó al Chrome autorizado y abrió /me/products. La página pidió iniciar
sesión de consumidor. No se crearon usuarios ni se reutilizó el acceso de admin
como autorización de una colección personal. La apertura privada de una colección
productiva no quedó verificada; sí lo quedó el flujo local detallado arriba.
Ese Chrome reportó además «Cannot redefine property: ethereum», ausente en las
pruebas de navegador limpio. No se cambiaron wallets o extensiones para ocultarlo.

## Datos y costo preservados

Consulta antes/después de la publicación: Balmec mantiene lote activo TagTamper,
10 etiquetas activas, 10 registros inactivos y 0 retiros. Hash de configuración:
f1702be12212624ba704193348a491e2c01f37d53d7e3535f0f8ce3bb82d3a90.
Vercel continúa informando Neon Free/free_v3 para nfc-token-api. No se activaron
mensajes, IA adicional, contratos, mints, cambios de custodias ni gasto automático.

## Cierre de alcance

Publicado: biblioteca/ficha de producto, avisos actuales bajo demanda, acceso desde
lecturas y tres dimensiones visibles en SUN. Conservadas: fuentes y controles de
TT, GPS opcional, QR/GS1, historial, enlaces al catálogo y servicios existentes.

Documentado para siguientes incrementos, no anunciado como implementado aquí:
producción masiva QR/GS1; conector de lector UHF con EPCIS y prueba física; posventa
y marketplace con estados comerciales reales; evidencias legibles Polygon/IOTA;
recorridos por escenario del Demo Lab. Ver roadmap/2026-09-19-consumer-multicarrier-extension.md.

Rollback web previo: dpl_85svivuUFUyQRPUT7n4jmNxp7Q99. Una reversa de web no requiere
modificar datos o migraciones. La revisión de este documento es sólo evidencia;
no cambia la fuente desplegada indicada al comienzo.
