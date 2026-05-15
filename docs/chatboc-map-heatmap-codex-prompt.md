# Codex prompt para chatboc.ar: mapas de calor premium

Quiero mejorar los mapas de calor de chatboc.ar para gobiernos, empresas, colegios y organizaciones. No quiero una maqueta estatica ni depender de Google Maps/MapLibre con APIs caras. Necesito un motor visual propio, profesional y vendible, que muestre datos por barrio/zona con filtros por categoria, rango de edad, genero, rubro, estado del caso, fecha y prioridad.

Objetivo de producto:
- Convertir datos operativos en una historia clara para decisores: donde ocurre, que segmento afecta, como evoluciona y que accion se recomienda.
- Crear una vista premium con heatmap vectorial, clusters, rutas/flujo cuando aplique, ranking de barrios y panel de insights.
- Mantener performance mobile/desktop, sin solapamientos, con buena accesibilidad y sin depender de iframes externos.

Implementacion esperada:
1. Revisar el repo y ubicar componentes actuales de mapas, dashboards, filtros y fuentes de datos.
2. Crear o mejorar un componente reutilizable de mapa vectorial propio con:
   - puntos georreferenciados,
   - intensidad/heat por cantidad o severidad,
   - clusters por barrio,
   - seleccion de zona,
   - panel de evidencia con metricas clave,
   - leyendas claras por categoria y riesgo.
3. Agregar filtros ergonomicos:
   - barrio/zona,
   - categoria,
   - rango de edad,
   - genero,
   - fecha,
   - estado,
   - entidad/tenant.
4. Mostrar informacion "jugosa" para vender:
   - top barrios,
   - crecimiento semanal,
   - segmentos mas afectados,
   - alertas de concentracion,
   - recomendacion accionable,
   - impacto estimado.
5. Verificar con build y navegador local en desktop y mobile. Capturar problemas de layout, textos cortados, mapas vacios o filtros rotos.

Criterio de calidad:
- Debe verse como una plataforma premium de inteligencia territorial, no como un dashboard generico.
- Debe funcionar con datos demo aunque no haya datos reales.
- Debe explicar la historia en segundos para inversores, funcionarios, empresas y equipos operativos.
