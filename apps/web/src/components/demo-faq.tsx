import { Card } from "@product/ui";
import { HelpCircle } from "lucide-react";

type Props = {
  locale: "es-AR" | "pt-BR" | "en";
};

const faqByLocale: Record<Props["locale"], { title: string; lead: string; items: Array<{ q: string; a: string }> }> = {
  "es-AR": {
    title: "FAQ rápida para cliente / inversor",
    lead: "Respuestas cortas para que cualquiera entienda la demo y el rollout sin reunión técnica.",
    items: [
      {
        q: "¿Se puede entender todo sin usar celular?",
        a: "Sí. El simulador desktop muestra estados, riesgos y narrativa comercial para visualizar el flujo completo en reuniones o ventas.",
      },
      {
        q: "¿Qué pasa cuando llegan tags físicas del proveedor?",
        a: "Se registra el batch, se importa el manifest (CSV/TXT), se activan unidades y luego se valida con scans reales.",
      },
      {
        q: "¿Cómo sé si hay riesgo de clonación o replay?",
        a: "El sistema clasifica resultados como VALID, NOT_ACTIVE, NOT_REGISTERED, REPLAY_SUSPECT o INVALID para auditar cada evento.",
      },
      {
        q: "¿Esto escala a volúmenes enterprise?",
        a: "Sí. El modelo operativo es el mismo: batch governance, import controlado, activación y observabilidad antifraude.",
      },
    ],
  },
  "pt-BR": {
    title: "FAQ rápida para cliente / investidor",
    lead: "Respostas curtas para entender a demo e o rollout sem reunião técnica.",
    items: [
      {
        q: "Dá para entender tudo sem celular?",
        a: "Sim. O simulador desktop mostra estados, riscos e narrativa comercial para reuniões e vendas.",
      },
      {
        q: "O que acontece quando chegam as tags físicas?",
        a: "Você registra o lote, importa o manifest (CSV/TXT), ativa unidades e valida com scans reais.",
      },
      {
        q: "Como detectar risco de clonagem ou replay?",
        a: "A plataforma classifica eventos como VALID, NOT_ACTIVE, NOT_REGISTERED, REPLAY_SUSPECT ou INVALID.",
      },
      {
        q: "Isso escala para nível enterprise?",
        a: "Sim. O modelo operacional permanece: governança de lote, importação controlada, ativação e observabilidade antifraude.",
      },
    ],
  },
  en: {
    title: "Quick FAQ for customers / investors",
    lead: "Short answers so anyone can understand the demo and rollout without a technical call.",
    items: [
      {
        q: "Can people understand the flow without using a phone?",
        a: "Yes. The desktop simulator shows trust states, risk alerts and business narrative for meetings and sales.",
      },
      {
        q: "What happens when physical supplier tags arrive?",
        a: "Register batch, import manifest (CSV/TXT), activate units, then run real scans for end-to-end validation.",
      },
      {
        q: "How do we detect cloning or replay risk?",
        a: "The platform classifies each event as VALID, NOT_ACTIVE, NOT_REGISTERED, REPLAY_SUSPECT or INVALID.",
      },
      {
        q: "Does this scale to enterprise volume?",
        a: "Yes. The operating model stays the same: batch governance, controlled import, activation and anti-fraud observability.",
      },
    ],
  },
};

export function DemoFaq({ locale }: Props) {
  const copy = faqByLocale[locale];
  return (
    <Card className="p-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        <HelpCircle className="h-4 w-4" />
        {copy.title}
      </p>
      <p className="mt-2 text-sm text-slate-300">{copy.lead}</p>
      <div className="mt-4 space-y-2">
        {copy.items.map((item) => (
          <details key={item.q} className="group rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-cyan-300/30">
            <summary className="cursor-pointer list-none text-sm font-semibold text-white">
              {item.q}
            </summary>
            <p className="mt-2 text-sm text-slate-300">{item.a}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}
