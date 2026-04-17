import Link from "next/link";
import { ProductExitLink } from "../../components/product-exit-link";
import { InvestorSnapshotClient } from "./investor-snapshot-client";

type Slide = {
  title: string;
  bullets: string[];
};

const slides: Slide[] = [
  {
    title: "1) Thesis",
    bullets: [
      "nexID convierte productos físicos en activos verificables, trazables y operables.",
      "No crypto-first: primero anti-fraude + trazabilidad enterprise.",
    ],
  },
  {
    title: "2) Problem",
    bullets: [
      "QR estático + serial copiable + prueba por foto/email no escala.",
      "Resultado: fraude, postventa perdida y cero first-party lifecycle data.",
    ],
  },
  {
    title: "3) Solution",
    bullets: [
      "NFC + software + API de validación + dashboard multi-tenant.",
      "Capa premium opcional: ownership, warranty, provenance y tokenización.",
    ],
  },
  {
    title: "4) Revenue now",
    bullets: [
      "Hardware encodeado + setup/rollout + SaaS + API + soporte.",
      "Canal reseller/white-label para distribución y expansión.",
    ],
  },
  {
    title: "5) Product identity layer",
    bullets: [
      "Digital Product Passport con eventos reales por unidad.",
      "Estados de lifecycle y señales comerciales accionables.",
    ],
  },
  {
    title: "6) Use cases",
    bullets: [
      "Wine/spirits premium, events/credentials, cosmetics, agro/pharma.",
      "Cada vertical usa el mismo core con diferentes niveles de seguridad.",
    ],
  },
  {
    title: "7) Moat",
    bullets: [
      "Data graph de batch + scan + tamper + claims + ownership.",
      "Switching costs operativos por onboarding, manifests y validación.",
    ],
  },
  {
    title: "8) Why now",
    bullets: [
      "Dolor real enterprise (fraude/trazabilidad) + costo tecnológico viable.",
      "Blockchain dejó de ser narrativa base y pasó a capa opcional útil.",
    ],
  },
  {
    title: "9) Optional blockchain layer",
    bullets: [
      "Blockchain-ready, no chain-locked: anchoring opcional según ROI.",
      "Sin lenguaje NFT/DeFi hype en producto comercial.",
    ],
  },
  {
    title: "10) 12-month roadmap",
    bullets: [
      "0-3m: cierre supplier flow + mobile preview público + hardening demo.",
      "3-12m: rollout pago, reseller motion, ownership/provenance/warranty reales.",
    ],
  },
  {
    title: "11) GTM",
    bullets: [
      "B2B enterprise-first con entrada por pain operativo medible.",
      "Expansión LATAM por vertical y canal reseller.",
    ],
  },
  {
    title: "12) Raise narrative",
    bullets: [
      "Capital para producto enterprise, integraciones y sales motion B2B.",
      "Upside: optional digital-asset layer cuando el caso de negocio lo justifica.",
    ],
  },
];

export default function InvestorSnapshotPage() {
  return (
    <main className="container-shell py-10 text-slate-100">
      <section className="rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.13),transparent_40%),#020617] p-6 shadow-[0_30px_80px_rgba(2,6,23,.65)]">
        <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Investor Snapshot</p>
        <h1 className="mt-2 text-3xl font-semibold">enterprise anti-fraud + traceability SaaS</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Core enterprise hoy, optional blockchain-ready layer mañana. Sin humo DeFi, con lógica comercial,
          operativa y de expansión.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide) => (
            <article key={slide.title} className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-white">{slide.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                {slide.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/sun" className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
            Open SUN validation center
          </Link>
          <ProductExitLink kind="demoLab" className="rounded-lg border border-violet-300/35 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">
            Open Demo Lab
          </ProductExitLink>
          <Link href="/?contact=quote&intent=investor_snapshot#contact-modal" className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
            Request investor meeting
          </Link>
          <Link href="/investor-one-pager" className="rounded-lg border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            Open one-pager page
          </Link>
        </div>

        <InvestorSnapshotClient />
      </section>
    </main>
  );
}
