# NexID — recuperación de identidad y HERO animados

Base publicada: 79b864d3de593919f1913e9d42e0b880760ff737, versión 2026.10.01-web-visual-refinement.1. El usuario pidió recuperar los logos grandes y animados y el HERO anterior, conservando las demás mejoras aceptadas.

Se recuperan la identidad SVG original y la composición inmersiva de la cabecera, con el celular, el producto y sus señales NFC. Se conservan el texto más claro y la acción al pasaporte de demostración. Los componentes y efectos existentes se reutilizan sin agregar bibliotecas de animación.

Las animaciones deben funcionar en modo normal y detenerse fuera de pantalla, con la página oculta o ante la preferencia de reducir movimiento. La marca compacta estática de SUN y los flujos de lectura, ubicación, mapa, permisos y anti-replay permanecen separados de esta restauración pública.

La carga progresiva, los controles y el orden de Demo Lab, las mejoras de SUN y la navegación aceptada se conservan. No se modifican API, dashboard, paquetes compartidos, datos comerciales ni migraciones.

La revisión visual corrige además dos detalles de la landing: el título de «Cómo funciona» podía quedar cubierto por un fondo degradado en escritorio claro, y el botón de tema medía 42,39 px en la navegación de escritorio amplio. Los ajustes quedan limitados al CSS de esas secciones; el botón conserva su acción y llega a 44 px. En móvil, el fondo del texto y el de la escena recuperada se integran sin un rectángulo de color distinto.

Se exige compilación, pruebas de escritorio y móvil en ambos temas, comprobación real de animaciones y pausa, CI sobre la fuente final, Preview y producción revisada antes de promover ambos dominios. Los costos de carga se comparan con la versión publicada anterior; no se afirma una mejora de velocidad por recuperar las animaciones.

Este documento describe el incremento. La publicación sólo se acredita con el registro separado que vincula fuente, CI, Preview, deployment, ambos aliases y contenido servido. No incluye una nueva certificación física NFC o GPS.
