import type { Metadata } from "next";
import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { getWebI18n } from "../../lib/locale";
import { buildPublicPageMetadata } from "../../lib/public-page-metadata";
import { PublicSiteHeader } from "../../components/public-site-header";
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
    eyebrow: "Arquitectura explicada simple",
    title: "Del toque del producto al certificado digital",
    description: "La tecnología queda detrás. Para la marca y el comprador, el flujo conecta una lectura del tag con evidencia digital, historia declarada, cuenta del usuario, beneficios y certificado.",
    jumpTitle: "Lee la secuencia completa",
    layers: [
      { name: "1) Contacto", icon: "carrier", question: "¿Como entra el usuario?", whatItMeans: "NFC, QR o RFID como punto de contacto.", sellAs: "El producto abre una experiencia propia." },
      { name: "2) Identidad", icon: "identity", question: "¿Qué identidad digital consulta?", whatItMeans: "Cada unidad registrada referencia un identificador digital único.", sellAs: "La marca deja de mirar solo lotes y empieza a operar unidades registradas." },
      { name: "3) Confianza", icon: "trust", question: "¿Qué evidencia pasó la política?", whatItMeans: "Validación del mensaje, controles anti-replay, estado TT reportado y señales de riesgo.", sellAs: "Control operativo de marca, canal y comprador; no autentica por sí solo el objeto físico." },
      { name: "4) Passport", icon: "passport", question: "¿Qué historia está registrada?", whatItMeans: "Origen y lote declarados, eventos reportados, garantía y ownership digital.", sellAs: "Postventa, auditoría, datos propios y storytelling con fuente visible." },
      { name: "5) Derechos", icon: "rights", question: "¿Qué puede solicitar el usuario?", whatItMeans: "Solicitar ownership, guardar un certificado o iniciar beneficios; una transferencia, venta o NFT requiere un flujo implementado, recibo on-chain y settlement real cuando aplique.", sellAs: "Capacidad futura de fidelización, reventa y marketplace, sujeta a integración y revisión legal." },
    ],
    compareTitle: "Comparativa rapida",
    compareRows: [
      { topic: "Problema que resuelve", antiFraud: "Replay, mensajes inválidos y señales TT", passport: "La unidad registrada pierde contexto al salir de fábrica", tokenization: "No hay solicitud de ownership ni capacidad verificable para preparar derechos digitales" },
      { topic: "Resultado para operacion", antiFraud: "Validar mensaje o exigir revisión", passport: "Registrar, auditar y mostrar datos declarados", tokenization: "Solicitar o preparar derechos; transferencias y ventas quedan pendientes hasta receipt y settlement reales" },
      { topic: "Mensaje comercial", antiFraud: "Protege marca y canal", passport: "Conecta producto y cliente", tokenization: "Prepara valor digital sujeto a implementación" },
    ],
    closer: "nexID une toda la secuencia: leer el tag, validar el mensaje, revisar evidencia, solicitar ownership digital y activar beneficios.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenización" },
    explainTitle: "Como explicarlo facil en una reunion o deck",
    explainBullets: [
      "Primero: el mensaje del tag y la política generan evidencia digital; no prueban por sí solos autenticidad física.",
      "Segundo: el usuario ve datos declarados o reportados y puede solicitar ownership digital.",
      "Tercero: la marca evalúa identidad, compra y política antes de aceptar solicitudes; transferencia o venta requieren integración operativa, recibo on-chain, settlement real y revisión legal.",
    ],
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  "pt-BR": {
    eyebrow: "Pilha de valor nexID",
    title: "Antifraude, passport e tokenização não são a mesma coisa (mas se conectam)",
    description: "A etiqueta NFC segura não tokeniza nem autentica o produto físico sozinha: ela conecta uma leitura do tag à identidade digital e a solicitações de direitos configuráveis.",
    jumpTitle: "Leia a sequência completa",
    layers: [
      { name: "1) Carrier", icon: "carrier", question: "Onde vive a interação física?", whatItMeans: "NFC, QR ou RFID como suporte.", sellAs: "Infraestrutura de contato e ativação." },
      { name: "2) Identity", icon: "identity", question: "Qual identidade digital foi consultada?", whatItMeans: "ID único por unidade registrada.", sellAs: "Serialização no nível da unidade registrada." },
      { name: "3) Trust", icon: "trust", question: "Qual evidência passou pela política?", whatItMeans: "Validação da mensagem, controles anti-replay, estado TT reportado e sinais de risco.", sellAs: "Controle antifraude operacional; não autentica sozinho o objeto físico." },
      { name: "4) Passport", icon: "passport", question: "Qual histórico está registrado?", whatItMeans: "Eventos reportados, lote e origem declarados, garantia e ownership digital.", sellAs: "Evidência para revisão de compliance, pós-venda e dados com fonte visível." },
      { name: "5) Rights", icon: "rights", question: "Quais direitos podem ser solicitados?", whatItMeans: "Solicitar ownership, guardar um certificado ou iniciar benefícios; transferência, venda ou NFT exigem fluxo implementado, recibo on-chain e settlement real quando aplicável.", sellAs: "Capacidade futura de fidelização, revenda e marketplace, sujeita a integração e revisão jurídica." },
    ],
    compareTitle: "Comparativo rápido",
    compareRows: [
      { topic: "Problema", antiFraud: "Replay, mensagens inválidas e sinais TT", passport: "Falta de eventos e contexto reportados", tokenization: "Direitos digitais não programáveis" },
      { topic: "Resultado", antiFraud: "Validar mensagem / revisar", passport: "Registrar / auditar dados declarados", tokenization: "Solicitar ou preparar direitos; transferência e venda aguardam receipt e settlement reais" },
      { topic: "Mensagem", antiFraud: "Proteja marca e canal", passport: "Digitalize o ciclo de vida", tokenization: "Prepare valor digital sujeito à implementação" },
    ],
    closer: "nexID conecta toda a sequência em uma plataforma: ler o tag → validar a mensagem → revisar o Passport → solicitar Rights elegíveis.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenização" },
    explainTitle: "Como explicar fácil em uma reunião ou deck",
    explainBullets: [
      "Primeiro explique o que valida a mensagem e a política: Verify; isso não comprova sozinho a autenticidade física.",
      "Depois mostre como dados declarados e eventos reportados são salvos: Passport.",
      "Só depois explique quais direitos digitais podem ser solicitados; transferência ou venda exigem integração operacional, recibo on-chain, settlement real e revisão jurídica.",
    ],
    ctaDocs: "Abrir docs",
    ctaDemo: "Ver demo",
  },
  en: {
    eyebrow: "nexID value stack",
    title: "Anti-fraud, passport and tokenization are different layers (that work together)",
    description: "A secure NFC label does not tokenise or authenticate the physical product by itself: it connects a tag read to digital identity and eligible digital-right requests.",
    jumpTitle: "Read the full sequence",
    layers: [
      { name: "1) Carrier", icon: "carrier", question: "Where does physical interaction happen?", whatItMeans: "NFC, QR or RFID as the touchpoint.", sellAs: "Contact and activation infrastructure." },
      { name: "2) Identity", icon: "identity", question: "Which digital identity was queried?", whatItMeans: "A unique ID per registered unit.", sellAs: "Registered unit-level serialization." },
      { name: "3) Trust", icon: "trust", question: "Which evidence passed policy?", whatItMeans: "Message validation, replay controls, reported TT state and risk signals.", sellAs: "Operational anti-fraud control; not standalone physical-product authentication." },
      { name: "4) Passport", icon: "passport", question: "Which history is recorded?", whatItMeans: "Reported events, declared batch and origin, warranty and digital ownership.", sellAs: "Evidence for compliance review and after-sales intelligence with visible sources." },
      { name: "5) Rights", icon: "rights", question: "Which digital rights can a user request?", whatItMeans: "Request ownership, save a certificate or start benefits; transfer, sale or NFT require an implemented flow, on-chain receipt and real settlement when applicable.", sellAs: "Future loyalty, resale and marketplace capability, subject to integration and legal review." },
    ],
    compareTitle: "Quick comparison",
    compareRows: [
      { topic: "Problem solved", antiFraud: "Replay, invalid messages and TT signals", passport: "No reported lifecycle context", tokenization: "No programmable digital rights" },
      { topic: "Operational output", antiFraud: "Validate message / review", passport: "Record / audit declared data", tokenization: "Request or prepare rights; transfer and sale remain unavailable until real receipt and settlement" },
      { topic: "Commercial message", antiFraud: "Protect brand and channel", passport: "Digitize lifecycle", tokenization: "Prepare digital value subject to implementation" },
    ],
    closer: "nexID unifies the sequence in one platform: read the tag → validate the message → review Passport evidence → request eligible Rights.",
    headers: { topic: "Topic", antiFraud: "Anti-fraud", passport: "Passport", tokenization: "Tokenization" },
    explainTitle: "How to explain it simply in a meeting or deck",
    explainBullets: [
      "First explain what validates the message and policy: Verify; this alone does not prove physical authenticity.",
      "Then show how declared data and reported events are stored: Passport.",
      "Only after that explain which digital rights may be requested; transfer or sale require operational integration, an on-chain receipt, real settlement and legal review.",
    ],
    ctaDocs: "Open docs",
    ctaDemo: "View demo",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return buildPublicPageMetadata("stack", locale);
}

export default async function StackPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <>
      <PublicSiteHeader />
      <main data-nav-inert className="knowledge-page-surface container-shell space-y-8 py-16">
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} level={1} titleClassName="brand-editorial-gradient" />

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
    </>
  );
}
