# SUN visual 1 — candidato

Este incremento continúa desde `6eaa0a4b002ffccc00da36f7fe072bdec187f4ba` (el código WEB publicado .8 más su cierre documental). Sólo cambia la presentación de SUN, su manifiesto y pruebas. La publicación anterior y sus registros quedan preservados.

## Cambios

- Identidad Ni con el trazado existente, detalles locales y mayor tamaño. El estado de espera y el encabezado comparten la misma marca, sin agregar librerías ni fuentes remotas.
- Foto del resumen con mayor espacio, sin filtro o sombra aplicada. La ficha conserva el encuadre completo de la imagen suministrada.
- Carga, decodificación y fallo por fuente; ninguna foto de catálogo reemplaza una imagen ausente.
- Ampliación accesible mediante diálogo nativo. Reutiliza el bitmap cargado, acotado a 2048 píxeles por eje; no vuelve a solicitar la imagen. Escape, cierre y retorno de foco.
- Jerarquía coherente entre nombre del producto, ficha y etiquetas. La preferencia de movimiento reducido cubre todo el pasaporte; las entradas decorativas son breves y finitas.

## Límites

Las comprobaciones locales usan contratos y fotos SVG sintéticos. No certifican un TAP físico ni GPS, autenticidad, origen, contenido o sello del producto. No hay cambios de API, dashboard, validación NFC, anti-replay, consentimiento, permisos, contratos, dependencias o migraciones.

El primer arranque del focal no abrió navegador porque usaba una ruta obsoleta de Sharp. La captura baseline2 sí recorrió 48 contextos del build anterior; terminó rechazada por 42 comparaciones de punto flotante sobre un interlineado real de 1.12 y dos expectativas incorrectas de traducción EN. Esas causas observadas se corrigen prospectivamente en el harness y el resultado original se conserva. El manifiesto público ya había cambiado a `.1` al tomar esa baseline; ese dato no identifica su build de UI anterior ni se usa como prueba de publicación.

CI, Preview y producción de este incremento están pendientes. La versión `.8` permanece publicada hasta la aceptación de esta fuente.

## Verificación local del candidato

La fuente final aprobó build y typecheck. Pasaron 799 pruebas WEB, 47 controles de carga SSR (ocho vistas), 144 controles del componente de imagen (seis contextos) y 1.102 controles del pasaporte compilado (48 vistas: cinco anchos, tres idiomas y dos temas). El focal además observó seis reflows equivalentes a 200%; no son pruebas de zoom nativo. Axe dentro del visor y en encabezado/resumen no reportó infracciones en las vistas revisadas.

El primer candidato del visor se rechazó: Tab trasladaba el foco al documento. Se corrigió el ciclo entre sus controles y se conservaron las 30 fallas originales de candidate1. Candidate2 conserva los controles y aprueba todos; sus capturas iniciales preceden a la interacción, con dos capturas del visor abierto y seis del reflow identificadas aparte.

No se demuestra una ganancia causal de rendimiento. Se conserva la biblioteca de animación que entra por el loading global; este incremento no agrega fuentes remotas ni una biblioteca nueva. La ampliación aprobó el control de cero peticiones adicionales de la foto.

La primera CI de este incremento rechazó una prueba API que inspecciona el JSX WEB: esperaba `priority` como última propiedad de la imagen. Se conservó esa convención ordenando `zoomable` antes de `priority`, sin cambiar la semántica, los contratos o el código API. La CI y preview de ese SHA inicial quedan registradas como intentos anteriores; la publicación exige nueva CI y build de la fuente corregida.
