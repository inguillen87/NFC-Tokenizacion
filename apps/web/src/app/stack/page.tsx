import { Card, SectionHeading } from "@product/ui";
import { BackLink } from "../../components/back-link";
import { getWebI18n } from "../../lib/locale";

type StackCopy = {
  eyebrow: string;
  title: string;
  description: string;
  layers: Array<{ name: string; question: string; whatItMeans: string; sellAs: string }>;
  compareTitle: string;
  compareRows: Array<{ topic: string; antiFraud: string; passport: string; tokenization: string }>;
  closer: string;
  headers: { topic: string; antiFraud: string; passport: string; tokenization: string };
};

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", StackCopy> = {
  "es-AR": {
    eyebrow: "Pila de valor nexID",
    title: "Antifraude, passport y tokenización no son lo mismo (pero van juntos)",
    description: "La etiqueta NFC segura no tokeniza por sí sola: crea el ancla física confiable para habilitar identidad digital y derechos programables.",
    layers: [
      { name: "1) Carrier", question: "¿Dónde vive la interacción física?", whatItMeans: "NFC, QR o RFID como soporte de lectura.", sellAs: "Infraestructura de contacto y activación." },
      { name: "2) Identity", question: "¿Qué objeto exacto estamos viendo?", whatItMeans: "ID único por unidad (GTIN+serial, UID del chip u otro).", sellAs: "Serialización unitaria confiable." },
      { name: "3) Trust", question: "¿Es genuino y está íntegro?", whatItMeans: "Originality checks, anti-clone y tamper state.", sellAs: "Antifraude operativo + control de canal." },
      { name: "4) Passport", question: "¿Qué historial tiene este objeto?", whatItMeans: "Gemelo digital con eventos, lote, garantía, ownership y trazabilidad.", sellAs: "Cumplimiento, postventa y data comercial." },
      { name: "5) Rights", question: "¿Qué derechos se pueden ejercer?", whatItMeans: "Ownership transfer, perks, vouchers, warranties y redenciones.", sellAs: "Nuevos ingresos y retención." },
    ],
    compareTitle: "Comparativa rápida",
    compareRows: [
      { topic: "Problema que resuelve", antiFraud: "Falsificación y manipulación", passport: "Falta de trazabilidad y contexto", tokenization: "Falta de derechos programables" },
      { topic: "Resultado para operación", antiFraud: "Validar / bloquear", passport: "Registrar / auditar", tokenization: "Transferir / redimir / automatizar" },
      { topic: "Mensaje comercial", antiFraud: "Protegé marca y canal", passport: "Digitalizá el ciclo de vida", tokenization: "Monetizá derechos sobre activos reales" },
    ],
    closer: "nexID crea una sola plataforma para toda la secuencia: Verify → Passport → Rights.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenización" },
  },
  "pt-BR": {
    eyebrow: "Pilha de valor nexID",
    title: "Antifraude, passport e tokenização não são a mesma coisa (mas se conectam)",
    description: "A etiqueta NFC segura não tokeniza sozinha: ela cria a âncora física confiável para habilitar identidade digital e direitos programáveis.",
    layers: [
      { name: "1) Carrier", question: "Onde vive a interação física?", whatItMeans: "NFC, QR ou RFID como suporte.", sellAs: "Infraestrutura de contato e ativação." },
      { name: "2) Identity", question: "Qual objeto exato estamos vendo?", whatItMeans: "ID único por unidade.", sellAs: "Serialização confiável." },
      { name: "3) Trust", question: "É genuíno e íntegro?", whatItMeans: "Checks de originalidade, anti-clone e tamper.", sellAs: "Antifraude operacional." },
      { name: "4) Passport", question: "Qual histórico esse objeto tem?", whatItMeans: "Gêmeo digital com eventos, lote, garantia e ownership.", sellAs: "Compliance, pós-venda e dados." },
      { name: "5) Rights", question: "Quais direitos podem ser exercidos?", whatItMeans: "Transferência, vouchers, perks e redemptions.", sellAs: "Receita incremental e retenção." },
    ],
    compareTitle: "Comparativo rápido",
    compareRows: [
      { topic: "Problema", antiFraud: "Falsificação e violação", passport: "Falta de rastreabilidade", tokenization: "Direitos não programáveis" },
      { topic: "Resultado", antiFraud: "Validar / bloquear", passport: "Registrar / auditar", tokenization: "Transferir / redimir" },
      { topic: "Mensagem", antiFraud: "Proteja marca e canal", passport: "Digitalize o ciclo de vida", tokenization: "Monetize direitos" },
    ],
    closer: "nexID conecta toda a sequência em uma plataforma: Verify → Passport → Rights.",
    headers: { topic: "Tema", antiFraud: "Antifraude", passport: "Passport", tokenization: "Tokenização" },
  },
  en: {
    eyebrow: "nexID value stack",
    title: "Anti-fraud, passport and tokenization are different layers (that work together)",
    description: "A secure NFC label alone does not tokenise the bottle: it provides the trusted physical anchor for digital identity and programmable rights.",
    layers: [
      { name: "1) Carrier", question: "Where does physical interaction happen?", whatItMeans: "NFC, QR or RFID as the touchpoint.", sellAs: "Contact and activation infrastructure." },
      { name: "2) Identity", question: "Which exact object are we looking at?", whatItMeans: "A unique ID per unit.", sellAs: "Unit-level serialization." },
      { name: "3) Trust", question: "Is it genuine and intact?", whatItMeans: "Originality checks, anti-clone and tamper state.", sellAs: "Operational anti-fraud control." },
      { name: "4) Passport", question: "What lifecycle data exists for this object?", whatItMeans: "Digital twin with events, batch, warranty and ownership.", sellAs: "Compliance + after-sales intelligence." },
      { name: "5) Rights", question: "What digital rights can be exercised?", whatItMeans: "Ownership transfer, perks, vouchers and redemption.", sellAs: "New revenue layers." },
    ],
    compareTitle: "Quick comparison",
    compareRows: [
      { topic: "Problem solved", antiFraud: "Counterfeit and tamper", passport: "No lifecycle context", tokenization: "No programmable rights" },
      { topic: "Operational output", antiFraud: "Validate / block", passport: "Record / audit", tokenization: "Transfer / redeem / automate" },
      { topic: "Commercial message", antiFraud: "Protect brand and channel", passport: "Digitize lifecycle", tokenization: "Monetize rights on real assets" },
    ],
    closer: "nexID unifies the sequence in one platform: Verify → Passport → Rights.",
    headers: { topic: "Topic", antiFraud: "Anti-fraud", passport: "Passport", tokenization: "Tokenization" },
  },
};

export default async function StackPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink href="/docs" />
      <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

      <div className="grid gap-4 lg:grid-cols-2">
        {copy.layers.map((layer) => (
          <Card key={layer.name} className="p-6">
            <p className="text-sm font-semibold text-cyan-200">{layer.name}</p>
            <p className="mt-2 text-sm text-white">{layer.question}</p>
            <p className="mt-2 text-sm text-slate-300">{layer.whatItMeans}</p>
            <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">{layer.sellAs}</p>
          </Card>
        ))}
      </div>

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

      <Card className="p-6 text-sm text-emerald-200">{copy.closer}</Card>
    </main>
  );
}
