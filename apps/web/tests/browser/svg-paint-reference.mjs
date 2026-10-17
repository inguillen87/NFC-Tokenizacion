const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const PAINT_SERVERS = new Set(["linearGradient", "radialGradient"]);

// Only the captured, uniquely resolved definition replaces a paint URL. All
// other computed CSS and geometry remain untouched, including real differences.
export function normalizeSvgPaintSnapshot({ elements, svgScopes }) {
  const inventories = new Map();
  function inventory(index) {
    if (inventories.has(index)) return inventories.get(index);
    const scope = svgScopes[index];
    if (!scope || !Array.isArray(scope.nodes)) throw Error("SVG paint reference has no owning SVG scope");
    const nodes = new Map(), ids = new Map();
    for (const node of scope.nodes) {
      if (nodes.has(node.key)) throw Error("SVG paint definition has duplicate captured node keys");
      nodes.set(node.key, node);
      for (const attribute of node.attributes) if (attribute.name === "id" && !attribute.namespace) {
        const matches = ids.get(attribute.value) || [];
        matches.push(node); ids.set(attribute.value, matches);
      }
    }
    const result = { nodes, ids }; inventories.set(index, result); return result;
  }
  function definition(scope, id, active, paintServer = false) {
    const matches = scope.ids.get(id) || [];
    if (matches.length !== 1) throw Error(`SVG paint reference must resolve uniquely in the same SVG: ${id} (${matches.length} matches)`);
    const node = matches[0];
    if (node.namespace !== SVG_NAMESPACE) throw Error("SVG paint reference resolved outside the SVG namespace");
    if (paintServer && !PAINT_SERVERS.has(node.tag)) throw Error("Unsupported SVG paint server: " + node.tag);
    return canonicalNode(scope, node, active);
  }
  function referencedValue(scope, value, active) {
    if (!value.toLowerCase().includes("url(")) return value;
    const expression = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
    const parts = []; let offset = 0, match;
    while ((match = expression.exec(value))) {
      const prefix = value.slice(offset, match.index);
      if (prefix.toLowerCase().includes("url(")) throw Error("Malformed SVG paint reference");
      if (prefix) parts.push(prefix);
      const target = (match[1] ?? match[2] ?? match[3]).trim();
      if (!target.startsWith("#") || target.length < 2) throw Error("SVG paint reference is not a local fragment");
      parts.push({ definition: definition(scope, target.slice(1), active, true) });
      offset = expression.lastIndex;
    }
    const suffix = value.slice(offset);
    if (!parts.length || suffix.toLowerCase().includes("url(")) throw Error("Malformed SVG paint reference");
    if (suffix) parts.push(suffix);
    return { svgPaint: parts };
  }
  function canonicalNode(scope, node, active) {
    if (active.has(node.key)) throw Error("Cyclic SVG paint definition");
    const next = new Set(active); next.add(node.key);
    const attributes = node.attributes.filter(attribute => attribute.name !== "id" || attribute.namespace)
      .map(attribute => {
        const { name, namespace, value } = attribute;
        const href = name === "href" || name === "xlink:href";
        if (href && (!value.startsWith("#") || value.length < 2)) throw Error("SVG definition href is not a local fragment");
        return { name, namespace, value: href ? { definition: definition(scope, value.slice(1), next, PAINT_SERVERS.has(node.tag)) } : referencedValue(scope, value, next) };
      }).sort((a, b) => `${a.namespace || ""}|${a.name}`.localeCompare(`${b.namespace || ""}|${b.name}`));
    const content = node.content.map(item => {
      if (Object.hasOwn(item, "text")) return { text: item.text };
      if (item.outsideSvg) throw Error("SVG definition leaves its owning SVG scope");
      const child = scope.nodes.get(item.node);
      if (!child) throw Error("SVG definition has an uncaptured child");
      return canonicalNode(scope, child, next);
    });
    const result = { tag: node.tag, namespace: node.namespace, attributes, content };
    if (node.tag === "stop") {
      if (typeof node.stopStyle?.stopColor !== "string" || !node.stopStyle.stopColor
        || typeof node.stopStyle?.stopOpacity !== "string" || !node.stopStyle.stopOpacity) throw Error("SVG gradient stop is missing computed paint evidence");
      result.stopStyle = { stopColor: node.stopStyle.stopColor, stopOpacity: node.stopStyle.stopOpacity };
    }
    return result;
  }
  return elements.map(({ svgScope, ...element }) => {
    const styles = { ...element.styles };
    for (const property of ["fill", "stroke"]) if (styles[property].toLowerCase().includes("url(")) {
      if (!Number.isInteger(svgScope)) throw Error("SVG paint URL has no owning SVG");
      styles[property] = referencedValue(inventory(svgScope), styles[property], new Set());
    }
    return { ...element, styles };
  });
}
