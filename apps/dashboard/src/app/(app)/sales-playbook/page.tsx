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
import type { LucideIcon } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
  context?: string;
}

interface FAQSection {
  title: string;
  icon: LucideIcon;
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
          answer: "El costo unitario depende del chip, antena, formato wet/dry inlay, volumen, conversión y logística. Se cotiza con una prueba de packaging antes de escalar. El plan base no escribe cada tap on-chain; Polygon o IOTA se activan sólo para eventos acordados, como claims autorizados, handling declarado, auditoría, DPP o certificados.",
          context: "El ROI se mide por caso: fraude evitado, recuperación de producto, opt-ins, canjes y trazabilidad. No usamos un porcentaje universal sin datos del envase y la línea del cliente."
        },
        {
          question: "¿Me va a ralentizar la línea de empaque industrial o embotellado?",
          answer: "Se diseña para integrarse sin cambiar el flujo principal, pero la velocidad debe validarse en una corrida piloto. Para aplicación directa suele convenir wet inlay en rollo; un dry inlay necesita conversión o laminado antes de entrar a la etiquetadora. Materiales, separación, core y sentido de bobinado se acuerdan con packaging.",
          context: "Antes de producción masiva se aprueban adhesivo, radio de curvatura, metal o líquido cercano, posición de antena, lectura y compatibilidad con la máquina real."
        },
        {
          question: "En cosmética, ¿cómo evito que rellenen mis envases originales de perfume o cremas?",
          answer: "nexID utiliza circuitos micro-electrónicos TagTamper integrados en el cierre. Al abrir la tapa o atomizador, el filamento del chip cambia de estado físicamente. El sistema registra el evento del sello en el backend para auditoría y reglas de postventa.",
          context: "Si el tag reporta TT abierto, el sistema puede mostrar ese estado y elevar una revisión. No infiere relleno, contenido ni apertura real del envase sin una integración de packaging validada."
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
          answer: "El código regulatorio sigue siendo obligatorio cuando corresponde. nexID lo complementa con una firma SUN dinámica del chip, validada server-side por la API en Vercel contra claves de lote cifradas en Neon. Una imagen del empaque no reproduce una lectura criptográfica fresca.",
          context: "La política puede rechazar una firma inválida y elevar patrones anómalos para revisión. La ubicación del navegador requiere permiso y la IP es sólo aproximada; ninguna se presenta como GPS infalible."
        },
        {
          question: "En el agro, ¿qué valor tiene colocar chips en bolsas de semillas de autor o agroquímicos?",
          answer: "nexID asocia el lote, canal y documentación declarados por el criadero o laboratorio con una identidad QR/NFC. Cuando el carrier lo permite, la API valida el mensaje criptográfico server-side; la asociación física se controla en el proceso de packaging del cliente.",
          context: "El productor escanea el bidón o bolsa con su celular y consulta lote, canal autorizado, documentación técnica y composición declarada por la marca, sin reemplazar la etiqueta regulatoria ni la recomendación del asesor agronómico."
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
          answer: "Podemos complementar o reemplazar el QR, según la operación, con pulseras o credenciales NFC. Cada ingreso de alto riesgo exige un mensaje criptográfico NFC fresco y una decisión server-side de la API desplegada en Vercel; la latencia y el modo offline se validan en el piloto del recinto.",
          context: "Al no exponer la clave del chip y exigir un mensaje fresco, la política puede rechazar replays y credenciales reutilizadas. La reducción real de ingresos duplicados, latencia y tasa de lectura se mide en el piloto del recinto."
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
          answer: "El flujo operativo actual usa funciones y APIs en Vercel con PostgreSQL administrado en Neon y aislamiento lógico por tenant. Blockchain es opcional: no procesa cada lectura y se reserva para eventos que justifican evidencia pública, costo de red y custodia separada.",
          context: "Polygon puede registrar ownership o certificados autorizados; IOTA puede anclar evidencia de integridad o supply chain. La red, frecuencia, gas y SLA se definen por tenant y caso de uso."
        },
        {
          question: "¿Cómo protegen la operación si la base de datos es centralizada?",
          answer: "La seguridad combina chip, backend y controles de acceso. En NFC, K_META y K_FILE de cada lote se guardan cifradas en Neon; KMS_MASTER_KEY_HEX vive sólo como variable del backend en Vercel y permite descifrar server-side para validar SUN/CMAC. Es cifrado de aplicación tipo envelope, separado de blockchain.",
          context: "Las wallets piloto de Polygon e IOTA usan claves separadas, envueltas por Google Cloud KMS con nivel SOFTWARE en modo kms_wrapped. El executor descifra el material de forma efímera para firmar. La arquitectura actual no se vende como firma directa no exportable."
        },
        {
          question: "¿Cómo escala el modelo SaaS sobre Vercel y Neon?",
          answer: "El modelo combina suministro y programación de tags con suscripciones por workspace, usuarios, operación, SDK/webhooks y módulos opcionales de evidencia blockchain. Los límites, costos variables y SLA se cotizan por tenant; no dependen de prometer una IA propietaria.",
          context: "El optimizador comercial puede llamar a un proveedor externo. Sólo se etiqueta como live cuando la respuesta confirma proveedor y modelo; sin cuota, token o respuesta útil, la interfaz declara fallback determinístico."
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
            Manual comercial basado en la arquitectura operativa actual. Descargá el PDF versionado o imprimí esta vista.
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

      <section className="print-block rounded-2xl border border-cyan-500/20 bg-slate-950 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Arquitectura actual · alcance verificable</p>
            <h2 className="mt-1 text-lg font-bold text-white print-title">Qué puede vender nexID hoy</h2>
          </div>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">
            Vercel + Neon
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            {
              label: "Runtime y datos",
              detail: "APIs y funciones en Vercel; PostgreSQL administrado en Neon con alcance lógico por tenant.",
            },
            {
              label: "Custodia NFC / SUN",
              detail: "K_META y K_FILE cifradas en Neon; KMS_MASTER_KEY_HEX permanece en el backend de Vercel para validación SUN/CMAC server-side.",
            },
            {
              label: "Custodia blockchain piloto",
              detail: "Wallets separadas de Polygon e IOTA con Google Cloud KMS SOFTWARE envelope (kms_wrapped); el material se descifra efímeramente en el executor para firmar.",
            },
            {
              label: "Asistencia de copy",
              detail: "Proveedor y modelo se muestran sólo tras una respuesta confirmada. Si falla o no hay cuota, se declara fallback determinístico.",
            },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-slate-900/45 p-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-white print-title">{item.label}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 1: NFC vs QR comparison table */}
      <section className="print-block rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none no-print" />
        
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 print-title">
          <Zap className="w-5 h-5 text-cyan-400" /> nexID NFC vs. Código QR Tradicional
        </h2>
        <p className="text-xs text-slate-400 mb-6 no-print">
          Comparativa para elegir el control adecuado sin promesas absolutas.
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
                <td className="p-3 flex items-center gap-1.5 text-rose-400"><XCircle className="w-4 h-4 shrink-0" /> El contenido visual puede copiarse</td>
                <td className="p-3 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 inline mr-1" /> Firma SUN dinámica + política server-side</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Experiencia de Apertura</td>
                <td className="p-3">Requiere cámara y encuadre</td>
                <td className="p-3 text-cyan-300">Tap sin app en móviles compatibles; la latencia se mide en piloto</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Detección de Apertura</td>
                <td className="p-3 text-slate-500">No informa estado físico por sí solo</td>
                <td className="p-3 text-emerald-400"><CheckCircle2 className="w-4 h-4 shrink-0 inline mr-1" /> Disponible con tag TT y construcción tamper validada</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Ubicación Antifraude</td>
                <td className="p-3">Depende del portal, permiso del usuario e IP aproximada</td>
                <td className="p-3 text-cyan-300">Mismas señales declaradas + evidencia criptográfica del chip</td>
              </tr>
              <tr>
                <td className="p-3 font-semibold text-white print-title">Percepción de Valor</td>
                <td className="p-3">Depende de diseño, contenido y contexto</td>
                <td className="p-3 text-purple-300 font-bold">Punto de contacto físico interactivo, medible por caso</td>
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
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`sales-playbook-panel-${uniqueId}`}
                        onClick={() => toggleAccordion(uniqueId)}
                        className="w-full flex items-center justify-between gap-4 p-4 text-left font-bold text-xs text-white uppercase tracking-wide print-title"
                      >
                        <span>{item.question}</span>
                        <span className="no-print shrink-0">
                          {isOpen ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </span>
                      </button>

                      {/* Accordion Content */}
                      <div
                        id={`sales-playbook-panel-${uniqueId}`}
                        className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[500px]" : "max-h-0 print:max-h-[500px]"}`}
                      >
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

      {/* Section 3: Verifiable demo flow */}
      <section className="print-block rounded-2xl border border-purple-500/20 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.06),transparent_60%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-6 shadow-xl">
        <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2 print-title">
          <Lock className="w-5 h-5 text-purple-400" /> Demo comercial verificable
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Un recorrido breve que distingue evidencia digital del tag, datos confirmados y simulación declarada.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              step: "1. Mostrar el límite visual",
              desc: "Usá un QR de muestra y mostrá que una foto conserva el mismo contenido visual. Aclará que esto no demuestra fraude por sí solo: explica por qué los casos de mayor riesgo agregan una prueba criptográfica del chip."
            },
            {
              step: "2. Tap Criptográfico",
              desc: "Pedile que apoye su celular en una muestra NTAG 424 configurada. El portal debe indicar si recibió un mensaje criptográfico NFC nuevo o si está en modo demo. Explicá que una captura no genera una nueva firma SUN."
            },
            {
              step: "3. Demostrar el Control",
              desc: "Abrí el panel CRM. Si el evento del tag llegó al backend, mostrá su fuente y estado; si son datos demo, dejá visible esa procedencia. Enseñá Polygon o IOTA sólo cuando la evidencia de red esté verificada."
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
