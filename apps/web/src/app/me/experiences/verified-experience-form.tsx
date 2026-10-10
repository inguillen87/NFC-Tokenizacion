"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Camera, CheckCircle2, Link2, MessageSquareText, Send, ShieldCheck, Star, X } from "lucide-react";
import { requestConsumerJson } from "../../../lib/consumer-request";
import styles from "./verified-experience-form.module.css";

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
  customer_action_unpublished: "La marca dejó de recibir opiniones desde este producto. Conservamos tu comentario y foto; podés volver a consultar la ficha.",
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
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [state, setState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const [createdTrust, setCreatedTrust] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoRevision = useRef(0);
  const submissionLock = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; photoRevision.current += 1; };
  }, []);

  const canSubmit = useMemo(() => {
    return Boolean(eventId && rating >= 1 && rating <= 5 && body.trim().length >= 12 && !preparingPhoto && state !== "sending");
  }, [body, eventId, rating, state, preparingPhoto]);

  function clearPhoto() {
    photoRevision.current += 1;
    setPreparingPhoto(false);
    setPhotoUrl("");
    setPhotoFileName("");
    setPhotoError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function processPhotoFile(file: File) {
    const revision = ++photoRevision.current;
    setPreparingPhoto(true);
    setPhotoError("");
    setPhotoFileName(`Optimizando ${file.name}...`);

    try {
      const result = await compressPhotoFile(file);
      if (!mounted.current || revision !== photoRevision.current) return;
      if (!result.startsWith("data:image/")) {
        setPhotoError("No pudimos leer esa foto.");
        setPhotoFileName("");
        return;
      }

      setPhotoUrl(result);
      setPhotoFileName(`${file.name} optimizada`);
      setPhotoError("");
    } catch {
      if (!mounted.current || revision !== photoRevision.current) return;
      setPhotoFileName("");
      setPhotoError("No pudimos optimizar esa foto. Proba con otra imagen o pegá un link.");
    } finally {
      if (mounted.current && revision === photoRevision.current) setPreparingPhoto(false);
    }
  }

  function handlePhotoFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    photoRevision.current += 1;
    setPreparingPhoto(false);

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
    if (submissionLock.current || preparingPhoto) return;
    if (!canSubmit) {
      setState("error");
      setMessage(eventId ? errorCopy.body_too_short : errorCopy.verified_evidence_required);
      return;
    }

    submissionLock.current = true;
    setState("sending");
    setMessage("Enviando experiencia verificada...");
    setCreatedTrust(null);

    const photoUrls = photoUrl.trim() ? [photoUrl.trim()] : [];
    const response = await requestConsumerJson("/api/consumer/experiences", {
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
    });

    const payload = response.status === "received" ? response.payload : null;
    submissionLock.current = false;
    if (!mounted.current) return;

    if (response.status !== "received" || !response.ok || payload?.ok === false) {
      const error = String(payload?.error || "unknown_error");
      setState("error");
      setMessage(errorCopy[error] || "No pudimos confirmar que se haya guardado. Conservamos tu comentario y foto. Revisa Mis experiencias antes de volver a enviar.");
      return;
    }

    // The API returns the persisted row. A generic 2xx response is not a receipt.
    const item = payload?.item && typeof payload.item === "object" && !Array.isArray(payload.item) ? payload.item as Record<string, unknown> : null;
    if (payload?.ok !== true || !item || typeof item.id !== "string"
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
      || item.id === "00000000-0000-0000-0000-000000000000"
      || String(item.event_id) !== eventId || item.visibility !== "private" || item.moderation_status !== "pending") {
      setState("error");
      setMessage("No pudimos confirmar que se haya guardado. Conservamos tu comentario y foto. Revisa Mis experiencias antes de volver a enviar.");
      return;
    }

    setState("success");
    setCreatedTrust(item.trust_score_status === "computed" && typeof item.trust_score === "number" && Number.isFinite(item.trust_score) ? item.trust_score : null);
    setMessage("Lista. Quedo guardada como experiencia privada y pasa a moderacion de la marca.");
    setTitle("");
    setBody("");
    clearPhoto();
  }

  return (
    <section data-testid="verified-experience-form" className={styles.experience}>
      <div className={styles.header}>
        <div className={styles.introBlock}>
          <p className={styles.eyebrow}>Dejar experiencia verificada</p>
          <h2 className={styles.heading}>Compartí tu experiencia con la marca.</h2>
          <p className={styles.intro}>
            Tu comentario queda asociado a tu cuenta y al registro del producto.
            La marca revisa la información antes de publicarla.
          </p>
        </div>
        <div className={styles.reviewNote}>
          <div className={styles.noteTitle}>
            <ShieldCheck className={styles.icon} aria-hidden="true" />
            <span>Con revisión de la marca</span>
          </div>
          <p className={styles.muted}>
            Podés consultar el estado de tu comentario en Mis experiencias.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.panel}>
          <p className={styles.fieldLabel}>Producto</p>
          <p className={styles.productName}>{initialProductName || "Producto asociado"}</p>
          <p className={styles.muted}>{tenant ? `Marca: ${tenant}` : "Club de marca"}</p>
          <div className={styles.metadata}>
            {[
              ["Referencia de lectura", eventId ? `#${eventId}; se comprueba al enviar` : "Pendiente"],
              ["Cuenta", "Requiere acceso al Pasaporte"],
              ["Publicacion", "Privada hasta moderacion"],
            ].map(([label, value]) => (
              <div key={label} className={styles.metadataRow}>
                <p className={styles.fieldLabel}>{label}</p>
                <p className={styles.metadataValue}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        <form className={styles.form} aria-busy={state === "sending" || preparingPhoto} onSubmit={(event) => { event.preventDefault(); void submitExperience(); }}>
          <fieldset disabled={state === "sending"} className={styles.fields}>
          <div className={styles.panel}>
            <span className={styles.fieldLabel}>Estrellas</span>
            <div className={styles.rating} role="radiogroup" aria-label="Puntaje">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className={`${styles.star} ${value <= rating ? styles.starSelected : ""}`}
                >
                  <input type="radio" name="experience-rating" value={value} checked={value === rating} onChange={() => setRating(value)} aria-label={`${value} ${value === 1 ? "estrella" : "estrellas"}`} className="sr-only" />
                  <Star className={styles.starIcon} aria-hidden="true" />
                </label>
              ))}
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label className={styles.panel}>
              <span className={styles.fieldLabel}>Titulo corto</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={96}
                placeholder="Ej: Excelente guarda"
                className={styles.control}
              />
            </label>
            <div className={styles.panel}>
              <span className={styles.fieldLabel}>Foto opcional</span>
              <p className={styles.muted}>
                Agregá una foto del producto. En el teléfono podés usar la cámara.
              </p>
              <input
                aria-label="Foto del producto"
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                className="sr-only"
                onChange={handlePhotoFile}
              />
              <div className={styles.photoActions}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={styles.secondaryButton}
                >
                  <Camera className={styles.icon} aria-hidden="true" />
                  Subir foto
                </button>
                {photoUrl || preparingPhoto ? (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    className={styles.secondaryButton}
                  >
                    <X className={styles.icon} aria-hidden="true" />
                    Quitar
                  </button>
                ) : null}
              </div>
              <p className={styles.muted}>
                {preparingPhoto ? photoFileName : photoFileName ? `Foto lista: ${photoFileName}` : "Tambien podes pegar un link de imagen si ya la tenes subida."}
              </p>
              <div className={styles.linkLabel}>
                <Link2 className={styles.icon} aria-hidden="true" />
                Link opcional
              </div>
              <input
                aria-label="Link de la foto (opcional)"
                value={photoUrl.startsWith("data:") ? "" : photoUrl}
                disabled={photoUrl.startsWith("data:")}
                onChange={(event) => {
                  photoRevision.current += 1;
                  setPreparingPhoto(false);
                  setPhotoFileName("");
                  setPhotoError("");
                  setPhotoUrl(event.target.value);
                }}
                placeholder="https://..."
                className={styles.control}
              />
              {photoError ? <p className={styles.fieldError} role="alert">{photoError}</p> : null}
              {preparingPhoto ? <p role="status" className={styles.photoStatus}>Preparando tu foto antes de enviar…</p> : null}
            </div>
          </div>

          <label className={styles.panel}>
            <span id="experience-comment-label" className={styles.linkLabel}>
              <MessageSquareText className={styles.icon} aria-hidden="true" />
              Comentario
            </span>
            <textarea
              aria-labelledby="experience-comment-label"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1200}
              rows={5}
              placeholder="Contale a otra persona que va a comprar: como lo viviste, que te gusto, si lo recomendarias y para que ocasion."
              className={styles.control}
            />
          </label>

          <div className={styles.submitRow}>
            <p className={styles.muted}>
              Se guarda privada, se modera, y despues puede aparecer como experiencia verificada en producto, marketplace y club.
            </p>
            <button
              type="submit"
              disabled={!canSubmit}
              className={styles.submitButton}
            >
              <Send className={styles.icon} aria-hidden="true" />
              {state === "sending" ? "Enviando experiencia…" : "Enviar experiencia"}
            </button>
          </div>
          </fieldset>

          {message ? (
            <div
              role={state === "error" ? "alert" : "status"}
              className={`${styles.feedback} ${state === "success" ? styles.success : state === "error" ? styles.error : styles.pending}`}
            >
              {state === "success" ? <CheckCircle2 className={styles.icon} aria-hidden="true" /> : <AlertCircle className={styles.icon} aria-hidden="true" />}
              <p>
                {message}
                {createdTrust !== null ? <span className={styles.trustScore}>Trust {createdTrust}/100</span> : null}
              </p>
              {state === "error" ? <a href="/me/experiences" className={styles.recoveryLink}>Consultar mis experiencias</a> : null}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
