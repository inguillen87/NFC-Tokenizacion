# Passport Studio — dashboard.10

Ruta /batches/[bid]/passport, entrada desde expediente del lote.
Requiere la API 2026.09.18-api-passport.1 y protocolo nexid.passport-studio.v1.
No cambia mapas, Centro en Vivo, logística, Usage/estado o experiencia SUN móvil.

Editor: navegación Identidad / Agro / Documentos / Cambios / Historial,
vista previa móvil que no simula autenticidad y separación borrador/publicado.
El contenido inicial se etiqueta sin revisión; no se presenta como publicación
aprobada v0. Los cambios se conservan al navegar secciones. Recargar o salir puede
perder edición local: se advierte y nunca se guarda silenciosamente.

Inicio del circuito es explícito y explica que el editor directo queda bloqueado
para ese lote. Se muestran permisos y la necesidad de un revisor independiente.
Guardar/presentar/revisar/publicar/reabrir usan confirmación y comprobante validado.
La comparación es respecto al contenido publicado. Una restauración de historial
modifica el borrador local, no lo guarda ni publica sin nuevas acciones.
La vista conserva los comentarios de revisión y distingue r (revisión) de versión
publicada. Un conflicto mantiene los campos y ofrece releer con descarte explícito.

## Evidencia

Chromium con Next.js, BFF y servicio editorial reales contra PostgreSQL local;
solo las sesiones de actores son fixtures sintéticos en loopback. Se completó
inicio, edición persistida, presentación, aprobación con otra persona y publicación
real en la base efímera. Se comprobó la segunda revisión y recuperación de contenido.
Escritorio/celular, claro/oscuro, solo consulta por viewer, foco y contraste de la
vista previa. Cero incidencias axe serias/críticas en la superficie probada;
no se afirma una certificación WCAG ni que se haya realizado un TAP físico nuevo.

También se prueba el presentador con respuestas volátiles para fallos de red,
reintentos con mismo identificador, falta de permiso, conflicto, escape de texto
y preservación del contenido local. Estas simulaciones no reemplazan el ensayo
PostgreSQL ni constituyen datos productivos.

No solicita permisos de ubicación, no hace polling, no consulta IA, no cambia
planes. Guardados agregan historial y tienen consumo normal de persistencia;
no se prometen almacenamiento o tráfico ilimitados en Free.

Base dashboard c421fb1c. Reversa dpl_5XQp7aQ7iFHQg9rjCdqLzZfnfyqk.
Desplegar API compatible antes que dashboard; no autoinscribir lotes ni otorgar
permisos. La UI integra únicamente los archivos verificados de esta entrega.
