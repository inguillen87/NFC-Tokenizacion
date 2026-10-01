# SUN móvil: estados claros, acciones disponibles y carga progresiva

Base publicada verificada: web `989ad2deb343e16e7452d60f4850d38134f09057`, despliegue `dpl_psdLCvDYU3Js6665H9uULJt9wxWd`. La línea web es `codex/nexid-s9-support-web-20260921`, cuya PR 394 se integró en `af58c380`. `main` tiene otra historia: no se usa como base de esta entrega. El checkout principal con cambios paralelos se conserva intacto.

## Problemas y resultado

- La ubicación podía permanecer guardando indefinidamente si no llegaban headers o comprobante. Un presupuesto único de 12 segundos termina la espera. Un fallo de transporte tras enviar queda **sin confirmar**, sin marcar éxito ni repetir una autorización de un solo uso. Sólo un comprobante válido ligado a esta lectura actualiza resumen y mapa.
- El CTA muestra permiso, obtención y guardado como fases distintas. La obtención se presenta como tal sólo si el navegador informa permiso concedido; inspeccionar permisos es opcional y no solicita otra ubicación. No se cambia precisión, consentimiento, edad de medición ni contrato.
- Una lectura bloqueada podía enlazar a instrucciones inexistentes. El destino ahora existe y explica cómo obtener un enlace nuevo desde la etiqueta, sin recargar ni reutilizar el anterior.
- Una foto genérica de vino aparecía en lecturas sin imagen del producto. Las lecturas reales muestran sólo imagen o galería suministrada por su contrato; las imágenes de catálogo quedan en la demo identificada. Una imagen fallida, incluso antes de hidratar React, tiene un fallback neutro y accesible. La primera imagen conserva prioridad; la secundaria es diferida.
- Los formularios de postventa y experiencias se descargaban aunque no se mostraran o estuvieran lejos de la primera pantalla. Ahora se cargan por proximidad, enlace a su sección o botón. Se preservan props, permisos, autorización y estado del formulario; alejarse no desmonta lo escrito. Un error de descarga permite reintentar el recurso sin recargar SUN.
- La navegación evita consultas de todo el documento en cada frame de scroll y comparte un listener y un frame. Invalida geometría al cambiar contenido/tamaño. El dock conserva la separación de controles; navegar con teclado entrega el foco al encabezado. La región oculta usa `inert` real.
- El mapa distingue estar esperando a que el usuario llegue de estar descargando cartografía. Las acciones para enfocar puntos se habilitan cuando el mapa responde. Conserva ampliación, centrado, enlaces externos, créditos y distinción origen/zona/estimación de red.

## Medición y pruebas

Los ensayos usan datos y coordenadas sintéticos. No miden una lectura física ni GPS real; no permiten escrituras productivas.

Baseline live: tres aperturas con caché vacía, viewport 390×844, CPU ×4, 1,6 Mbps y latencia añadida de 150 ms, sobre `/sun?snapshot=0&trace=synthetic&access=invalid`. FCP 3812/3840/3880 ms, mediana 3840 ms. Es una consulta rechazada de sólo lectura, no el recorrido completo desde el chip.

Comparación de JavaScript de la misma ruta: archivos de origen propio comprimidos con el mismo gzip. Baseline publicado 337989 bytes; candidato Next local 319713 bytes, 18276 bytes menos (5,4%). Los chunks de OCR/postventa y experiencias dejaron de estar en la carga inicial. No se compara FCP local con producción: red y servidor son diferentes.

Controles locales registrados: 742 pruebas web, compilación Next de producción y TypeScript; 325 comprobaciones del build real en 48 combinaciones (cerrado, abierto, replay, imagen ausente, imagen fallida y snapshot rechazado; 320/390/768/1440 px, claro/oscuro); accesibilidad del resumen en doce vistas; 135 controles del mapa en dieciséis vistas; recuperación del mapa, estilos completos/reducidos y loading; diecisiete escenarios de ubicación con permisos y entregas colgadas; veintidós controles de carga diferida con persistencia de inputs y nueve sobre el runtime Next real (fallo y reintento de descarga sin repetir SUN ni enviar datos).

La navegación pasó 239 comprobaciones de navegador: modos claro/oscuro, tamaños móviles/escritorio, anclas, teclado, controles dinámicos y transiciones. En el fixture de 30 pasos de scroll, a 390 y 1440 px, las consultas globales de controles pasan de 30 a 0, los frames de navegación de 60 a 30 y los listeners de scroll/resize de dos a uno. Son conteos de trabajo en el ensayo, no una promesa de velocidad en todo teléfono.

La comparación de estilos sigue estricta y el presupuesto de CSS sigue activo. CI añade las pruebas completas de experiencia, navegación y carga diferida a los gates existentes de seguridad, API/SDK y PostgreSQL efímero. Los resultados de CI, preview y publicación se registran al verificarlos.

## Referencia de competencia

Se revisó la [experiencia de información y postcompra de atma.io](https://www.atma.io/post/personalized-engagement-and-product-storytelling-with-item-level-traceability) y la propuesta de [identidad digital de EON](https://www.eon.xyz/). El criterio adoptado es mostrar información útil de producto y acciones de marca según el contexto, con detalle progresivo. No se realizó un benchmark de sus aplicaciones ni se afirma superioridad o menor latencia frente a ellas.

## Límites de esta entrega

Cambios sólo en web SUN, tests, workflow de aceptación web y manifiesto web. No se cambian código ni despliegues de API/dashboard, criptografía, anti-replay, permisos, claves, migraciones o datos de clientes. El build sintético y una preview no certifican un TAP físico. Siguen pendientes lecturas nuevas con sello cerrado/abierto desde teléfonos reales y la medición completa de chip, validación y GPS.

## Publicación

Pendiente de CI y validación de preview al preparar este documento. No se considera publicado hasta verificar el alias, manifiesto, commit y contenido servido. La versión anterior se conserva como reversión.

