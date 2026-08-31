import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "apps", "web", "public");
const outputDir = path.join(root, "artifacts", "social", "nexid-brand-patent-announcement");
const backgroundPath = path.join(outputDir, "nexid-innovation-background.png");
const markPath = path.join(publicDir, "nexid-mark-512.png");
const legalClaimsConfirmed = process.argv.includes("--confirm-legal-claims");

await mkdir(outputDir, { recursive: true });

const [background, mark] = await Promise.all([readFile(backgroundPath), readFile(markPath)]);
const backgroundData = `data:image/png;base64,${background.toString("base64")}`;
const markData = `data:image/png;base64,${mark.toString("base64")}`;
const draftHorizontal = legalClaimsConfirmed ? "" : `
  <g>
    <rect x="0" y="592" width="1200" height="36" fill="#9f1239" fill-opacity=".96" />
    <text x="600" y="616" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14" font-weight="850" letter-spacing="1.3" fill="#ffffff">BORRADOR · VALIDAR DATOS LEGALES ANTES DE PUBLICAR</text>
  </g>`;
const draftInstagram = legalClaimsConfirmed ? "" : `
  <g>
    <rect x="0" y="1302" width="1080" height="48" fill="#9f1239" fill-opacity=".96" />
    <text x="540" y="1333" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="850" letter-spacing="1.2" fill="#ffffff">BORRADOR · VALIDAR DATOS LEGALES ANTES DE PUBLICAR</text>
  </g>`;

const commonDefs = `
  <defs>
    <linearGradient id="veil" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".99" />
      <stop offset=".52" stop-color="#ffffff" stop-opacity=".94" />
      <stop offset=".78" stop-color="#ffffff" stop-opacity=".34" />
      <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="ink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0f2745" />
      <stop offset="1" stop-color="#087f82" />
    </linearGradient>
    <linearGradient id="mintLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#0891b2" />
      <stop offset="1" stop-color="#2fe1c3" />
    </linearGradient>
    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#0f2745" flood-opacity=".12" />
    </filter>
  </defs>`;

const wordmark = (x, y, markSize, fontSize) => `
  <image href="${markData}" x="${x}" y="${y}" width="${markSize}" height="${markSize}" />
  <text x="${x + markSize + 15}" y="${y + markSize * 0.68}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="800" fill="#0f172a" letter-spacing="-.8">nex<tspan fill="#0891b2">ID</tspan></text>`;

const statusCard = ({ x, y, width, number, title, body }) => `
  <g transform="translate(${x} ${y})">
    <rect width="${width}" height="82" rx="20" fill="#ffffff" fill-opacity=".88" stroke="#b9dce5" stroke-width="1.5" />
    <circle cx="36" cy="41" r="20" fill="#e8f9f7" stroke="#2fe1c3" stroke-width="1.5" />
    <text x="36" y="47" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="16" font-weight="800" fill="#087f82">${number}</text>
    <text x="70" y="33" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="17" font-weight="800" fill="#0f2745">${title}</text>
    <text x="70" y="57" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="13.5" font-weight="500" fill="#52657b">${body}</text>
  </g>`;

