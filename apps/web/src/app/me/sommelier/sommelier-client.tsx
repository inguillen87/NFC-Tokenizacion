"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@product/ui";
import { 
  Sparkles, 
  Send, 
  ArrowLeft, 
  Bot, 
  Coffee, 
  Thermometer, 
  GlassWater, 
  CalendarDays,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  classifySommelierResponse,
  safeSommelierGuidance,
  sommelierProvenanceLabel,
  type SommelierProvenance,
} from "../../../lib/sommelier-guidance";

interface ChatMessage {
  id: string;
  sender: "sommelier" | "user";
  text: string;
  provenance?: SommelierProvenance;
}

interface SommelierClientProps {
  productName: string;
  brandName: string;
}

export default function SommelierClient({ productName, brandName }: SommelierClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Initialize welcome message
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "sommelier",
        text: `Hola. Puedo darte orientación general sobre "${productName || "el producto seleccionado"}" de "${brandName || "la marca indicada"}". Esos nombres fueron proporcionados por la pantalla y no prueban autenticidad ni reemplazan una ficha técnica.`,
        provenance: { mode: "context" },
      }
    ]);
  }, [productName, brandName]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: textToSend
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/cognitive-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToSend,
          tone: "sommelier-chat",
          productContext: { productName, brandName },
        })
      });

      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      if (!data?.optimizedText) throw new Error("Empty AI response");
      const provenance = classifySommelierResponse(data);

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: data.optimizedText,
        provenance,
      }]);
    } catch (err) {
      console.warn("AI Sommelier fallback to rule-based cata:", err);
      const replyText = safeSommelierGuidance(textToSend, { productName, brandName });

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: replyText,
        provenance: { mode: "local-fallback" },
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");
    handleSendMessage(text);
  };

  return (
    <div className="space-y-6">
      {/* Top navigation */}
      <header className="flex items-center justify-between border-b border-white/5 pb-4">
        <Link 
          href="/me/products" 
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mis productos
        </Link>
        <span className="flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-purple-300">
          <Sparkles className="w-3 h-3 text-purple-300" /> Producto indicado · autenticidad no verificada
        </span>
      </header>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Chat box */}
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 backdrop-blur-xl flex flex-col h-[520px] shadow-2xl relative overflow-hidden">
          
          {/* Sommelier Profile Header */}
          <div className="p-4 border-b border-white/10 bg-slate-900/30 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Cata AI Sommelier</h3>
              <p className="text-[10px] text-purple-300 font-bold uppercase tracking-wider">Asistente enológico digital</p>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs scrollbar-thin">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <div
                    className={`p-3.5 rounded-2xl leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-purple-600 text-white rounded-br-none font-medium"
                        : "bg-slate-900 border border-white/5 text-slate-200 rounded-bl-none"
                    }`}
                  >
                    {msg.sender === "sommelier" ? (
                      <span className="mb-1 block text-[9px] font-black uppercase tracking-wide text-cyan-300">
                        {sommelierProvenanceLabel(msg.provenance)}
                      </span>
                    ) : null}
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <div className="bg-slate-900 border border-white/5 text-slate-300 p-3.5 rounded-2xl rounded-bl-none mr-auto max-w-[80%] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>

          {/* Input form */}
          <form onSubmit={onSubmit} className="p-3 border-t border-white/10 bg-slate-900/40 flex gap-2">
            <input
              type="text"
              placeholder="Preguntale al sommelier (ej. ¿Con qué comida combina?)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Suggestion Chips and Bottle HUD */}
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Consultas Sugeridas</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Hacé clic para preguntarle al Sommelier sobre tu botella.</p>
            </div>
            
            <div className="flex flex-col gap-2">
              {[
                { text: "¿Con qué comida acompaña bien?", Icon: Coffee, query: "Maridaje recomendado" },
                { text: "¿A qué temperatura se sirve?", Icon: Thermometer, query: "Temperatura ideal" },
                { text: "¿Cuáles son las notas de cata?", Icon: GlassWater, query: "Aromas y cata en copa" },
                { text: "¿Cuánto tiempo lo puedo guardar?", Icon: CalendarDays, query: "Potencial de guarda" }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip.query)}
                  className="w-full text-left p-3 rounded-xl border border-white/5 bg-slate-950/40 hover:border-purple-500/35 hover:bg-purple-500/5 text-xs font-bold text-slate-200 transition-all flex items-center gap-3"
                >
                  <chip.Icon className="w-4.5 h-4.5 text-purple-400 shrink-0" />
                  <span>{chip.text}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Declared identity card: this route has no SUN/tamper evidence. */}
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/15 text-amber-200">
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">Identidad declarada</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1">
              <p>Producto indicado: <strong className="text-white">{productName}</strong></p>
              <p>Marca indicada: <strong className="text-white">{brandName}</strong></p>
              <p>Estado SUN/tamper: <strong className="text-amber-200">No disponible en esta pantalla</strong></p>
              <p className="pt-1 text-[10px] leading-relaxed text-slate-400">Estos datos no verifican la botella, su contenido ni el estado físico del sello.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
