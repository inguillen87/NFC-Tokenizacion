# Base geográfica de referencia

`world-reference.geojson` deriva del mapa público Natural Earth Admin 0 — Countries, escala 1:110 millones. Su procedencia, transformación, commit original y hashes están en `world-reference.provenance.json`.

Natural Earth publica sus datos en dominio público y permite uso comercial, modificación y redistribución sin permiso ni atribución obligatoria: https://www.naturalearthdata.com/about/terms-of-use/

Las 177 geometrías conservan todas las entidades de ese archivo original; esta escala omite algunos estados e islas pequeños. Es una vista general, sin calles ni precisión parcelaria, con los límites de facto del productor del mapa. Los puntos de demostración y el destino de navegación de la viña tienen fuentes y etiquetas independientes.

NexID sirve este archivo estático desde su propio origen. El mapa de referencia no requiere mosaicos, fuentes o sprites externos ni consultas dependientes de la ubicación del visitante.
