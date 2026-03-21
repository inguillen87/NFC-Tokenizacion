import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";
import { ArrowRight, BadgeCheck, Database, Fingerprint, Link2, ShieldCheck, Sparkles } from "lucide-react";

type StackLayer = { name: string; question: string; whatItMeans: string; sellAs: string; icon: "carrier" | "identity" | "trust" | "passport" | "rights" };
type StackCopy = {
  eyebrow: string;
  title: string;
  description: string;
  jumpTitle: string;
  layers: StackLayer[];
  compareTitle: string;
  compareRows: Array<{ topic: string; antiFraud: string; passport: string; tokenization: string }>;
  closer: string;
  headers: { topic: string; antiFraud: string; passport: string; tokenization: string };
  explainTitle: string;
  explainBullets: string[];
  ctaDocs: string;
  ctaDemo: string;
};

const iconMap = {
  carrier: Link2,
  identity: Fingerprint,
  trust: ShieldCheck,
  passport: Database,
  rights: BadgeCheck,
} as const;

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", StackCopy> = {
  "es-AR": {
    eyebrow: "Pila de valor nexID",
    title: "Antifraude, passport y tokenización no son lo mismo (pero van juntos)",
    description: "La etiqueta NFC segura no tokeniza por sí sola: crea el ancla física confiable para habilitar identidad digital y derechos programables.",
    jumpTitle: "Leé la secuencia completa",
    layers: [
      { name: "1) Carrier", icon: "carrier", question: "¿Dónde vive la interacción física?", whatItMeans: "NFC, QR o RFID como soporte de lectura.", sellAs: "Infraestructura de contacto y activación." },
      { name: "2) Identity", icon: "identity", question: "¿Qué objeto exacto estamos viendo?", whatItMeans: "ID único por unidad (GTIN+serial, UID del chip u otro).", sellAs: "Serialización unitaria confiable." },
      { name: "3) Trust", icon: "trust", question: "¿Es genuino y está íntegro?", whatItMeans: "Originality checks, anti-clone y tamper state.", sellAs: "Antifraude operativo + control de canal." },
      { name: "4) Passport", icon: "passport", question: "¿Qué historial tiene este objeto?", whatItMeans: "Gemelo digital con eventos, lote, garantía, ownership y trazabilidad.", sellAs: "Cumplimiento, postventa y data comercial." },
      { name: "5) Rights", icon: "rights", question: "¿Qué derechos se pueden ejercer?", whatItMeans: "Ownership transfer, perks, vouchers, warranties y redenciones.", sellAs: "Nuevos ingresos y retención." },
    ],
    compareTitle: "Comparativa rápida",
    compareRows: [
      { topic: "Problema que resuelve", antiFraud: "Falsificación y manipulación", passport: "Falta de trazabilidad y contexto", tokenization: "Falta de derechos programables" },
      { topic: "Resultado para operación", antiFraud: "Validar / bloquear", passport: "Registrar / auditar", tokenization: "Transferir / redimir / automatizar" },
      { topic: "Mensaje comercial", antiFraud: "Protegé marca y canal", passport: "Digitalizá el ciclo de vida", tokenization: "Monetizá derechos sobre activos reales" },
    ],
    closer: "nexID crea una sola plataforma para toda la secuencia: Verify → Passport → Rights.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenización" },
    explainTitle: "Cómo explicarlo fácil en una reunión o deck",
    explainBullets: [
      "Primero decís qué valida la verdad del objeto: Verify.",
      "Después mostrás cómo se guarda el historial: Passport.",
      "Recién después explicás qué derechos se activan: Rights.",
    ],
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  "pt-BR": {
    eyebrow: "Pilha de valor nexID",
    title: "Antifraude, passport e tokenização não são a mesma coisa (mas se conectam)",
    description: "A etiqueta NFC segura não tokeniza sozinha: ela cria a âncora física confiável para habilitar identidade digital e direitos programáveis.",
    jumpTitle: "Leia a sequência completa",
    layers: [
      { name: "1) Carrier", icon: "carrier", question: "Onde vive a interação física?", whatItMeans: "NFC, QR ou RFID como suporte.", sellAs: "Infraestrutura de contato e ativação." },
      { name: "2) Identity", icon: "identity", question: "Qual objeto exato estamos vendo?", whatItMeans: "ID único por unidade.", sellAs: "Serialização confiável." },
      { name: "3) Trust", icon: "trust", question: "É genuíno e íntegro?", whatItMeans: "Checks de originalidade, anti-clone e tamper.", sellAs: "Antifraude operacional." },
      { name: "4) Passport", icon: "passport", question: "Qual histórico esse objeto tem?", whatItMeans: "Gêmeo digital com eventos, lote, garantia e ownership.", sellAs: "Compliance, pós-venda e dados." },
      { name: "5) Rights", icon: "rights", question: "Quais direitos podem ser exercidos?", whatItMeans: "Transferência, vouchers, perks e redemptions.", sellAs: "Receita incremental e retenção." },
    ],
    compareTitle: "Comparativo rápido",
    compareRows: [
      { topic: "Problema", antiFraud: "Falsificação e violação", passport: "Falta de rastreabilidade", tokenization: "Direitos não programáveis" },
      { topic: "Resultado", antiFraud: "Validar / bloquear", passport: "Registrar / auditar", tokenization: "Transferir / redimir" },
      { topic: "Mensagem", antiFraud: "Proteja marca e canal", passport: "Digitalize o ciclo de vida", tokenization: "Monetize direitos" },
    ],
    closer: "nexID conecta toda a sequência em uma plataforma: Verify → Passport → Rights.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenização" },
    explainTitle: "Como explicar fácil em uma reunião ou deck",
    explainBullets: [
      "Primeiro diga o que valida a verdade do objeto: Verify.",
      "Depois mostre como o histórico é salvo: Passport.",
      "Só depois explique quais direitos são ativados: Rights.",
    ],
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  en: {
    eyebrow: "nexID value stack",
    title: "Anti-fraud, passport and tokenization are different layers (that work together)",
    description: "A secure NFC label alone does not tokenise the bottle: it provides the trusted physical anchor for digital identity and programmable rights.",
    jumpTitle: "Read the full sequence",
    layers: [
      { name: "1) Carrier", icon: "carrier", question: "Where does physical interaction happen?", whatItMeans: "NFC, QR or RFID as the touchpoint.", sellAs: "Contact and activation infrastructure." },
      { name: "2) Identity", icon: "identity", question: "Which exact object are we looking at?", whatItMeans: "A unique ID per unit.", sellAs: "Unit-level serialization." },
      { name: "3) Trust", icon: "trust", question: "Is it genuine and intact?", whatItMeans: "Originality checks, anti-clone and tamper state.", sellAs: "Operational anti-fraud control." },
      { name: "4) Passport", icon: "passport", question: "What lifecycle data exists for this object?", whatItMeans: "Digital twin with events, batch, warranty and ownership.", sellAs: "Compliance + after-sales intelligence." },
      { name: "5) Rights", icon: "rights", question: "What digital rights can be exercised?", whatItMeans: "Ownership transfer, perks, vouchers and redemption.", sellAs: "New revenue layers." },
    ],
    compareTitle: "Quick comparison",
    compareRows: [
      { topic: "Problem solved", antiFraud: "Counterfeit and tamper", passport: "No lifecycle context", tokenization: "No programmable rights" },
      { topic: "Operational output", antiFraud: "Validate / block", passport: "Record / audit", tokenization: "Transfer / redeem / automate" },
      { topic: "Commercial message", antiFraud: "Protect brand and channel", passport: "Digitize lifecycle", tokenization: "Monetize rights on real assets" },
    ],
    closer: "nexID unifies the sequence in one platform: Verify → Passport → Rights.",
    headers: { topic: "Topic", antiFraud: "Anti-fraud", passport: "Passport", tokenization: "Tokenization" },
    explainTitle: "How to explain it simply in a meeting or deck",
    explainBullets: [
      "First explain what validates the truth of the object: Verify.",
      "Then show how lifecycle history is stored: Passport.",
      "Only after that explain which digital rights are activated: Rights.",
    ],
    ctaDocs: "Open docs",
    ctaDemo: "View demo",
  },
};

