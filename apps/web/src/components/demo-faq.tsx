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
        q: "Que recibe una persona despues de tocar el producto?",
        a: "Una respuesta simple: si el producto es autentico, de donde viene, que lote tiene y cual es el siguiente paso disponible: garantia, beneficio, certificado, portal o reclamo de dueno.",
      },
      {
        q: "Esto obliga al cliente a entender blockchain o NFT?",
        a: "No. La experiencia principal habla de confianza, garantia y certificado digital. Blockchain o NFT aparecen solo si la marca decide usarlo para ownership, coleccionables o reventa.",
      },
      {
        q: "Como empieza un piloto real?",
        a: "Elegimos una linea o lote, cargamos fotos reales, etiqueta, reglas de validacion y beneficios; luego probamos taps fisicos, portal de usuario, certificado y dashboard comercial.",
      },
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
        q: "O que a pessoa recebe depois de tocar o produto?",
        a: "Uma resposta simples: se o produto e autentico, de onde veio, qual lote possui e qual e o proximo passo: garantia, beneficio, certificado, portal ou claim de dono.",
      },
      {
        q: "O cliente precisa entender blockchain ou NFT?",
        a: "Nao. A experiencia principal fala de confianca, garantia e certificado digital. Blockchain ou NFT aparecem apenas quando a marca decide usar para ownership, colecionaveis ou revenda.",
      },
      {
        q: "Como comeca um piloto real?",
        a: "Escolhemos uma linha ou lote, carregamos fotos reais, etiqueta, regras de validacao e beneficios; depois testamos taps fisicos, portal, certificado e dashboard comercial.",
      },
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
        q: "What does a person receive after tapping the product?",
        a: "A simple answer: whether the product is authentic, where it came from, which batch it belongs to and the next available step: warranty, benefit, certificate, portal or ownership claim.",
      },
      {
        q: "Does the customer need to understand blockchain or NFTs?",
        a: "No. The primary experience speaks about trust, warranty and a digital certificate. Blockchain or NFTs appear only when the brand chooses ownership, collectibles or resale.",
      },
      {
        q: "How does a real pilot start?",
        a: "We choose a line or batch, load real product photos, label, validation rules and benefits; then test physical taps, user portal, certificate and commercial dashboard.",
      },
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
