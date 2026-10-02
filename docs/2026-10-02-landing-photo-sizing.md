# SUN y fotos de la landing: candidata revisada

Versión candidata: `2026.10.02-web-consumer-details.2`. Este documento describe cambios de fuente; no acredita CI ni publicación.

Las opciones progresivas y el foco del mapa de la PR #401 permanecen en esta fuente. Aquella PR se integró mediante `cbe3696c5b73aa0b52e5c51fda688386432ab360`, con el mismo árbol de la candidata `b5c9796f5aceb322f211e7094aefd9512e8f4f13`. Su promoción se revirtió: en nexid.lat una de 44 comparaciones visuales exactas falló en la foto del segundo paso de la landing en portugués. Los registros originales permanecen en el espacio de trabajo anterior. No se atribuye una causa a ese fallo.

La landing declaraba un tamaño de imagen de 29vw en escritorio, aunque el espacio de cada foto termina limitado por el contenedor, el selector lateral, las tres columnas, sus separaciones, padding y bordes. En las observaciones anteriores de 1440 px, una foto ocupaba aproximadamente 261 px y solicitaba la variante de 640 px. Este cambio permite declarar el tamaño desde el componente de IndustryJourney, donde esa geometría corresponde, y conserva el valor anterior por defecto para los otros consumidores del componente.

La declaración de escritorio desde 1181 px expresa la geometría del contenedor. Las ramas móviles y tablet, el recorte, los estilos, las animaciones, los filtros y las imágenes de origen se conservan. La selección de variantes y su peso deben comprobarse sobre un build real, incluyendo DPR1 y DPR2. Los tamaños de payload de variantes previamente observadas no representan por sí solos una mejora de carga total ni de tiempo.

La comprobación local del build real pasó en ocho combinaciones: 1440 y 1920 px, claro y oscuro, DPR1 y DPR2. Las 24 fotos conservaron sus dimensiones; el navegador solicitó 384 px con DPR1 y 640 px con DPR2. Los tres payloads WebP de 384 px sumaron 13.486 bytes; las variantes de 640 px sumaron 26.624 bytes. Son observaciones de respuestas de imagen locales, con las fotos ya cargadas para su inspección: no representan el tráfico inicial de una página publicada, una medición de tiempo o una causa del fallo visual previo.

Una prueba de diagnóstico separada mantuvo fuente, imagen, dimensiones y overlays, y comparó 16 casos predefinidos de filtro, posición y transformación del contenedor en dos procesos de Chrome. No reprodujo el fallo visual anterior. No se modifica CSS por una hipótesis no demostrada. Esta corrección de tamaños responde al exceso de resolución comprobado; no acredita resolver retrospectivamente aquel fallo.

API, dashboard, cartografía, seguridad NFC, anti-replay, permisos, consentimiento y contratos conservan sus implementaciones. No hay migraciones ni operaciones comerciales. La aceptación exige una nueva identidad de fuente, CI, Preview, Stage y comprobaciones posteriores de los dominios. Un TAP físico de esta versión no está certificado.