export default async function StackPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          <Sparkles className="h-4 w-4 text-cyan-300" />
          {copy.jumpTitle}
        </p>
        <div className="flex flex-wrap gap-2">
          {copy.layers.map((layer) => {
            const Icon = iconMap[layer.icon];
            return (
              <a key={layer.name} href={`#${layer.icon}`} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">
                <Icon className="h-3.5 w-3.5" />
                {layer.name}
              </a>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {copy.layers.map((layer) => {
          const Icon = iconMap[layer.icon];
          return (
            <div key={layer.name} id={layer.icon} className="scroll-mt-28">
              <Card className="h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                  <Icon className="h-4 w-4" />
                  {layer.name}
                </p>
                <p className="mt-3 text-base text-white">{layer.question}</p>
                <p className="mt-2 text-sm text-slate-300">{layer.whatItMeans}</p>
                <p className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{layer.sellAs}</p>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.compareTitle}</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-cyan-200">
                  <th className="pb-2 pr-4">{copy.headers.topic}</th>
                  <th className="pb-2 pr-4">{copy.headers.antiFraud}</th>
                  <th className="pb-2 pr-4">{copy.headers.passport}</th>
                  <th className="pb-2">{copy.headers.tokenization}</th>
                </tr>
              </thead>
              <tbody>
                {copy.compareRows.map((row) => (
                  <tr key={row.topic} className="border-t border-white/10 text-slate-300">
                    <td className="py-2 pr-4 text-white">{row.topic}</td>
                    <td className="py-2 pr-4">{row.antiFraud}</td>
                    <td className="py-2 pr-4">{row.passport}</td>
                    <td className="py-2">{row.tokenization}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-white">{copy.explainTitle}</h3>
          <div className="mt-4 grid gap-3">
            {copy.explainBullets.map((item) => (
              <div key={item} className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 transition-transform duration-200 hover:-translate-y-0.5">
              {copy.ctaDocs}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/demo" className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100 transition-transform duration-200 hover:-translate-y-0.5">
              {copy.ctaDemo}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>

      <Card className="p-6 text-sm text-emerald-200">{copy.closer}</Card>
    </main>
  );
}
