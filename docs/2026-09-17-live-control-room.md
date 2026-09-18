# Centro en Vivo / geografía / analítica — dashboard.6

Entrega de interfaz basada en f79c055b920654ff0b4265807a1f4433d0f9bcee.

## Cambios

- Cabecera del CRM compacta y navegación horizontal; herramientas preservadas.
- Modo sala para monitor: KPIs, mapa y últimos eventos comparten la sesión y el stream existentes. No abre un segundo stream ni agrega polling.
- La descripción de empresa, ventana y muestra permanece fuera de paneles plegables.
- Mapa ajustado a la altura disponible, con advertencias expandibles y salida al modo operativo.
- Teléfono, Red/IP y otras fuentes se filtran sin mover eventos ni crear coordenadas.
- Los orígenes declarados del producto/empresa no se presentan como posiciones de un TAP.
- Corrección de la semántica de browser_geolocation_approximate_consent: aproximación reportada, no GPS verificado.
- Analítica vuelve a histórico: se elimina su lectura duplicada de TAP físicos y el montaje de mapas repetidos. Los experimentos geográficos no se montan por defecto.
- Se elimina la llamada automática del resumen a IA; no se presenta como análisis de un proveedor una descripción calculada localmente.

## Alcance de datos

El mapa usa evidencia recibida; las muestras existentes de 50/100 registros no se presentan como todo el histórico. Un NFC pasivo no permite seguimiento GPS continuo. No se inventaron vínculos a pallets, contenedores, comercios o ventas. Integrar la custodia de activos logísticos sigue siendo un circuito separado.

## Evidencia

Suite dashboard: 736 pruebas, 734 aprobadas, 2 omitidas y cero fallos antes de la publicación. Browser local aislado: mapa y filtros, operación de rollos, Analítica sin mapa, entrada/salida de modo sala, claro/oscuro y viewport móvil. Se verifican posición y altura del mapa para evitar que quede oculto por el pie. Los estados sin datos del fixture no son un incidente productivo.

No se modifican API SUN, criptografía, claves, base de datos ni planes. El plan gratuito se conserva. Esta entrega no equivale a certificación integral, carga multinacional ni incorporación de tracking IoT.
Referencia de reversa: dpl_GAebh6uFmSaq9coz3FHb9YVSSr3h.
