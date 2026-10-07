import type { StyleSpecification } from "maplibre-gl";

/** Local overview geography. No tiles, glyphs, sprites or remote coordinate requests. */
export function sunReferenceMapStyle(light: boolean): StyleSpecification {
  return {
    version: 8,
    sources: { geography: { type: "geojson", data: "/sun/valle-secreto/world-reference.geojson", attribution: '© <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> · mapa de referencia' } },
    layers: [
      { id: "reference-ocean", type: "background", paint: { "background-color": light ? "#dcebef" : "#102c3a" } },
      { id: "reference-land", type: "fill", source: "geography", paint: { "fill-color": light ? "#f4efe2" : "#273c3c", "fill-outline-color": light ? "#8dada6" : "#637d77" } },
      { id: "reference-vineyard-region", type: "fill", source: "geography", filter: ["in", "name", "Chile", "Argentina"], paint: { "fill-color": light ? "#d7e8d6" : "#30574d", "fill-opacity": 0.8 } },
      { id: "reference-borders", type: "line", source: "geography", paint: { "line-color": light ? "#799790" : "#819e94", "line-width": 1.2 } },
    ],
  };
}
