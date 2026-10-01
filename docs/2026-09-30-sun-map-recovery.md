# SUN: recuperar el mapa sin cambiar su diseño

## Fallo reproducido
El usuario informó que el resto del pasaporte abría algo antes, pero el mapa quedaba en «Cargando cartografía». Se reprodujo con el componente real y MapLibre 6.4.1: llegaban teselas raster, pero el worker que procesa la capa GeoJSON no terminaba de cargar. `style.load` había ocurrido y el temporizador sólo comprobaba ese indicador; por eso podía dejar de actuar aunque el mapa completo no estuviera listo.

MapLibre 6 usa un módulo worker separado que importa `maplibre-gl-shared.mjs`. Su resolución automática relativa al bundle no sirve para esta compilación. La documentación oficial indica servir ambos archivos desde public y configurar la URL del worker antes de construir el mapa: https://maplibre.org/maplibre-gl-js/docs/guides/v5-to-v6-migration-guide/ y https://maplibre.org/maplibre-gl-js/docs/ (apartado Turbopack).

## Corrección
Se copian los dos módulos y la licencia del paquete instalado, sin cambiar sus bytes, a `/maplibre/6.4.1/` durante build/dev. La versión instalada, el manifiesto y la ruta deben coincidir. El mapa configura esa URL de su propio origen antes de construir el renderer. No se agrega CDN, dependencia, permiso, clave ni consulta de ubicación.

El límite de ocho segundos ahora cubre también worker/teselas, no sólo el estilo. Una carga sin ninguna tesela real no se presenta como mapa listo. Si falla, se conserva la información del origen y de la zona y se habilita «Reintentar mapa». El reintento reemplaza solamente el renderer; los callbacks de la instancia anterior no pueden reponer su estado. Un cambio claro/oscuro reutiliza las teselas ya decodificadas de la misma fuente y rearma correctamente la espera.

Se mantienen el motor 6.4.1, la cartografía configurada, estilos, marcadores, zoom, detalles, área de precisión pública y política de no inventar recorridos. No se reintroduce el globo 3D cuando falta una foto. Son dos elementos distintos.

## Pruebas
La regresión inicial, con el motor real, reprodujo carga indefinida y ausencia de mapa listo. Con la corrección se comprueban transferencia bloqueada, error HTTP del raster, worker fallido, reintento, ocho combinaciones de viewport/tema, foco de puntos, cambio de tema y actualización de coordenadas. Las pruebas unitarias comparan los assets publicados byte a byte contra el paquete instalado y preservan origen, versión y ausencia de parámetros de usuario.

Además se abrió el mapa real de Esri con coordenadas sintéticas de prueba: seis teselas, estado ready y área de precisión presente, sin llamar a geolocalización. La imagen se revisó visualmente. Esto no es una lectura física de cliente ni mide la velocidad de su teléfono.

Los resultados finales de CI, número de comprobaciones y publicación se registran en la PR sobre el commit validado. Se conserva el trabajo previo de reducción del CSS en su worktree independiente; no se mezcla con este arreglo urgente. No se modifican API, dashboard, esquema, datos de clientes, firmas SUN ni interruptores comerciales.
