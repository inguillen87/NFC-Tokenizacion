# NexID web — refinamiento visual y carga de Demo Lab

Base: `5ddce259a4413d5fa60320cef7b2ffc975a8690a`, árbol de la versión publicada `2026.10.01-web-client-experience.1` (`8c12b329`). Trabajo exclusivo en NexID.

## Cambios

- Landing: composición editorial con texto e ilustración separados; texto breve en español, inglés y portugués; acción directa al pasaporte de demostración. La imagen conserva su etiqueta ilustrativa. El recorrido por rubro y las vistas por rol siguen disponibles.
- Marca web: símbolo Ni y nombre nexID planos, sin filtros SVG ni animaciones permanentes. Enlace al inicio con nombre accesible y sin precarga de la landing desde SUN.
- Navegación pública: superficies sólidas, un acento teal y botones consistentes. Menús, destinos, idioma, tema y contacto conservados.
- Demo Lab: siguiente paso junto al producto, selector nativo en móvil y explicación conceptual desplegable. Catálogo, simulaciones, fuentes y distinción entre evidencia real e ilustración conservados.
- La etiqueta de ejecución de Demo Lab conserva su estado y texto, con color legible sobre un fondo opaco en ambos temas. La aceptación incluye la pantalla avanzada NFC real a 320 y 1440 px, además de landing, hub, menú y catálogo desplegado.
- SUN móvil: menos cajas y brillos; tipografía, estados y acciones más legibles en claro y oscuro. Los colores de advertencia y riesgo siguen diferenciados.

## Medición y aceptación

Antes de cambiar producción se midieron `/` y `/demo-lab`: tres cargas con caché vacía por ruta en cada perfil (CPU normal y CPU 4x, latencia 150 ms, descarga 1,6 Mbps), a 390 × 844. Sin interacción, GPS, NFC ni envíos comerciales. Capturas adicionales a 390 y 1440 px, claro/oscuro.

La descarga inicial de Demo Lab incluyó código 3D aunque el visitante no había elegido el cliente avanzado. La carga progresiva separa esa presentación del hub. El ahorro y los tiempos deben informarse sólo a partir del build y del despliegue medidos, con el mismo método. Las diferencias de contenido y la variabilidad de red impiden atribuir todo cambio de tiempo a una única modificación.

Se exige compilación, pruebas web, aceptación responsive de landing/Demo Lab/SUN, accesibilidad, teclado, movimiento reducido, seguridad existente y CI sobre el commit final. Preview y producción tienen controles distintos. Los escenarios SUN de navegador usan contratos sintéticos; no certifican un TAP físico de esta versión.

## Límite de publicación

Versión candidata: `2026.10.01-web-visual-refinement.1`. Este documento describe el cambio, no acredita su publicación. El registro de publicación debe vincular commit, CI, preview, despliegue, alias, contenido servido y capturas.

No hay cambios de ejecución en API, dashboard, claves NFC, anti-replay, permisos, contratos, consentimiento de ubicación, datos comerciales ni migraciones. Ningún resultado simulado se transforma en aceptación física. Los créditos del mapa se conservan.

## Inventario intermedio del build local

El diagnóstico de activos del build local `sX1rRFCR4TLBWhyuJn8pe`, anterior al ajuste del orden a 768 px, observa una carga fría por ruta sin interacción. Los bytes son respuestas JS/CSS propias decodificadas y recomprimidas con gzip nivel 9; no representan la transferencia Brotli del CDN ni una medición de velocidad NFC.

| Ruta | JS antes publicado | JS candidato local | CSS antes publicado | CSS candidato local |
| --- | ---: | ---: | ---: | ---: |
| `/` | 281.301 B | 279.795 B | 250.237 B | 268.191 B |
| `/demo-lab` | 568.622 B | 339.417 B | 243.196 B | 256.671 B |

Demo Lab evita 229.205 B de JS inicial en este inventario. El CSS observado aumenta: 17.954 B en landing y 13.475 B en Demo Lab. La hoja pública general sigue siendo el principal cuello de botella de estilos. La comprobación del despliegue debe repetir el inventario antes de informar cifras publicadas; los tiempos de localhost no se comparan con los del CDN.
