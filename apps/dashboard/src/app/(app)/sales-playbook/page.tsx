"use client";

import React, { useState } from "react";
import { 
  BookOpen, 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  ShieldCheck, 
  ChevronDown, 
  ChevronUp, 
  Printer, 
  Download,
  Coins, 
  Zap, 
  Lock, 
  Smartphone,
  Info
} from "lucide-react";
import { Button } from "@product/ui";

interface FAQItem {
  question: string;
  answer: string;
  context?: string;
}

interface FAQSection {
  title: string;
  icon: any;
  iconColor: string;
  items: FAQItem[];
}

export default function SalesPlaybookPage() {
  const [openIndex, setOpenIndex] = useState<string | null>("bodeguero-0");

  const handlePrint = () => {
    window.print();
  };

  const sections: FAQSection[] = [
    {
      title: "Objeciones de Bodegas y Cosmética (Operativas y Costos)",
      icon: ShieldAlert,
      iconColor: "text-amber-400",
      items: [
        {
          question: "¿Esto me va a encarecer mucho el costo por botella o empaque premium?",
          answer: "El microchip criptográfico representa centavos de dólar por unidad (menos del 1.5% en botellas o perfumes premium). La línea estándar opera en backend seguro nexID sin transacciones on-chain por cada tap; Polygon o IOTA se activan solo cuando hay ownership, auditoría, DPP o mercado secundario que justifican gas, RPC y custodia.",
          context: "A cambio de este mínimo costo, reducís fuertemente el fraude y abrís un canal de datos directo al consumidor final (DTC), con impacto medible frente a intermediarios de marketing."
        },
        {
          question: "¿Me va a ralentizar la línea de empaque industrial o embotellado?",
          answer: "No. Los chips se entregan en formato inlay autoadhesivo (rollos industriales estándar). Tus máquinas etiquetadoras automáticas los aplican debajo de la contraetiqueta o bajo el sello del empaque de forma integrada y sin perder milésimas de velocidad.",
          context: "La implementación es totalmente transparente para el gerente de operaciones tanto en embotelladoras como en líneas de envasado cosmético."
        },
        {
          question: "En cosmética, ¿cómo evito que rellenen mis envases originales de perfume o cremas?",
          answer: "nexID utiliza circuitos micro-electrónicos TagTamper integrados en el cierre. Al abrir la tapa o atomizador, el filamento del chip cambia de estado físicamente. El sistema registra el evento del sello en el backend para auditoría y reglas de postventa.",
          context: "Si alguien escanea un perfume rellenado, el sistema puede advertir al comprador que el envase original ya fue abierto, reduciendo el mercado negro de adulteraciones."
        }
      ]
    },
    {
      title: "Objeciones de Farmacéutica y Agro (Trazabilidad y Seguridad)",
      icon: ShieldCheck,
      iconColor: "text-emerald-400",
      items: [
        {
          question: "¿Qué ventaja tiene sobre el código de barras que exige la regulación de medicamentos?",
          answer: "El código de barras es estático y fácilmente duplicable por fotocopiadoras en empaques apócrifos. El microchip nexID genera una firma criptográfica dinámica de un solo uso que se valida contra nuestro servidor seguro en Render/AWS.",
          context: "Si una red copia el empaque, el servidor detecta firma ausente, inválida o patrones geográficos incompatibles, bloqueando beneficios y elevando el caso para revisión operativa."
        },
        {
          question: "En el agro, ¿qué valor tiene colocar chips en bolsas de semillas de autor o agroquímicos?",
          answer: "El mercado negro de semillas adulteradas y agroquímicos diluidos genera pérdidas millonarias y daña cosechas enteras. El chip nexID certifica el origen del criadero o laboratorio oficial directamente en el campo de cultivo.",
          context: "El productor escanea el bidón o bolsa con su celular y valida que el agroquímico posee la composición y concentración original, protegiendo los derechos de autor y la producción agrícola."
        }
      ]
    },
    {
      title: "Objeciones de Eventos y Tickets VIP (Accesos y Control)",
      icon: Smartphone,
      iconColor: "text-cyan-400",
      items: [
        {
          question: "Los códigos QR de las entradas se revenden y duplican. ¿Cómo lo soluciona nexID?",
          answer: "Reemplazamos el QR digital por pulseras o credenciales VIP físicas inteligentes equipadas con chip NFC nexID. Cada ingreso requiere un tap físico que se procesa en milisegundos contra nuestro servidor Render.",
          context: "Al no exponer la clave criptográfica del chip y exigir tap físico fresco, se reduce fuertemente la entrada duplicada y se bloquean acciones de alto riesgo en eventos VIP y corporativos."
        }
      ]
    },
    {
      title: "Preguntas de Inversores (Tecnología Híbrida y Negocio)",
      icon: Coins,
      iconColor: "text-purple-400",
      items: [
        {
          question: "¿Por qué ofrecer una solución híbrida (SQL + Blockchain Opcional)?",
          answer: "Muchos clientes B2B tradicionales le temen a la Web3, gas fees y billeteras digitales. Al ofrecer por defecto una arquitectura SQL segura hospedada en AWS y Render, logramos un onboarding inmediato y sin fricciones.",
          context: "Si un cliente final lanza una línea ultra-premium o de colección y necesita evidencia pública de ownership, activamos la capa Polygon on-chain como add-on premium facturado en el plan SaaS."
        },
        {
          question: "¿Cómo garantizan la seguridad de la base de datos SQL si es centralizada?",
          answer: "La seguridad no depende solo de la base de datos, sino de la criptografía del chip y de la política del backend. Cada tap dinámico genera una firma SUN verificada con claves protegidas por KMS/HSM o custody signer según el despliegue.",
          context: "Incluso si un hacker vulnera el servidor SQL, no puede generar firmas dinámicas falsas de chips físicos porque no posee las claves criptográficas maestras."
        },
        {
          question: "¿Cómo escala el modelo SaaS en Render y AWS?",
          answer: "Operamos un modelo de software de alta rentabilidad: margen por volumen en el hardware programado (chips) + suscripción SaaS mensual por el uso del panel CRM, telemetría y el motor nexID Cognitive AI Engine.",
          context: "Esto nos da ingresos predecibles y un moat defensivo basado en el software y la integración criptográfica propietaria."
        }
      ]
    }
  ];

  const toggleAccordion = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Styles for print output override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-block {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 2rem !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 0.5rem !important;
            padding: 1.5rem !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .print-title {
            color: #0f172a !important;
          }
          .print-table {
            border-collapse: collapse !important;
            width: 100% !important;
            color: #0f172a !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #cbd5e1 !important;
            padding: 8px !important;
            color: #0f172a !important;
          }
          .print-bg-dark {
            background-color: #f8fafc !important;
          }
        }
      `}} />

      {/* Header (Screen mode only) */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Playbook de Ventas & FAQs <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-0.5 rounded-full font-black uppercase">Sales Tool</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manual de manejo de objeciones y comparativa técnica. Descargá el PDF premium o imprimí el contenido.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handlePrint} 
            variant="secondary"
            className="gap-2 text-xs py-1.5 border border-purple-500/30 hover:border-purple-500/60"
          >
            <Printer className="w-3.5 h-3.5 text-purple-400" />
            Imprimir Playbook
          </Button>

          <Button 
            onClick={() => window.open("/nexid_sales_playbook.pdf", "_blank")} 
            variant="primary"
            className="gap-2 text-xs py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold border border-purple-500/30"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            Descargar PDF
          </Button>
        </div>
      </header>

      {/* Section 1: NFC vs QR comparison table */}
      <section className="print-block rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none no-print" />
        
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 print-title">
          <Zap className="w-5 h-5 text-cyan-400" /> nexID NFC vs. Código QR Tradicional
        </h2>
        <p className="text-xs text-slate-400 mb-6 no-print">
          La comparativa técnica definitiva para desarmar la duda principal del bodeguero.
        </p>

        <div className="overflow-x-auto">
          <table className="print-table w-full border-collapse text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-black uppercase text-slate-400 bg-slate-900/50 print-bg-dark">
                <th className="p-3">Característica</th>
                <th className="p-3">Código QR Tradicional</th>
                <th className="p-3 text-cyan-300">nexID NFC (NTAG 424 DNA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="p-3 font-semibold text-white print-title">Copiabilidad / Fraude</td>
                <td className="p-3 flex items-center gap-1.5 text-rose-400"><XCircle className="w-4 h-4 shrink-0" /> Crítica (Fotocopiable)</td>
                <td className="p-3 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 inline mr-1" /> Imposible (Firma única SUN)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Experiencia de Apertura</td>
                <td className="p-3">Lenta (Enfocar cámara + click)</td>
                <td className="p-3 text-cyan-300">Instantánea (Apoyar móvil - 0.5s)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Detección de Apertura</td>
                <td className="p-3 text-slate-500">Ninguna (QR estático)</td>
                <td className="p-3 text-emerald-400"><CheckCircle2 className="w-4 h-4 shrink-0 inline mr-1" /> Física (Circuito TagTamper)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Ubicación Antifraude</td>
                <td className="p-3">Fácil de falsificar (IP de red)</td>
                <td className="p-3 text-cyan-300">Validación satelital activa (GPS/IP)</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Percepción de Valor</td>
                <td className="p-3">Baja (Carta de bar, spam)</td>
                <td className="p-3 text-purple-300 font-bold">Lujo y estatus premium</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 2: Accordion FAQs */}
      <section className="space-y-4">
        {sections.map((section, secIdx) => {
          const SectionIcon = section.icon;
          return (
            <div key={secIdx} className="print-block rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl">
              <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2.5 print-title">
                <SectionIcon className={`w-5 h-5 ${section.iconColor}`} /> {section.title}
              </h2>
              
              <div className="space-y-3">
                {section.items.map((item, itemIdx) => {
                  const uniqueId = `${secIdx === 0 ? "bodeguero" : secIdx === 1 ? "inversor" : "consumidor"}-${itemIdx}`;
                  const isOpen = openIndex === uniqueId;
                  
                  return (
                    <div 
                      key={itemIdx} 
                      className={`rounded-xl border transition-all ${
                        isOpen ? "border-purple-500/30 bg-purple-950/5" : "border-white/5 bg-slate-900/20 hover:border-white/10"
                      }`}
                    >
                      {/* Accordion Header */}
                      <button
                        onClick={() => toggleAccordion(uniqueId)}
                        className="w-full flex items-center justify-between gap-4 p-4 text-left font-bold text-xs text-white uppercase tracking-wide print-title"
                      >
                        <span>{item.question}</span>
                        <span className="no-print shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </span>
                      </button>

                      {/* Accordion Content */}
                      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[500px]" : "max-h-0 print:max-h-[500px]"}`}>
                        <div className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs text-slate-300 leading-relaxed">
                          <p>{item.answer}</p>
                          {item.context && (
                            <div className="rounded-lg bg-slate-900/50 p-3 border-l-2 border-cyan-500/40 flex gap-2.5 items-start">
                              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-slate-400 italic font-mono">{item.context}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Section 3: Live Demo Flow */}
      <section className="print-block rounded-2xl border border-purple-500/20 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.06),transparent_60%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-6 shadow-xl">
        <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2 print-title">
          <Lock className="w-5 h-5 text-purple-400" /> El &quot;As bajo la manga&quot; en Reuniones de Venta
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Cómo estructurar tu demo física en 3 minutos para convencer al cliente de inmediato.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1. Hackear el QR",
              desc: "Llevá una botella común con QR. Escanealo, sacale una foto con tu celular al QR y hacé que escaneen la foto. Decile: 'Vea, acabo de clonar y duplicar la identidad de su botella en un segundo. Cualquiera en Europa puede hacerlo'."
            },
            {
              step: "2. Tap Criptográfico",
              desc: "Pedile que apoye su celular en tu botella inteligente con chip nexID. Se abrirá de inmediato su Portal VIP mostrando la botella en 3D. Explicale que el celular validó una firma criptográfica dinámica y que una foto o captura no reemplaza el tap físico fresco."
            },
            {
              step: "3. Demostrar el Control",
              desc: "Abrí tu notebook con el panel CRM nexID. Mostrale cómo su tap en Mendoza apareció en tiempo real en el mapa, y cómo el sistema calcula su huella, su prestigio y el ledger Polygonscan listo para auditoría comercial."
            }
          ].map((item, idx) => (
            <div key={idx} className="rounded-xl border border-white/5 bg-slate-950/40 p-4 space-y-2 relative">
              <span className="absolute -top-2.5 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-[10px] font-black text-slate-950">
                {idx + 1}
              </span>
              <h4 className="text-xs font-black text-white pt-1">{item.step}</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
