import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleAlert,
  Code2,
  ExternalLink,
  Fingerprint,
  Layers3,
  Network,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { BrandLockup, ThemeToggle } from "@product/ui";

export const metadata = {
  title: "nexID | Brief ejecutivo verificable",
  description: "Brief ejecutivo de nexID: identidad de producto, modelo operativo, pilotos enterprise y evidencia pública verificable.",
};

type PublicProofSnapshot = {
  testnet?: {
    iota?: {
      rpc_verified?: boolean;
      verified_anchor_count?: number | null;
      verified_receipt_count?: number | null;
    } | null;
    polygon?: {
      rpc_verified?: boolean;
      demo_token_id?: string | null;
      owner_custody?: string | null;
      wallet_control_verified?: boolean;
    } | null;
  } | null;
};

async function readPublicProofSnapshot(): Promise<PublicProofSnapshot | null> {
  const configuredApiBase = String(process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "https://api.nexid.lat")
    .trim()
    .replace(/\/$/, "");
  const candidates = [...new Set([configuredApiBase, "https://api.nexid.lat"])];

  for (const apiBase of candidates) {
    try {
      const response = await fetch(`${apiBase}/public/proof/demo-cases`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6_000),
      });
      if (response.ok) return await response.json() as PublicProofSnapshot;
    } catch {
      // The canonical public endpoint keeps local investor demos useful when the local API is offline.
    }
  }
  return null;
}

const revenueLayers = [
  {
    icon: Fingerprint,
    title: "Identidad física",
    body: "QR/GS1, NFC seguro, tamper y encoding por lote según riesgo y margen.",
  },
  {
    icon: Code2,
    title: "Software y API",
    body: "Pasaporte de producto, validación, analytics, CRM, integraciones y operación offline.",
  },
  {
    icon: Building2,
    title: "Rollout enterprise",
    body: "Setup, tenant, políticas, soporte, auditoría y expansión progresiva por planta o mercado.",
  },
  {
    icon: Layers3,
    title: "Capas premium",
    body: "IOTA para evidencia hash-only y Polygon para certificados transferibles cuando el caso lo justifica.",
  },
];

const pilotSteps = [
  ["01", "Modelar", "Producto, lote, riesgo y dato privado."],
  ["02", "Instrumentar", "QR/NFC, encoding y política de lectura."],
  ["03", "Operar", "Taps, alertas, CRM y evidencia auditable."],
  ["04", "Escalar", "ROI, integraciones y rollout por mercado."],
] as const;