function horizontalSvg(platform) {
  const platformLabel = platform === "linkedin"
    ? "INNOVACIÓN · PROPIEDAD INTELECTUAL"
    : "NEXID · PRODUCTOS CONECTADOS";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="628" viewBox="0 0 1200 628">
  ${commonDefs}
  <rect width="1200" height="628" fill="#f7fbff" />
  <image href="${backgroundData}" x="0" y="0" width="1200" height="628" preserveAspectRatio="xMidYMid slice" />
  <rect width="1200" height="628" fill="url(#veil)" />
  <path d="M0 0H1200V12H0Z" fill="url(#mintLine)" />

  ${wordmark(64, 54, 54, 30)}
  <g transform="translate(64 145)">
    <rect width="360" height="38" rx="19" fill="#eefbfb" stroke="#b9dce5" />
    <circle cx="21" cy="19" r="5" fill="#2fe1c3" />
    <text x="38" y="24" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="12" font-weight="800" letter-spacing="1.55" fill="#52657b">${platformLabel}</text>
  </g>

  <text x="64" y="252" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="58" font-weight="850" letter-spacing="-2.5" fill="url(#ink)">
    <tspan x="64" dy="0">nexID da un</tspan>
    <tspan x="64" dy="62">nuevo paso.</tspan>
  </text>

  <text x="64" y="394" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="750" fill="#0f2745">
    <tspan x="64" dy="0">Registramos la marca nexID y presentamos</tspan>
    <tspan x="64" dy="33">una solicitud de patente de invención.</tspan>
  </text>

  ${statusCard({ x: 64, y: 472, width: 292, number: "01", title: "Marca nexID", body: "Registro completado" })}
  ${statusCard({ x: 370, y: 472, width: 342, number: "02", title: "Invención", body: "Solicitud de patente presentada" })}

  <text x="1136" y="574" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="15" font-weight="800" letter-spacing=".8" fill="#0f2745">nexid.lat</text>
  ${draftHorizontal}
</svg>`;
}

function instagramSvg() {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  ${commonDefs}
  <rect width="1080" height="1350" fill="#f7fbff" />
  <image href="${backgroundData}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMaxYMid slice" />
  <linearGradient id="verticalVeil" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".99" />
    <stop offset=".53" stop-color="#ffffff" stop-opacity=".96" />
    <stop offset=".78" stop-color="#ffffff" stop-opacity=".42" />
    <stop offset="1" stop-color="#f7fbff" stop-opacity=".78" />
  </linearGradient>
  <rect width="1080" height="1350" fill="url(#verticalVeil)" />
  <path d="M0 0H1080V14H0Z" fill="url(#mintLine)" />

  ${wordmark(72, 72, 68, 38)}
  <g transform="translate(72 198)">
    <rect width="392" height="44" rx="22" fill="#eefbfb" stroke="#b9dce5" />
    <circle cx="24" cy="22" r="6" fill="#2fe1c3" />
    <text x="44" y="28" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="14" font-weight="800" letter-spacing="1.65" fill="#52657b">UN NUEVO HITO PARA NEXID</text>
  </g>

  <text x="72" y="355" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="86" font-weight="850" letter-spacing="-4" fill="url(#ink)">
    <tspan x="72" dy="0">nexID da un</tspan>
    <tspan x="72" dy="92">nuevo paso.</tspan>
  </text>

  <text x="72" y="566" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="35" font-weight="760" fill="#0f2745">
    <tspan x="72" dy="0">Registramos la marca nexID</tspan>
    <tspan x="72" dy="48">y presentamos una solicitud de</tspan>
    <tspan x="72" dy="48">patente de invención.</tspan>
  </text>

  <text x="72" y="748" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="24" font-weight="520" fill="#52657b">
    <tspan x="72" dy="0">Seguimos protegiendo la innovación que hace</tspan>
    <tspan x="72" dy="36">más simples, útiles y medibles los productos conectados.</tspan>
  </text>

  ${statusCard({ x: 72, y: 855, width: 430, number: "01", title: "Marca nexID", body: "Registro completado" })}
  ${statusCard({ x: 72, y: 953, width: 500, number: "02", title: "Invención", body: "Solicitud de patente presentada" })}

  <g transform="translate(72 1208)">
    <rect width="936" height="74" rx="24" fill="#0f2745" fill-opacity=".94" filter="url(#softShadow)" />
    <text x="32" y="46" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="19" font-weight="650" fill="#ffffff">Innovación desarrollada en Latinoamérica</text>
    <text x="904" y="46" text-anchor="end" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="19" font-weight="800" letter-spacing=".7" fill="#2fe1c3">nexid.lat</text>
  </g>
  ${draftInstagram}
</svg>`;
}

const exports = [
  { name: "nexid-marca-patente-instagram-1080x1350.png", svg: instagramSvg(), width: 1080, height: 1350 },
  { name: "nexid-marca-patente-facebook-1200x628.png", svg: horizontalSvg("facebook"), width: 1200, height: 628 },
  { name: "nexid-marca-patente-linkedin-1200x628.png", svg: horizontalSvg("linkedin"), width: 1200, height: 628 },
];

for (const item of exports) {
  const outputPath = path.join(outputDir, item.name);
  await sharp(Buffer.from(item.svg))
    .resize(item.width, item.height, { fit: "fill" })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outputPath);
  console.log(path.relative(root, outputPath));
}

if (!legalClaimsConfirmed) {
  console.warn("Borradores generados con aviso legal. Usá --confirm-legal-claims sólo después de verificar la documentación registral y de patente.");
}
