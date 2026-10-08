# SUN: propuesta de piloto Syngenta

Ruta propuesta: `/sun?demo=1&profile=syngenta&scenario=closed`. El selector ofrece `closed`, `opened` e `invalid`; admite `lang=es-AR|en|pt-BR` y ambos temas. La galería `/sun` sustituye la tarjeta agroquímica genérica por esta propuesta. Valle Secreto y las rutas anteriores siguen disponibles.

## Información y activos

AMISTAR XTRA se eligió del [catálogo público de Syngenta Argentina](https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra), consultado el 8 de octubre de 2026: fungicida, suspensión concentrada y registro 34011 informado por la marca. Los accesos a [etiqueta](https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2016/08/16/amistar20xtra_etiqueta_4541.pdf) y [hoja de seguridad](https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2024/02/28/AMISTAR%20XTRA_hoja_de_seguridad.pdf) corresponden a los documentos enlazados por ese catálogo. La etiqueta declara 5 litros. La demo no reemplaza esos documentos ni indica dosis o aplicaciones.

Se conservan los bytes de los logos oficiales y una foto argentina del bidón de 5 L publicada por [Agroinsumos Mercofrut](https://www.mercadolibre.com.ar/syngenta-amistar-xtra-fungicida-5-litro/up/MLAU2913854648) en `apps/web/public/sun/syngenta/`. La foto original WebP pesa 24.006 bytes y mide 622 × 1118 px; conserva la marca de agua. `provenance.json` registra URLs, tamaños, dimensiones y SHA-256. Se presenta como referencia comercial: no es evidencia de lote, etiqueta NFC instalada, vigencia del marbete, licencia ni aprobación de Syngenta. No se alteró el envase ni se añadió un chip ficticio a la foto.

## Experiencia y límites

La ficha tiene documentos directos, un recorrido conceptual de envasado/distribución/consulta y una actividad local de tres pasos. Los textos son específicos de este producto y están traducidos. La actividad explica dónde consultar etiqueta, seguridad y qué implica un sello abierto; no guarda respuestas ni concede premios.

El lote `DEMO-SYN-001`, sello y lectura son muestras. No hay UID, contador físico, eventos de cadena, GPS, sensores, autenticación, compra ni beneficios reales. La apertura no demuestra falsificación. La lectura inválida ilustra el bloqueo de acciones protegidas conservando la documentación pública.

Se propone NTAG 424 DNA TagTamper sobre el cierre del bidón, con detalle técnico colapsado y fuente [NXP AN12196 §6.5](https://www.nxp.com/docs/en/application-note/AN12196.pdf). El chip pasivo requiere activación NFC para medir; el montaje debe validarse físicamente y dificultar corte/reunión del circuito entre lecturas. La presentación no demuestra ese montaje ni certifica composición química.

La selección depende del modo demo resuelto después de las reglas de entrada SUN. Los marcadores NFC/QR/snapshot conservan su precedencia. No se modifica el catálogo interno de Demo Lab, AgroDppExperience, API, dashboard, permisos, contratos ni controles NFC/anti-replay. El asistente de Valle Secreto permanece acotado a vino; Syngenta no recibe un sommelier ni recomendaciones agronómicas generadas.

## Verificación y publicación

Las pruebas del modelo comprueban fuentes fijas, estados y ausencia de permisos/evidencia física. La suite `syngenta-demo.browser.mjs` ejecuta un servidor Next real y recorre galería, estados, documentos y actividad en tres idiomas, dos temas y anchos de 320, 390 y 1440 px. Registra fallos de red/consola, desbordamientos, targets táctiles, foco, comprobaciones AXE y ausencia de GPS/APIs de negocio. La detección automática de accesibilidad no constituye certificación WCAG.

Este documento describe el cambio de código, no confirma por sí solo su publicación. La entrega del workspace debe registrar por separado commit/tree, CI, Preview, build de producción sin dominios, promoción, aliases y QA canónica. Sin aceptación física ni piloto contratado atribuido a Syngenta.
