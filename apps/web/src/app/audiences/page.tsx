import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";

type AudienceCopy = {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{ audience: string; sell: string[]; avoid: string }>;
  investorTitle: string;
  investorBullets: string[];
};

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", AudienceCopy> = {
  "es-AR": {
    eyebrow: "Pitch por audiencia",
    title: "Mismo núcleo, discurso distinto para cada comprador",
    description: "nexID vende una plataforma modular. Cambia el orden del mensaje según quien decide la compra.",
    cards: [
      {
        audience: "Empresas / marcas",
        sell: ["Antifraude y control de canal.", "Passport por unidad para postventa y CRM.", "Ownership, garantía y activaciones premium."],
        avoid: "Evitar arrancar con jerga cripto o tokenización financiera.",
      },
      {
        audience: "Reseller / integrador",
        sell: ["Modelo white-label y multi-tenant.", "Márgenes en setup + hardware + SaaS recurrente.", "Playbooks por vertical (vino, eventos, cosmética, docs)."],
        avoid: "Evitar propuesta sin soporte operativo/comercial.",
      },
      {
        audience: "Gobierno / sector público",
        sell: ["Documentos verificables y cadena de custodia.", "Control de contratistas, accesos y presencia física.", "Registro auditable y arquitectura DPP-ready."],
        avoid: "Evitar venderlo como 'cripto first'.",
      },
      {
        audience: "Cliente final",
        sell: ["Verificación simple: válido, alertado o bloqueado.", "Beneficios concretos: garantía, perks, redención.", "Confianza sin fricción: tap y listo."],
        avoid: "Evitar UX compleja con pasos innecesarios.",
      },
    ],
    investorTitle: "Narrativa para inversores (orden recomendado)",
    investorBullets: [
      "Fase 1: Verify (autenticidad + tamper) como wedge comercial.",
      "Fase 2: Passport (trazabilidad + data + cumplimiento).",
      "Fase 3: Rights (ownership, garantías, vouchers, transferencias).",
      "Fase 4: Registry/Market como expansión selectiva.",
    ],
  },
  "pt-BR": {
    eyebrow: "Pitch por audiência",
    title: "Mesmo núcleo, mensagem diferente para cada comprador",
    description: "nexID é uma plataforma modular. O produto é o mesmo; o discurso muda por perfil de compra.",
    cards: [
      { audience: "Empresas / marcas", sell: ["Antifraude e controle de canal.", "Passport por unidade para pós-venda.", "Ownership, garantia e ativações."], avoid: "Evitar começar com jargão cripto." },
      { audience: "Revendedor / integrador", sell: ["White-label multi-tenant.", "Margem em setup + hardware + SaaS.", "Playbooks por vertical."], avoid: "Evitar oferta sem suporte de operação." },
      { audience: "Governo", sell: ["Documentos verificáveis.", "Presença física e cadeia de custódia.", "Registro auditável DPP-ready."], avoid: "Evitar narrativa 'cripto first'." },
      { audience: "Cliente final", sell: ["Verificação simples por status.", "Benefícios claros (garantia e perks).", "Tap sem fricção."], avoid: "Evitar UX longa e confusa." },
    ],
    investorTitle: "Narrativa para investidores",
    investorBullets: ["Fase 1: Verify.", "Fase 2: Passport.", "Fase 3: Rights.", "Fase 4: Registry/Market seletivo."],
  },
  en: {
    eyebrow: "Audience-based pitch",
    title: "One core platform, different message by buyer",
    description: "nexID is modular. The stack is the same, but the commercial entry point changes by audience.",
    cards: [
      { audience: "Brands / enterprises", sell: ["Anti-fraud and channel protection.", "Unit passport for after-sales and CRM.", "Ownership, warranty and premium activation."], avoid: "Avoid opening with crypto-financial language." },
      { audience: "Reseller / integrator", sell: ["White-label multi-tenant operations.", "Margin mix: setup + hardware + recurring SaaS.", "Vertical playbooks for faster go-to-market."], avoid: "Avoid unsupported partner model." },
      { audience: "Government", sell: ["Verifiable documents and chain of custody.", "Contractor/access/proof-of-presence controls.", "Auditable registry and DPP-ready architecture."], avoid: "Avoid crypto-first positioning." },
      { audience: "End customer", sell: ["Simple trust statuses.", "Real benefits: warranty, perks, redemption.", "Low-friction tap experience."], avoid: "Avoid complex multi-step UX." },
    ],
    investorTitle: "Investor narrative (recommended order)",
    investorBullets: ["Phase 1: Verify.", "Phase 2: Passport.", "Phase 3: Rights.", "Phase 4: Selective Registry/Market expansion."],
  },
};

export default async function AudiencesPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="grid gap-4 lg:grid-cols-2">
        {copy.cards.map((card) => (
          <Card key={card.audience} className="p-6">
            <h3 className="text-lg font-semibold text-white">{card.audience}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {card.sell.map((item) => <li key={item}>• {item}</li>)}
            </ul>
            <p className="mt-4 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">⚠ {card.avoid}</p>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">{copy.investorTitle}</h3>
        <ul className="mt-3 space-y-2 text-sm text-emerald-200">
          {copy.investorBullets.map((item) => <li key={item}>• {item}</li>)}
        </ul>
      </Card>
    </main>
  );
}
