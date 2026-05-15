# Prompt Codex para chatbot.ar / mapas de calor premium

Usa este prompt en el repo de chatbot.ar para aplicar el mismo criterio visual y de producto a mapas de calor para gobiernos, empresas y colegios.

```text
Actua como senior product engineer y frontend/data-viz designer. Quiero mejorar los mapas de calor de chatbot.ar para que se vean premium, interactivos y utiles para decisiones reales, sin depender de Google Maps, Mapbox pago ni maquetas estaticas de MapLibre.

Objetivo:
- Crear un modulo reutilizable de mapas de calor por barrios/zonas para gobiernos, empresas, colegios y organizaciones.
- Debe permitir analizar volumen, riesgo, demanda, reclamos, turnos, incidentes, conversaciones o asistencia por zona.
- Debe filtrar por categoria, rango de edad, genero, periodo, canal, barrio, tenant y estado.
- Debe sentirse como una herramienta profesional de inteligencia territorial, no como un mapa decorativo.

Primero inspecciona el repo:
- Ubica frontend, dashboard, componentes de mapas/graficos, modelos de datos, endpoints y tests existentes.
- Reutiliza el stack actual. No agregues dependencias pesadas si no son necesarias.
- Si existen GeoJSON/topojson de barrios, usalos. Si no existen, crea una capa demo local con poligonos simples y deja claro donde conectar datos reales.

Implementacion esperada:
- Motor visual propio con SVG/canvas/WebGL ligero, sin tiles pagos.
- Capa de barrios: choropleth por intensidad, borde, etiqueta y hover.
- Capa heatmap: halos/gradientes por densidad, normalizada por poblacion si hay datos.
- Capa puntos: eventos agregados, no PII.
- Capa comparativa: antes/despues o dos segmentos lado a lado.
- Panel de filtros: categoria, edad, genero, periodo, canal, zona, tenant y estado.
- Leyenda clara: escala, total de eventos, barrios activos, alertas y confianza del dato.
- Tooltip profesional por barrio: total, tasa, top categorias, variacion, muestra minima y recomendacion operativa.
- Estados vacios y de carga bien disenados.
- Mobile usable: filtros colapsables, mapa legible, tooltip como bottom sheet.

Privacidad y seguridad:
- No mostrar datos personales.
- Agregar umbral minimo por celda/barrio. Si hay menos de 10 registros, mostrar "muestra insuficiente".
- Evitar reidentificacion por combinaciones de edad/genero/categoria.
- Preparar el codigo para anonimizar o agrupar datos por rangos.

Datos demo:
- Crear seed local para al menos 8 barrios y 4 categorias.
- Categorias ejemplo gobierno: seguridad, salud, turnos, reclamos, espacios publicos.
- Categorias ejemplo empresa: ventas, soporte, riesgo, visitas, leads.
- Categorias ejemplo colegio: asistencia, consultas, convivencia, becas, comunicacion familiar.
- Rangos de edad: 0-12, 13-17, 18-29, 30-44, 45-64, 65+.
- Genero: femenino, masculino, no informado/otro. La UI debe permitir ocultar este filtro si el tenant no lo usa.

UX/UI:
- Buscar una estetica premium: mapa oscuro/claro, alta legibilidad, contornos finos, halos profesionales, controles compactos.
- No usar cards dentro de cards. El mapa debe ser la pieza principal.
- Los filtros tienen que ser obvios y rapidos.
- El usuario debe entender en 5 segundos: donde hay mas actividad, que categoria domina y que accion conviene tomar.
- Agregar microinteracciones: hover, seleccion de barrio, transicion de filtros y playback temporal si es razonable.

Entregables:
- Componente reusable del mapa.
- Datos mock o adaptador a datos reales existente.
- Integracion en dashboard o pagina principal correspondiente.
- Tests/chequeos basicos para filtros, privacidad de muestra minima y render sin datos.
- Build exitoso.
- Verificacion visual en navegador desktop y mobile.

No terminar con una propuesta solamente: implementa, prueba y deja el resultado navegable.
```

Notas de arquitectura recomendada:
- Preferir GeoJSON local propio o generado por backend para barrios.
- Si el volumen crece, usar agregacion server-side por barrio/periodo/segmento.
- Para muchos puntos, binning por grilla o agregados por poligono antes de renderizar.
- Para exportes, agregar PNG/PDF despues de estabilizar la vista interactiva.
