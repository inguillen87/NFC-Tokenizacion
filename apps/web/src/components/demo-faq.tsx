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
        q: "¿Qué recibe una persona después de tocar el producto?",
        a: "Una respuesta simple sobre el mensaje NFC/QR, el lote y origen declarados, la evidencia disponible y el siguiente paso permitido. No certifica por sí sola autenticidad física, contenido o procedencia.",
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
        q: "Offline significa verificacion final sin backend?",
        a: "No. El modo offline entrega una decision local limitada para operacion de campo; el veredicto final se confirma al sincronizar con nexID y el bundle no incluye claves maestras.",
      },
      {
        q: "Polygon e IOTA son obligatorios o partners oficiales?",
        a: "No. Polygon se usa como capa opcional de ownership/certificado y IOTA como capa opcional de prueba/auditoria. No se afirma partnership ni que cada tap vaya on-chain.",
      },
      {
        q: "La app usa GPS automaticamente?",
        a: "No. La ubicacion se solicita solo por accion del usuario en la demo movil y se puede continuar sin compartir GPS.",
      },
      {
        q: "¿Esto escala a volúmenes enterprise?",
        a: "La arquitectura está diseñada para batch governance, import controlado, activación y observabilidad de riesgo. Capacidad, latencia y SLA se validan por piloto y pruebas de carga antes de comprometer volumen productivo.",
      },
    ],
  },
  "pt-BR": {
    title: "FAQ rápida para cliente / investidor",
    lead: "Respostas curtas para entender a demo e o rollout sem reunião técnica.",
    items: [
      {
        q: "O que a pessoa recebe depois de tocar o produto?",
        a: "Uma resposta simples sobre a mensagem NFC/QR, lote e origem declarados, evidência disponível e próximo passo permitido. Não certifica, por si só, autenticidade física, conteúdo ou procedência.",
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
        q: "Offline significa verificacao final sem backend?",
        a: "Nao. O modo offline oferece uma decisao local limitada para operacao de campo; o veredito final e confirmado ao sincronizar com nexID e o bundle nao inclui chaves mestras.",
      },
      {
        q: "Polygon e IOTA sao obrigatorios ou parceiros oficiais?",
        a: "Nao. Polygon e uma camada opcional de ownership/certificado e IOTA e uma camada opcional de prova/auditoria. Nao afirmamos parceria nem que cada tap vai on-chain.",
      },
      {
        q: "O app usa GPS automaticamente?",
        a: "Nao. A localizacao e solicitada apenas por acao do usuario na demo mobile e o fluxo continua sem compartilhar GPS.",
      },
      {
        q: "Isso escala para nível enterprise?",
        a: "A arquitetura foi desenhada para governança de lote, importação controlada, ativação e observabilidade de risco. Capacidade, latência e SLA são validados por piloto e testes de carga antes de assumir volume produtivo.",
      },
    ],
  },
  en: {
    title: "Quick FAQ for customers / investors",
    lead: "Short answers so anyone can understand the demo and rollout without a technical call.",
    items: [
      {
        q: "What does a person receive after tapping the product?",
        a: "A simple answer about the NFC/QR message, declared batch and origin, available evidence and the next permitted step. It does not by itself certify physical authenticity, contents or provenance.",
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
        q: "Does offline mode mean final verification without the backend?",
        a: "No. Offline mode provides a limited local decision for field operations; the final verdict is confirmed after sync with nexID and the bundle does not include master keys.",
      },
      {
        q: "Are Polygon and IOTA mandatory or official partners?",
        a: "No. Polygon is an optional ownership/certificate layer and IOTA is an optional proof/audit layer. We do not claim partnership or that every tap goes on-chain.",
      },
      {
        q: "Does the app use GPS automatically?",
        a: "No. Location is requested only after a user action in the mobile demo, and the flow can continue without sharing GPS.",
      },
      {
        q: "Does this scale to enterprise volume?",
        a: "The architecture is designed for batch governance, controlled import, activation and risk observability. Capacity, latency and SLA are validated through pilots and load tests before committing production volume.",
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
