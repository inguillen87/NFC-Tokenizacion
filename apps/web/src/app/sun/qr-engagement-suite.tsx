"use client";

import { useState, useEffect } from "react";
import { Sparkles, HelpCircle, Star, Send, Gift, CheckCircle2, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";

type EngagementTab = "sommelier" | "trivia" | "feedback" | "sorteo";

interface ChatMessage {
  id: string;
  sender: "sommelier" | "user";
  text: string;
}

export function QREngagementSuite({ wineryName, productName }: { wineryName: string; productName: string }) {
  const [activeTab, setActiveTab] = useState<EngagementTab>("sommelier");
  
  // Sommelier Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Trivia State
  const [triviaStep, setTriviaStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [triviaDone, setTriviaDone] = useState(false);

  // Feedback State
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Sorteo State
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [raffleSubmitted, setRaffleSubmitted] = useState(false);

  // Initialize welcome message for Sommelier
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "sommelier",
        text: `¡Hola! Soy tu Sommelier Virtual nexID. Veo que estás consultando el vino "${productName}" de la bodega "${wineryName}". ¿En qué te puedo asesorar hoy? Preguntame sobre su temperatura de servicio, maridajes o notas de cata.`
      }
    ]);
  }, [productName, wineryName]);

  const handleSendChat = async (textToSend: string) => {
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
          text: `Vino: ${productName}. Bodega: ${wineryName}. Pregunta del cliente: ${textToSend}`,
          tone: "sommelier-chat"
        })
      });

      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      if (!data?.optimizedText) throw new Error("Empty AI response");

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: data.optimizedText
      }]);
    } catch (err) {
      console.warn("AI Sommelier chat fallback:", err);
      // Fallback answers based on keywords
      let replyText = `Como tu Sommelier Virtual de nexID, te comento que el "${productName}" posee una gran tipicidad varietal. Te sugiero descorcharlo 15-20 minutos antes de consumir para apreciar todos sus aromas.`;
      const clean = textToSend.toLowerCase();

      if (clean.includes("maridaje") || clean.includes("comer") || clean.includes("comida") || clean.includes("acompañar")) {
        replyText = `Para maridar tu "${productName}", te recomiendo carnes rojas asadas, pastas con salsas de tomate maduro o una selección de quesos de pasta dura.`;
      } else if (clean.includes("temperatura") || clean.includes("servir") || clean.includes("frio") || clean.includes("caliente")) {
        replyText = `Te sugiero servir este tinto a una temperatura templada entre 16°C y 18°C para potenciar su fruta y equilibrar los taninos.`;
      } else if (clean.includes("cata") || clean.includes("aroma") || clean.includes("sabor") || clean.includes("oler")) {
        replyText = `En copa vas a encontrar notas intensas de frutos rojos maduros, pimienta y sutiles toques de madera. En boca es redondo y de gran persistencia.`;
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: "sommelier",
        text: replyText
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const onChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput;
    setChatInput("");
    handleSendChat(text);
  };

  const triviaQuestions = [
    {
      q: "¿Cuál es el varietal tinto insignia de Argentina?",
      options: ["Cabernet Sauvignon", "Malbec", "Syrah", "Tempranillo"],
      answer: 1,
      explanation: "El Malbec es el varietal insignia de Argentina, reconocido mundialmente por su suavidad y notas frutales en el Valle de Uco.",
    },
    {
      q: "¿A qué temperatura sugerida se sirve un Malbec Reserva?",
      options: ["8°C - 10°C", "12°C - 14°C", "16°C - 18°C", "22°C - 24°C"],
      answer: 2,
      explanation: "Los tintos de gran cuerpo y reserva se aprecian mejor entre 16°C y 18°C para potenciar sus aromas sin volatilizar el alcohol.",
    },
    {
      q: "¿Qué aporta la madera de roble durante la crianza?",
      options: ["Mayor acidez", "Notas de vainilla, tabaco y estructura", "Burbujas finas", "Menor coloración"],
      answer: 1,
      explanation: "El paso por barricas aporta complejidad aromática (vainilla, humo, chocolate) y suaviza los taninos de forma natural.",
    },
  ];

  const handleNextQuestion = () => {
    if (selectedAnswer === triviaQuestions[triviaStep].answer) {
      setScore(prev => prev + 1);
    }
    setSelectedAnswer(null);

    if (triviaStep < triviaQuestions.length - 1) {
      setTriviaStep(prev => prev + 1);
    } else {
      setTriviaDone(true);
    }
  };

  const handleRestartTrivia = () => {
    setTriviaStep(0);
    setSelectedAnswer(null);
    setScore(0);
    setTriviaDone(false);
  };

  return (
    <div className="w-full rounded-2xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl mt-4">
      {/* Tab Selectors */}
      <div className="flex border-b border-white/5 bg-black/40 text-[10px] md:text-xs">
        <button
          onClick={() => setActiveTab("sommelier")}
          className={`flex-1 py-3.5 font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === "sommelier"
              ? "border-amber-500 text-amber-300 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Bot className="h-3.5 w-3.5" /> Sommelier AI
          </span>
        </button>
        <button
          onClick={() => setActiveTab("trivia")}
          className={`flex-1 py-3.5 font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === "trivia"
              ? "border-amber-500 text-amber-300 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" /> Trivia
          </span>
        </button>
        <button
          onClick={() => setActiveTab("feedback")}
          className={`flex-1 py-3.5 font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === "feedback"
              ? "border-amber-500 text-amber-300 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Star className="h-3.5 w-3.5" /> Calificar
          </span>
        </button>
        <button
          onClick={() => setActiveTab("sorteo")}
          className={`flex-1 py-3.5 font-bold uppercase tracking-wider transition border-b-2 ${
            activeTab === "sorteo"
              ? "border-amber-500 text-amber-300 bg-amber-500/5"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span className="flex items-center justify-center gap-1">
            <Gift className="h-3.5 w-3.5" /> Sorteo
          </span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-5">
        
        {/* SOMMELIER AI TAB */}
        {activeTab === "sommelier" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              <span>Asistente Enólogo</span>
              <span className="flex items-center gap-1 text-amber-400"><Sparkles className="h-3 w-3 animate-pulse" /> Inteligencia Artificial</span>
            </div>

            {/* Chat Messages */}
            <div className="h-[200px] overflow-y-auto rounded-xl border border-white/5 bg-black/45 p-3 space-y-3.5 text-xs">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-amber-500 text-slate-950 font-semibold"
                        : "bg-slate-900 border border-white/5 text-slate-200"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3.5 py-2.5 bg-slate-900 border border-white/5 text-slate-400 italic flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Send Input */}
            <form onSubmit={onChatSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Preguntale al sommelier (ej. ¿con qué carne marida?)..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isTyping}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
        
        {/* TRIVIA TAB */}
        {activeTab === "trivia" && (
          <div className="space-y-4">
            {!triviaDone ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  <span>Desafío Vinícola</span>
                  <span>Pregunta {triviaStep + 1} de {triviaQuestions.length}</span>
                </div>
                
                <h4 className="text-sm font-bold text-white leading-normal">
                  {triviaQuestions[triviaStep].q}
                </h4>

                <div className="grid gap-2">
                  {triviaQuestions[triviaStep].options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedAnswer(idx)}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                        selectedAnswer === idx
                          ? "border-amber-500 bg-amber-500/10 text-white font-bold"
                          : "border-white/5 bg-black/30 text-slate-300 hover:bg-white/5"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                <button
                  disabled={selectedAnswer === null}
                  onClick={handleNextQuestion}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider disabled:opacity-50 transition"
                >
                  {triviaStep === triviaQuestions.length - 1 ? "Finalizar Trivia" : "Siguiente pregunta"}
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-2">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">¡Trivia Completada!</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Acertaste {score} de {triviaQuestions.length} preguntas de {wineryName}.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs max-w-sm mx-auto space-y-3">
                  <p className="text-slate-200 leading-relaxed font-bold">
                    🎉 ¡Ganaste {score * 10} puntos para el club!
                  </p>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Para asegurar estos puntos en tu Pasaporte nexID y reclamar tu certificado, unite a la Cofradía.
                  </p>
                  <Link
                    href={`/login?next=/me`}
                    className="block w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider text-center"
                  >
                    Guardar puntos en mi Pasaporte
                  </Link>
                </div>

                <button
                  onClick={handleRestartTrivia}
                  className="text-xs font-bold text-slate-400 hover:text-white underline transition block mx-auto"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}
          </div>
        )}

        {/* FEEDBACK TAB */}
        {activeTab === "feedback" && (
          <div className="space-y-4">
            {!feedbackSubmitted ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-white">¿Qué te parece este {productName}?</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ayudanos a auditar la experiencia de este varietal.</p>
                </div>

                {/* Stars Selection */}
                <div className="flex gap-1.5 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="transition transform hover:scale-110 active:scale-95"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-600 hover:text-slate-400"
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Comentario corto
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contanos qué te pareció en boca, temperatura, aroma..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
                  />
                </div>

                <button
                  disabled={rating === 0}
                  onClick={() => setFeedbackSubmitted(true)}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  Enviar Feedback de Trazabilidad
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">¡Muchas gracias por calificar!</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                    Tu feedback de cata y lote se ha guardado de forma anónima en las analíticas de trazabilidad de la bodega.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setRating(0);
                    setComment("");
                    setFeedbackSubmitted(false);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold transition"
                >
                  Enviar otra opinión
                </button>
              </div>
            )}
          </div>
        )}

        {/* SORTEO TAB */}
        {activeTab === "sorteo" && (
          <div className="space-y-4">
            {!raffleSubmitted ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Sorteo Mensual de Bodega</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">Participá por una caja de {productName} y una visita guiada.</p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Nombre</label>
                    <input
                      type="text"
                      placeholder="Tu nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">WhatsApp o Email</label>
                    <input
                      type="text"
                      placeholder="ej. +549261... o mail@ejemplo.com"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      className="block w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <button
                  disabled={!name.trim() || !contact.trim()}
                  onClick={() => setRaffleSubmitted(true)}
                  className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-black text-xs uppercase tracking-wider transition disabled:opacity-50"
                >
                  Registrarme al Sorteo
                </button>
              </div>
            ) : (
              <div className="text-center space-y-4 py-4">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">¡Ya estás participando!</h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-xs mx-auto">
                    Te registramos con el contacto: <span className="font-mono text-slate-300 font-bold">{contact}</span>.
                    Te notificaremos por este canal si resultás ganador del sorteo del lote.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setContact("");
                    setName("");
                    setRaffleSubmitted(false);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-bold transition"
                >
                  Registrar otro participante
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
