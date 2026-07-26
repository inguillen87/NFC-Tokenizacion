"use client";

import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Link2, MessageSquareText, Send, ShieldCheck, Star, X } from "lucide-react";

type Props = {
  initialEventId?: string;
  initialProductName?: string;
  tenant?: string;
};

type SubmitState = "idle" | "sending" | "success" | "error";

const MAX_ORIGINAL_PHOTO_BYTES = 12_000_000;
const MAX_COMPRESSED_DATA_URL_CHARS = 1_650_000;
const MAX_IMAGE_DIMENSION = 1920;
const acceptedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const errorCopy: Record<string, string> = {
  unauthorized: "Necesitas iniciar sesion o validar tu email/celular antes de opinar.",
  rating_required: "Elegi una cantidad de estrellas.",
  body_too_short: "Contanos un poco mas. Una experiencia util necesita al menos una frase clara.",
  verified_evidence_required: "Abrilo desde un producto guardado o desde un tap validado para asociar evidencia real.",
  verified_evidence_not_found: "No encontramos ese tap dentro de tu cuenta. Volve al producto y toca Dejar experiencia.",
  review_blocked_by_risk_policy: "Este producto tiene una alerta de riesgo. La marca debe revisarlo antes de aceptar experiencias.",
  invalid_json: "No se pudo leer la experiencia. Revisa los campos e intenta de nuevo.",
};

function normalizeEventId(value: unknown) {
  const text = String(value || "").trim();
  return /^\d+$/.test(text) ? text : "";
}

function getLocale() {
  if (typeof navigator === "undefined") return "es-AR";
  return navigator.language || "es-AR";
}

function readImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image_load_failed"));
    };
    image.src = url;
  });
}

async function compressPhotoFile(file: File) {
  const source = await readImageElement(file);
  const sourceWidth = source.naturalWidth || source.width;
  const sourceHeight = source.naturalHeight || source.height;
  if (!sourceWidth || !sourceHeight) throw new Error("image_size_unavailable");

  let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
  let targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  let targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("canvas_unavailable");

  for (let pass = 0; pass < 3; pass += 1) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(source, 0, 0, targetWidth, targetHeight);

    for (const quality of [0.86, 0.78, 0.7, 0.62]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_COMPRESSED_DATA_URL_CHARS) return dataUrl;
    }

    scale *= 0.78;
    targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  }

  throw new Error("image_too_large_after_compression");
}

