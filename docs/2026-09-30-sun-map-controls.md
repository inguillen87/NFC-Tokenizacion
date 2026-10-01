# SUN — controles de mapa explícitos y apertura externa

## Alcance y aclaración del usuario
Continuación de la web publicada `6f238914`, base integrada `bec0e776101b052768d9fee61ce341c8dbf78023`. El usuario aclaró que «Ver ambos puntos» sí centraba, pero esperaba abrir una aplicación de mapas. Antes de cambiar código se verificó ese centrado en cuatro anchos con cámara desplazada: diez comprobaciones aprobadas. No se presenta esta entrega como reparación de un botón roto.

## Interacción
«Centrar puntos» reencuadra el mapa de NexID; «Ampliar mapa» aumenta el lienzo dentro del pasaporte y «Reducir mapa» lo devuelve a su tamaño. Se conserva la misma instancia WebGL, sus puntos, worker y cartografía. Los márgenes se calculan con las dimensiones reales del lienzo. Escape reduce la vista o cierra el selector externo y mantiene el foco en el control correspondiente.

«Abrir en Google Maps» distingue salir del pasaporte de centrar o ampliar. Con origen y ubicación consentida se ofrece «Ver ambos en Google Maps»; la aplicación externa puede proponer una ruta, que se rotula expresamente como sugerida, no como recorrido observado del producto. Se conservan además los enlaces por punto a OpenStreetMap.

Sólo se exportan coordenadas ya públicas: el punto del teléfono se redondea a dos decimales; una zona IP abre un área amplia sin marcador preciso ni enlace de ruta. Datos desconocidos, inválidos o demo no generan una comparación externa. No se adjuntan UID, id de evento, firma, capacidad, lote, etiquetas ni URL SUN. No hay precarga, llamada GPS o escritura por abrir el selector. La navegación externa ocurre al tocar el enlace, con noreferrer/noopener y no-referrer.

## Atribución sin aspecto promocional
El crédito de la fuente pasa a una línea breve y legible: © Esri · © OpenStreetMap, enlazada a información de derechos/licencia. La información detallada se conserva y no se elimina la atribución obligatoria. No es una etiqueta trial ni se presenta la cartografía como de autoría propia.

Referencias verificadas: https://developers.google.com/maps/documentation/urls/get-started ; https://osmfoundation.org/wiki/Licence/Attribution_Guidelines ; https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040 .

## Validación local
720 pruebas web y 173 contratos SUN aprobados, TypeScript, custodia de secretos y auditoría. La nueva suite del renderer real aprobó 135 comprobaciones en 16 vistas: móvil/escritorio, claro/oscuro, cámara desplazada, ampliación/reducción, foco, exportación acotada y navegación externa interceptada. Los controles originales de carga/recuperación y los siete casos de consentimiento se mantienen. Las pruebas usan coordenadas y teselas sintéticas; no se envió un TAP físico ni se contactó Google con datos de cliente.

El cambio no toca API, dashboard, esquema, dependencias, permisos, claves o interruptores comerciales. Tampoco se atribuye aquí una reducción del CSS global ni la solución completa de la latencia del TAP. CI y publicación se registran sobre el commit definitivo después de verificarlos.
