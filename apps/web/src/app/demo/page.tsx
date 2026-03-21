import { Button, Card, SectionHeading } from "@product/ui";
import { LiveDemoSurfaces } from "../../components/live-demo-surfaces";
import { VerticalDemoLibrary } from "../../components/vertical-demo-library";
import { getWebI18n } from "../../lib/locale";
import { ArrowRight, CirclePlay, FileDown, MapPinned, ShieldCheck, Smartphone, Sparkles } from "lucide-react";

type DemoCopy = {
  eyebrow: string;
  title: string;
  description: string;
  primary: string;
  download: string;
  openLab: string;
  jumpTitle: string;
  jumpCards: Array<{ title: string; body: string; icon: "trust" | "mobile" | "ops" }>;
  howTitle: string;
  howSteps: string[];
  proofTitle: string;
  proofBullets: string[];
};

const iconMap = {
  trust: ShieldCheck,
  mobile: Smartphone,
  ops: MapPinned,
} as const;

const copyByLocale: Record<"es-AR" | "pt-BR" | "en", DemoCopy> = {
  "es-AR": {
    eyebrow: "nexID demo hub",
    title: "Explorá el producto sin call: demo self-serve, mobile y operativo",
    description: "Esta página está pensada para que cualquiera entienda solo qué ve el usuario final, qué monitorea operaciones y por qué el sistema agrega confianza comercial.",
    primary: "Usar demo integrada",
    download: "Descargar demo files",
    openLab: "Abrir Demo Lab completo",
    jumpTitle: "Qué podés entender acá",
    jumpCards: [
      { title: "Trust state", body: "Cómo se ve una validación genuina, alertada o bloqueada para producto/documento.", icon: "trust" },
      { title: "Experiencia mobile", body: "Qué ve una persona cuando toca una etiqueta o abre una credencial demo.", icon: "mobile" },
      { title: "Operación real", body: "Cómo se conectan mapa, feed, batches y superficies demo para ventas e inversores.", icon: "ops" },
    ],
    howTitle: "Cómo recorrer la demo",
    howSteps: [
      "1. Entrá al built-in demo para ver el flujo completo sin setup.",
      "2. Bajate los archivos demo si querés simular verticales o revisar manifest/seed.",
      "3. Mirá las superficies en vivo para entender status, geografía y UX de confianza.",
    ],
    proofTitle: "Qué debería quedarte claro al terminar",
    proofBullets: [
      "nexID no es solo hardware: es infraestructura operativa y comercial.",
      "La experiencia final puede ser simple aunque el backend sea enterprise.",
      "Verify, Passport y Rights se entienden mejor cuando se ven juntos en una demo real.",
    ],
  },
  "pt-BR": {
    eyebrow: "nexID demo hub",
    title: "Explore o produto sem call: demo self-serve, mobile e operacional",
    description: "Esta página foi pensada para que qualquer pessoa entenda sozinha o que vê o usuário final, o que monitora operações e por que o sistema agrega confiança comercial.",
    primary: "Usar demo integrada",
    download: "Baixar demo files",
    openLab: "Abrir Demo Lab completo",
    jumpTitle: "O que você pode entender aqui",
    jumpCards: [
      { title: "Trust state", body: "Como fica uma validação genuína, alertada ou bloqueada para produto/documento.", icon: "trust" },
      { title: "Experiência mobile", body: "O que a pessoa vê quando toca uma etiqueta ou abre uma credencial demo.", icon: "mobile" },
      { title: "Operação real", body: "Como mapa, feed, batches e superfícies demo se conectam para vendas e investidores.", icon: "ops" },
    ],
    howTitle: "Como percorrer a demo",
    howSteps: [
      "1. Entre na built-in demo para ver o fluxo completo sem setup.",
      "2. Baixe os arquivos demo se quiser simular verticais ou revisar manifest/seed.",
      "3. Veja as superfícies ao vivo para entender status, geografia e UX de confiança.",
    ],
    proofTitle: "O que deve ficar claro ao final",
    proofBullets: [
      "nexID não é só hardware: é infraestrutura operacional e comercial.",
      "A experiência final pode ser simples mesmo com backend enterprise.",
      "Verify, Passport e Rights ficam mais claros quando aparecem juntos em uma demo real.",
    ],
  },
  en: {
    eyebrow: "nexID demo hub",
    title: "Explore the product without a call: self-serve, mobile and operational demo",
    description: "This page is designed so anyone can understand what the end user sees, what operations monitors, and why the system creates commercial trust.",
    primary: "Use built-in demo",
    download: "Download demo files",
    openLab: "Open full Demo Lab",
    jumpTitle: "What you can understand here",
    jumpCards: [
      { title: "Trust state", body: "How genuine, alerted or blocked validations look for products/documents.", icon: "trust" },
      { title: "Mobile experience", body: "What a person sees after tapping a tag or opening a demo credential.", icon: "mobile" },
      { title: "Real operations", body: "How map, feed, batches and demo surfaces connect for sales and investors.", icon: "ops" },
    ],
    howTitle: "How to walk the demo",
    howSteps: [
      "1. Open the built-in demo to see the complete flow with no setup.",
      "2. Download the demo files if you want to simulate verticals or inspect manifest/seed files.",
      "3. Review the live surfaces to understand status, geography and trust UX.",
    ],
    proofTitle: "What should be clear by the end",
    proofBullets: [
      "nexID is not just hardware: it is operational and commercial infrastructure.",
      "The end-user experience can stay simple while the backend remains enterprise-grade.",
      "Verify, Passport and Rights make more sense when seen together in a real demo flow.",
    ],
  },
};

export default async function PublicDemoPage() {
  const { locale } = await getWebI18n();
  const copy = copyByLocale[locale];

  return (
    <main className="py-10">
      <section className="container-shell space-y-6">
        <SectionHeading eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />

        <div className="flex flex-wrap gap-3">
          <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/demo-lab`}>
            <Button><CirclePlay className="mr-2 h-4 w-4" />{copy.primary}</Button>
          </a>
          <a href="/demo/demobodega_seed.json" download>
            <Button variant="secondary"><FileDown className="mr-2 h-4 w-4" />{copy.download}</Button>
          </a>
          <a href={`${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat"}/demo-lab`}>
            <Button variant="secondary">{copy.openLab}<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </a>
        </div>

        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            {copy.jumpTitle}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.jumpCards.map((card) => {
              const Icon = iconMap[card.icon];
              return (
                <Card key={card.title} className="p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(14,165,233,0.08)]">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-200">
                    <Icon className="h-4 w-4" />
                    {card.title}
                  </p>
                  <p className="mt-3 text-sm text-slate-300">{card.body}</p>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white">{copy.howTitle}</h3>
            <div className="mt-4 grid gap-3">
              {copy.howSteps.map((step, index) => (
                <div key={step} className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-300/30 text-xs text-cyan-200">{index + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white">{copy.proofTitle}</h3>
            <div className="mt-4 grid gap-3">
              {copy.proofBullets.map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <VerticalDemoLibrary locale={locale} />
      <LiveDemoSurfaces />
    </main>
  );
}