export default async function InvestorOnePagerPage() {
  const snapshot = await readPublicProofSnapshot();
  const iota = snapshot?.testnet?.iota;
  const polygon = snapshot?.testnet?.polygon;
  const iotaVerified = iota?.rpc_verified === true;
  const polygonVerified = polygon?.rpc_verified === true;
  const anchors = Number(iota?.verified_anchor_count || 0);
  const receipts = Number(iota?.verified_receipt_count || 0);

  return (
    <main className="investor-brief-page">
      <style>{`
        .investor-brief-page {
          --ib-bg: #030712;
          --ib-band: #08111f;
          --ib-panel: #0d1729;
          --ib-text: #f8fafc;
          --ib-muted: #a8b4c7;
          --ib-line: rgba(148, 163, 184, 0.22);
          --ib-accent: #67e8f9;
          --ib-success: #6ee7b7;
          min-height: 100svh;
          overflow-x: clip;
          background: var(--ib-bg);
          color: var(--ib-text);
        }

        html[data-theme="light"] .investor-brief-page,
        html.theme-light .investor-brief-page {
          --ib-bg: #f4f7fb;
          --ib-band: #ffffff;
          --ib-panel: #f8fafc;
          --ib-text: #0f172a;
          --ib-muted: #52627a;
          --ib-line: rgba(15, 23, 42, 0.16);
          --ib-accent: #0369a1;
          --ib-success: #047857;
        }

        .investor-brief-shell {
          width: min(1180px, calc(100% - 2rem));
          margin-inline: auto;
        }

        .investor-brief-header {
          position: sticky;
          z-index: 50;
          top: 0;
          border-bottom: 1px solid var(--ib-line);
          background: color-mix(in srgb, var(--ib-bg) 90%, transparent);
          backdrop-filter: blur(18px);
        }

        .investor-brief-header__inner {
          display: flex;
          min-height: 4.5rem;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .investor-brief-header__meta {
          display: flex;
          align-items: center;
          gap: .75rem;
        }

        .investor-brief-header__label {
          border-left: 1px solid var(--ib-line);
          padding-left: .9rem;
          color: var(--ib-muted);
          font-size: .68rem;
          font-weight: 900;
          line-height: 1.25;
          text-transform: uppercase;
        }

        .investor-brief-back {
          display: inline-flex;
          min-height: 2.75rem;
          align-items: center;
          gap: .45rem;
          color: var(--ib-text);
          font-size: .76rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .investor-brief-hero {
          position: relative;
          display: flex;
          height: clamp(520px, 64svh, 640px);
          min-height: 520px;
          align-items: center;
          overflow: hidden;
          border-bottom: 1px solid var(--ib-line);
          isolation: isolate;
        }

        .investor-brief-hero__image {
          position: absolute;
          z-index: -2;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 52%;
        }

        .investor-brief-hero__image--light {
          display: none;
        }

        html[data-theme="light"] .investor-brief-hero__image--dark,
        html.theme-light .investor-brief-hero__image--dark {
          display: none;
        }

        html[data-theme="light"] .investor-brief-hero__image--light,
        html.theme-light .investor-brief-hero__image--light {
          display: block;
        }

        .investor-brief-hero::after {
          position: absolute;
          z-index: -1;
          inset: 0;
          background: rgba(2, 6, 23, .44);
          content: "";
        }

        html[data-theme="light"] .investor-brief-hero::after,
        html.theme-light .investor-brief-hero::after {
          background: rgba(255, 255, 255, .5);
        }

        .investor-brief-hero__copy {
          width: min(690px, 64%);
          padding-block: 3.5rem;
        }

        .investor-brief-eyebrow {
          color: var(--ib-accent);
          font-size: .72rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .investor-brief-hero h1 {
          margin-top: 1rem;
          max-width: 680px;
          font-size: clamp(3rem, 5vw, 4.8rem);
          font-weight: 950;
          line-height: 1.02;
        }

        .investor-brief-lead {
          margin-top: 1.25rem;
          max-width: 620px;
          color: var(--ib-muted);
          font-size: 1.05rem;
          line-height: 1.75;
        }

        .investor-brief-actions {
          display: flex;
          flex-wrap: wrap;
          gap: .75rem;
          margin-top: 1.75rem;
        }

        .investor-brief-action {
          display: inline-flex;
          min-height: 3rem;
          align-items: center;
          justify-content: center;
          gap: .55rem;
          border: 1px solid var(--ib-line);
          padding: .65rem 1rem;
          color: var(--ib-text);
          font-size: .78rem;
          font-weight: 950;
          text-transform: uppercase;
        }

        .investor-brief-action--primary {
          border-color: #22d3ee;
          background: #22d3ee;
          color: #062033;
        }

        .investor-brief-proof-strip {
          display: grid;
          max-width: 690px;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 1.75rem;
          border-block: 1px solid var(--ib-line);
        }

        .investor-brief-live-band {
          border-bottom: 1px solid var(--ib-line);
          background: var(--ib-bg);
        }

        .investor-brief-live-band .investor-brief-proof-strip {
          max-width: none;
          margin-top: 0;
          border-block: 0;
        }

        .investor-brief-proof-strip > div {
          min-width: 0;
          padding: .9rem .9rem .9rem 0;
        }

        .investor-brief-proof-strip > div + div {
          border-left: 1px solid var(--ib-line);
          padding-left: .9rem;
        }

        .investor-brief-proof-strip span,
        .investor-brief-proof-strip strong {
          display: block;
        }

        .investor-brief-proof-strip span {
          color: var(--ib-muted);
          font-size: .62rem;
          font-weight: 900;
          text-transform: uppercase;
        }

        .investor-brief-proof-strip strong {
          margin-top: .25rem;
          overflow-wrap: anywhere;
          font-size: .86rem;
        }

        .investor-brief-band {
          border-bottom: 1px solid var(--ib-line);
          background: var(--ib-band);
          padding-block: 4rem;
        }

        .investor-brief-section-heading {
          display: grid;
          grid-template-columns: .75fr 1.25fr;
          gap: 2rem;
          align-items: start;
        }

        .investor-brief-section-heading h2 {
          margin-top: .7rem;
          max-width: 520px;
          font-size: clamp(2rem, 3vw, 3rem);
          font-weight: 950;
          line-height: 1.08;
        }

        .investor-brief-section-heading > p {
          color: var(--ib-muted);
          font-size: 1rem;
          line-height: 1.8;
        }

        .investor-brief-revenue {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 2.5rem;
          border-block: 1px solid var(--ib-line);
        }

        .investor-brief-revenue article {
          min-width: 0;
          padding: 1.4rem;
        }

        .investor-brief-revenue article + article {
          border-left: 1px solid var(--ib-line);
        }

        .investor-brief-revenue svg {
          color: var(--ib-accent);
        }

        .investor-brief-revenue h3 {
          margin-top: 1rem;
          font-size: 1rem;
          font-weight: 900;
        }

        .investor-brief-revenue p {
          margin-top: .55rem;
          color: var(--ib-muted);
          font-size: .83rem;
          line-height: 1.65;
        }

        .investor-brief-proof-grid {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 1px;
          margin-top: 2.5rem;
          border: 1px solid var(--ib-line);
          background: var(--ib-line);
        }

        .investor-brief-proof-column {
          background: var(--ib-panel);
          padding: 1.75rem;
        }

        .investor-brief-proof-column h3 {
          display: flex;
          align-items: center;
          gap: .7rem;
          font-size: 1.1rem;
          font-weight: 950;
        }

        .investor-brief-status-list {
          margin-top: 1.25rem;
        }

        .investor-brief-status-list li {
          display: grid;
          grid-template-columns: 1.4rem 1fr auto;
          gap: .75rem;
          align-items: start;
          border-top: 1px solid var(--ib-line);
          padding-block: 1rem;
        }

        .investor-brief-status-list svg {
          margin-top: .1rem;
          color: var(--ib-success);
        }

        .investor-brief-status-list b {
          display: block;
          font-size: .88rem;
        }

        .investor-brief-status-list small {
          display: block;
          margin-top: .25rem;
          color: var(--ib-muted);
          line-height: 1.5;
        }

        .investor-brief-status-list a {
          color: var(--ib-accent);
        }

        .investor-brief-boundaries {
          margin-top: 1.25rem;
        }

        .investor-brief-boundaries li {
          border-top: 1px solid var(--ib-line);
          padding-block: 1rem;
          color: var(--ib-muted);
          font-size: .86rem;
          line-height: 1.65;
        }

        .investor-brief-pilot {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
          margin-top: 2.4rem;
        }

        .investor-brief-pilot article {
          border-top: 2px solid var(--ib-accent);
          padding-top: 1rem;
        }

        .investor-brief-pilot span {
          color: var(--ib-accent);
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: .68rem;
          font-weight: 900;
        }

        .investor-brief-pilot h3 {
          margin-top: .5rem;
          font-weight: 950;
        }

        .investor-brief-pilot p {
          margin-top: .4rem;
          color: var(--ib-muted);
          font-size: .82rem;
          line-height: 1.6;
        }

        .investor-brief-close {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          padding-block: 3rem;
        }

        .investor-brief-close h2 {
          max-width: 700px;
          font-size: clamp(1.8rem, 3vw, 2.7rem);
          font-weight: 950;
          line-height: 1.12;
        }

        @media (max-width: 900px) {
          .investor-brief-hero__copy {
            width: 78%;
          }

          .investor-brief-section-heading,
          .investor-brief-proof-grid {
            grid-template-columns: 1fr;
          }

          .investor-brief-revenue,
          .investor-brief-pilot {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .investor-brief-revenue article:nth-child(3) {
            border-left: 0;
          }

          .investor-brief-revenue article:nth-child(n + 3) {
            border-top: 1px solid var(--ib-line);
          }
        }

        @media (max-width: 640px) {
          body:has(.investor-brief-page) .helpbot-hint,
          body:has(.investor-brief-page) .helpbot-trigger,
          body:has(.investor-brief-page) .helpbot-panel,
          body:has(.investor-brief-page) .sales-widget-root {
            display: none !important;
            pointer-events: none !important;
          }

          .investor-brief-shell {
            width: min(100% - 1.5rem, 1180px);
          }

          .investor-brief-header__inner {
            min-height: 4rem;
          }

          .investor-brief-header__label,
          .investor-brief-back span {
            display: none;
          }

          .investor-brief-hero {
            height: auto;
            min-height: min(620px, calc(100svh - 8rem));
            align-items: flex-end;
          }

          .investor-brief-hero__image {
            object-position: 58% center;
          }

          .investor-brief-hero::after {
            background: rgba(2, 6, 23, .7);
          }

          html[data-theme="light"] .investor-brief-hero::after,
          html.theme-light .investor-brief-hero::after {
            background: rgba(255, 255, 255, .72);
          }

          .investor-brief-hero__copy {
            width: 100%;
            padding-block: 3rem 2.25rem;
          }

          .investor-brief-hero h1 {
            max-width: 22rem;
            font-size: 2.55rem;
          }

          .investor-brief-lead {
            max-width: 22rem;
            font-size: .94rem;
            line-height: 1.65;
          }

          .investor-brief-action {
            flex: 1 1 10rem;
          }

          .investor-brief-proof-strip {
            grid-template-columns: 1fr;
          }

          .investor-brief-proof-strip > div + div {
            border-top: 1px solid var(--ib-line);
            border-left: 0;
            padding-left: 0;
          }

          .investor-brief-band {
            padding-block: 3rem;
          }

          .investor-brief-section-heading {
            gap: 1rem;
          }

          .investor-brief-section-heading h2 {
            font-size: 2rem;
          }

          .investor-brief-revenue,
          .investor-brief-pilot {
            grid-template-columns: 1fr;
          }

          .investor-brief-revenue article + article,
          .investor-brief-revenue article:nth-child(3) {
            border-top: 1px solid var(--ib-line);
            border-left: 0;
          }

          .investor-brief-status-list li {
            grid-template-columns: 1.4rem 1fr;
          }

          .investor-brief-status-list a {
            grid-column: 2;
          }

          .investor-brief-close {
            align-items: stretch;
            flex-direction: column;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .investor-brief-page *,
          .investor-brief-page *::before,
          .investor-brief-page *::after {
            scroll-behavior: auto !important;
            transition: none !important;
          }
        }
      `}</style>

      <header className="investor-brief-header">
        <div className="investor-brief-shell investor-brief-header__inner">
          <div className="investor-brief-header__meta">
            <Link href="/" aria-label="Volver a nexID">
              <BrandLockup size={42} variant="ripple" theme="dark" />
            </Link>
            <span className="investor-brief-header__label">Brief ejecutivo<br />evidencia live</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/investor-snapshot" className="investor-brief-back">
              <span>Hub inversor</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="investor-brief-hero" aria-labelledby="investor-brief-title">
        <img
          className="investor-brief-hero__image investor-brief-hero__image--dark"
          src="/sdk/verticals/wine-spirits-424-tt.png"
          alt="Botella premium con sello NFC nexID"
          width={1024}
          height={1024}
        />
        <img
          className="investor-brief-hero__image investor-brief-hero__image--light"
          src="/sdk/verticals/light/premium-wine-light.webp"
          alt=""
          aria-hidden="true"
          width={1024}
          height={1024}
        />
        <div className="investor-brief-shell">
          <div className="investor-brief-hero__copy">
            <p className="investor-brief-eyebrow">Identidad de producto · operaciones · evidencia</p>
            <h1 id="investor-brief-title">nexID convierte cada producto físico en una unidad verificable.</h1>
            <p className="investor-brief-lead">
              Infraestructura enterprise para autenticar, operar y conectar productos con clientes sin publicar datos sensibles ni obligar a cada tap a usar blockchain.
            </p>
            <div className="investor-brief-actions">
              <Link href="/demo-lab" className="investor-brief-action investor-brief-action--primary">
                Probar Demo Lab <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/proof/verify" className="investor-brief-action">
                Ver evidencia pública <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="investor-brief-live-band" aria-label="Estado de la evidencia pública de testnet">
        <div className="investor-brief-shell investor-brief-proof-strip" role="status">
          <div>
            <span>IOTA testnet</span>
            <strong>{iotaVerified ? `${anchors} anchors · ${receipts} receipts` : "Comprobación pendiente"}</strong>
          </div>
          <div>
            <span>Polygon Amoy</span>
            <strong>{polygonVerified ? `Token ${polygon?.demo_token_id || "-"} · RPC verificado` : "Comprobación pendiente"}</strong>
          </div>
          <div>
            <span>Privacidad</span>
            <strong>Hash-only público</strong>
          </div>
        </div>
      </section>

      <section className="investor-brief-band" aria-labelledby="business-title">
        <div className="investor-brief-shell">
          <div className="investor-brief-section-heading">
            <div>
              <p className="investor-brief-eyebrow">Tesis comercial</p>
              <h2 id="business-title">No vendemos un chip. Desplegamos una capa operativa.</h2>
            </div>
            <p>
              El wedge comienza con identidad y antifraude. El contrato crece con encoding, SaaS, APIs, analítica, soporte e integraciones. IOTA y Polygon son módulos de evidencia, no el producto completo ni una promesa automática de ROI.
            </p>
          </div>
          <div className="investor-brief-revenue">
            {revenueLayers.map((item) => (
              <article key={item.title}>
                <item.icon className="h-5 w-5" aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="investor-brief-band" aria-labelledby="evidence-title">
        <div className="investor-brief-shell">
          <div className="investor-brief-section-heading">
            <div>
              <p className="investor-brief-eyebrow">Due diligence util</p>
              <h2 id="evidence-title">Lo verificable y sus limites, en la misma pantalla.</h2>
            </div>
            <p>
              Un decisor puede abrir los explorers, comprobar las transacciones de testnet y entender qué dato queda privado. La experiencia separa evidencia técnica, autenticidad física y ownership para evitar claims inflados.
            </p>
          </div>

          <div className="investor-brief-proof-grid">
            <div className="investor-brief-proof-column">
              <h3><BadgeCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" /> Evidencia publica disponible</h3>
              <ul className="investor-brief-status-list">
                <li>
                  {iotaVerified ? <BadgeCheck className="h-5 w-5" aria-hidden="true" /> : <CircleAlert className="h-5 w-5" aria-hidden="true" />}
                  <span><b>IOTA EVM testnet</b><small>{iotaVerified ? `${anchors} Merkle anchors y ${receipts} memos comprobados por RPC.` : "El endpoint no confirmo la red en esta lectura."}</small></span>
                  <Link href="/proof/verify?layer=iota#iota-proof">Abrir <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></Link>
                </li>
                <li>
                  {polygonVerified ? <BadgeCheck className="h-5 w-5" aria-hidden="true" /> : <CircleAlert className="h-5 w-5" aria-hidden="true" />}
                  <span><b>Polygon Amoy</b><small>{polygonVerified ? `NXDT ${polygon?.demo_token_id || "-"}, mint y metadata verificados. Custodia actual: nexID.` : "El endpoint no confirmo la red en esta lectura."}</small></span>
                  <Link href="/proof/ownership">Abrir <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></Link>
                </li>
                <li>
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  <span><b>Privacidad por diseño</b><small>El proof público usa hashes, roots y recibos; no expone UIDs, clientes, documentos ni claves.</small></span>
                  <Link href="/docs">Docs <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" /></Link>
                </li>
              </ul>
            </div>

            <div className="investor-brief-proof-column">
              <h3><Network className="h-5 w-5 text-cyan-400" aria-hidden="true" /> Limites declarados</h3>
              <ul className="investor-brief-boundaries">
                <li>Las transacciones mostradas son de testnet. El paso a mainnet requiere políticas, wallets y contratos de producción.</li>
                <li>El token piloto Polygon sigue bajo custodia de nexID; no prueba control de wallet del comprador.</li>
                <li>Un NFT no autentica por sí solo el objeto físico. Primero debe pasar la política NFC/QR de nexID.</li>
                <li>No publicamos logos de clientes ni testimonios sin autorización. Los casos visibles usan datos neutrales.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="investor-brief-band" aria-labelledby="pilot-title">
        <div className="investor-brief-shell">
          <div className="investor-brief-section-heading">
            <div>
              <p className="investor-brief-eyebrow">Ruta de compra</p>
              <h2 id="pilot-title">Un piloto con decision gates, no una demo sin salida.</h2>
            </div>
            <p>
              El cliente puede comenzar con QR/GS1 y sumar NFC seguro, operación offline, CRM, IOTA o Polygon solo cuando el riesgo y el presupuesto lo justifican.
            </p>
          </div>
          <div className="investor-brief-pilot">
            {pilotSteps.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="investor-brief-shell investor-brief-close">
        <div>
          <p className="investor-brief-eyebrow">Siguiente paso</p>
          <h2 className="mt-2">Ver el flujo, revisar el SDK y definir un piloto medible.</h2>
        </div>
        <div className="investor-brief-actions mt-0">
          <Link href="/sdk" className="investor-brief-action">Revisar SDK</Link>
          <Link href="/?contact=demo&intent=investor_brief#contact-modal" className="investor-brief-action investor-brief-action--primary">
            Agendar reunión <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </main>
  );
}
