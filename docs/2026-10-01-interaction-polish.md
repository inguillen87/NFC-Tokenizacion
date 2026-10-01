# NexID — detalles de interacción del cliente

Base publicada: `bfb72c1eb971cedd3e6b2301a340ab14cb499ceb`, versión `2026.10.01-web-brand-hero-motion.1`. Se conserva la identidad visual que el usuario aprobó, incluidos los logos grandes y el HERO animado.

Este incremento corrige detalles concretos de la experiencia pública y del pasaporte SUN:

- Navegación: foco de teclado visible en ambos temas y cierre del menú móvil con devolución de foco según la acción. Cerrar el menú y seguir un enlace tienen destinos de foco diferentes. El foco inicial del menú respeta una opción que el usuario ya haya enfocado dentro de él. Al llegar al pasaporte desde otra página, espera la carga del documento y sus fuentes antes de enfocar el título; una interacción nueva o la restauración del historial tiene prioridad.
- Demo Lab: volver a elegir el producto activo conserva el paso y la acción elegida. Cambiar de producto y reiniciar el recorrido conservan su comportamiento de empezar de cero.
- Ubicación SUN: el estado que permite reintentar distingue un fallo al guardar de un fallo al medir. El botón anuncia el reintento y el texto sobre red/IP sólo describe una estimación cuando está disponible. Los resultados inciertos y la necesidad de un TAP nuevo siguen sus controles existentes.
- Opinión del cliente: las estrellas anuncian la selección, tienen áreas de interacción de 44 px y muestran el foco. La etiqueta del comentario está asociada al campo y el botón dice «Enviar opinión». Se elimina el lenguaje interno de tenant y CRM de este panel. La tipografía del comentario llega a 16 px en móvil y 14 px en escritorio.
- Las pestañas del panel de la marca se adaptan al ancho y a la cantidad permitida de opciones. En pantallas pequeñas, el icono y el texto se apilan; los nombres usan capitalización normal y las etiquetas largas pueden ocupar más de una línea dentro de su columna. Esto corrige el desplazamiento interno que cortaba el texto a 320 px, incluso con las diferencias tipográficas observadas en CI, sin ocultar opciones ni alterar sus permisos.
- Los controles «Qué se comparte» y reabrir la ubicación alcanzan 44 px de alto.

Las pruebas deben incluir las interacciones reales de teclado, navegación y reinicio, conservación del borrador y ausencia de envíos al seleccionar estrellas o cambiar de panel. Las respuestas de ubicación y opinión utilizadas en pruebas locales son sintéticas; se identifican como tales. Las pruebas de Next local usan el contrato SUN sintético identificado. Las verificaciones remotas en Preview y dominios públicos usan contenido servido y no fabrican respuestas API ni realizan escrituras comerciales.

Se conservan API, dashboard, paquetes compartidos, contratos, seguridad NFC, anti-replay, permisos, consentimiento y datos comerciales. No hay migraciones ni certificación nueva de TAP físico o GPS.

El plazo máximo del trabajo CI pasa de 20 a 30 minutos para completar la matriz de pruebas. Los presupuestos de carga y los criterios de aceptación permanecen iguales. No se afirma una mejora de velocidad por este pulido: se registran los costos de carga con la misma metodología de la versión publicada y se informan las observaciones por separado.

Queda pendiente estudiar la separación de la entrada de marca estática de SUN y la marca pública animada. El grafo compilado conserva módulos compartidos de arte y movimiento, pero eso no demuestra que pueda ahorrarse una biblioteca completa. Este incremento no hace esa separación ni atribuye un ahorro sin medirlo.

Este documento describe el cambio candidato. La publicación sólo queda acreditada por el registro separado que vincula fuente, pruebas, CI, Preview, deployment, ambos dominios y contenido servido.