export function VerifiedExperienceForm({ initialEventId, initialProductName, tenant }: Props) {
  const eventId = normalizeEventId(initialEventId);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [createdTrust, setCreatedTrust] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(eventId && rating >= 1 && rating <= 5 && body.trim().length >= 12 && state !== "sending");
  }, [body, eventId, rating, state]);

  function clearPhoto() {
    setPhotoUrl("");
    setPhotoFileName("");
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function processPhotoFile(file: File) {
    setPhotoError("");
    setPhotoFileName(`Optimizando ${file.name}...`);

    try {
      const result = await compressPhotoFile(file);
      if (!result.startsWith("data:image/")) {
        setPhotoError("No pudimos leer esa foto.");
        setPhotoFileName("");
        return;
      }

      setPhotoUrl(result);
      setPhotoFileName(`${file.name} optimizada`);
      setPhotoError("");
    } catch {
      setPhotoUrl("");
      setPhotoFileName("");
      setPhotoError("No pudimos optimizar esa foto. Proba con otra imagen o pegá un link.");
    }
  }

  function handlePhotoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!acceptedPhotoTypes.has(file.type)) {
      setPhotoError("Usa una foto JPG, PNG o WEBP.");
      return;
    }

    if (file.size > MAX_ORIGINAL_PHOTO_BYTES) {
      setPhotoError("La foto pesa demasiado. Usa una imagen de hasta 12 MB; la optimizamos antes de subir.");
      return;
    }

    void processPhotoFile(file);
  }

  async function submitExperience() {
    if (!canSubmit) {
      setState("error");
      setMessage(eventId ? errorCopy.body_too_short : errorCopy.verified_evidence_required);
      return;
    }

    setState("sending");
    setMessage("Enviando experiencia verificada...");
    setCreatedTrust(null);

    const photoUrls = photoUrl.trim() ? [photoUrl.trim()] : [];
    const response = await fetch("/api/consumer/experiences", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId,
        rating,
        title: title.trim(),
        body: body.trim(),
        locale: getLocale(),
        photoUrls,
      }),
    }).catch(() => null);

    const payload = await response?.json().catch(() => null);

    if (!response?.ok || payload?.ok === false) {
      const error = String(payload?.error || "unknown_error");
      setState("error");
      setMessage(errorCopy[error] || "No se pudo guardar. Proba de nuevo desde un tap fresco o producto guardado.");
      return;
    }

    setState("success");
    setCreatedTrust(Number(payload?.item?.trust_score || 0) || null);
    setMessage("Lista. Quedo guardada como experiencia privada y pasa a moderacion de la marca.");
    setTitle("");
    setBody("");
    clearPhoto();
  }

  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.97))] p-5 shadow-2xl shadow-emerald-950/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Dejar experiencia verificada</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Tu opinion vale porque nace de un producto real.</h2>
          <p className="mt-2 text-sm leading-6 text-emerald-50/82">
            Solo publicamos experiencias con evidencia: tap fisico, cuenta validada y producto guardado o reclamado.
            La marca puede moderarla antes de mostrarla en el club y marketplace.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-200" aria-hidden="true" />
            <span className="font-black text-white">Brand-safe</span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            No hay reviews anonimas: cada comentario queda ligado a evidencia verificable.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Producto</p>
          <p className="mt-2 text-lg font-black text-white">{initialProductName || "Producto asociado"}</p>
          <p className="mt-1 text-xs text-slate-400">{tenant ? `Tenant ${tenant}` : "Club de marca"}</p>
          <div className="mt-4 grid gap-2">
            {[
              ["Tap fisico", eventId ? `Evento #${eventId}` : "Pendiente"],
              ["Contacto", "Email o celular validado"],
              ["Publicacion", "Privada hasta moderacion"],
              ["Traduccion", "Lista para multi-idioma"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-[0.13em] text-cyan-200">{label}</p>
                <p className="mt-1 text-xs font-semibold text-slate-200">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Estrellas</label>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Puntaje">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                    value <= rating
                      ? "border-amber-300/45 bg-amber-500/20 text-amber-100"
                      : "border-white/10 bg-white/[0.03] text-slate-500 hover:text-amber-100"
                  }`}
                  aria-pressed={value <= rating}
                >
                  <Star className="h-5 w-5 fill-current" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Titulo corto</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={96}
                placeholder="Ej: Excelente guarda"
                className="mt-3 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
              />
            </label>
            <div className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Foto opcional</span>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Subi una foto real del producto. En mobile abre camara; si es HD la optimizamos antes de guardar.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoFile}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/18"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  Subir foto
                </button>
                {photoUrl ? (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Quitar
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                {photoFileName ? `Foto lista: ${photoFileName}` : "Tambien podes pegar un link de imagen si ya la tenes subida."}
              </p>
              <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                Link opcional
              </div>
              <input
                value={photoUrl.startsWith("data:") ? "" : photoUrl}
                disabled={photoUrl.startsWith("data:")}
                onChange={(event) => {
                  setPhotoFileName("");
                  setPhotoError("");
                  setPhotoUrl(event.target.value);
                }}
                placeholder="https://..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              {photoError ? <p className="mt-2 text-xs font-semibold text-rose-200">{photoError}</p> : null}
            </div>
          </div>

          <label className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              Comentario
            </span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1200}
              rows={5}
              placeholder="Contale a otra persona que va a comprar: como lo viviste, que te gusto, si lo recomendarias y para que ocasion."
              className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-3 text-sm font-semibold leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/40"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-xs leading-5 text-slate-400">
              Se guarda privada, se modera, y despues puede aparecer como experiencia verificada en producto, marketplace y club.
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submitExperience()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/35 bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Enviar experiencia
            </button>
          </div>

          {message ? (
            <div
              className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${
                state === "success"
                  ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-50"
                  : state === "error"
                    ? "border-rose-300/30 bg-rose-500/10 text-rose-50"
                    : "border-cyan-300/30 bg-cyan-500/10 text-cyan-50"
              }`}
            >
              {state === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
              <p>
                {message}
                {createdTrust !== null ? <span className="ml-2 font-black">Trust {createdTrust}/100</span> : null}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
