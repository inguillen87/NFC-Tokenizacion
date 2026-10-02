"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImageOff, Maximize2, X } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";
import styles from "./sun-product-image.module.css";

const imageCopy = {
  "es-AR": {
    loading: "Cargando imagen del producto",
    unavailable: "Imagen del producto no disponible",
    enlarge: "Ampliar imagen del producto",
    close: "Cerrar imagen",
    preview: "Imagen del producto",
    previewUnavailable: "No se pudo ampliar esta imagen",
  },
  en: {
    loading: "Loading product image",
    unavailable: "Product image unavailable",
    enlarge: "Enlarge product image",
    close: "Close image",
    preview: "Product image",
    previewUnavailable: "This image could not be enlarged",
  },
  "pt-BR": {
    loading: "Carregando imagem do produto",
    unavailable: "Imagem do produto indisponível",
    enlarge: "Ampliar imagem do produto",
    close: "Fechar imagem",
    preview: "Imagem do produto",
    previewUnavailable: "Não foi possível ampliar esta imagem",
  },
} as const;

type ImageCopy = (typeof imageCopy)[keyof typeof imageCopy];
type ImageState = "loading" | "ready" | "failed";

function ProductImageDialog({ image, alt, copy, trigger, onDismiss }: {
  image: HTMLImageElement;
  alt: string;
  copy: ImageCopy;
  trigger: HTMLButtonElement | null;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const canvas = canvasRef.current;
    if (!dialog || !canvas) return;
    try {
      // Reuse the supplied image's decoded bitmap. Opening never fetches it again.
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("image_preview_unavailable");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } catch {
      setPreviewFailed(true);
    }
    dialog.showModal();
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (trigger?.isConnected && !trigger.disabled && !trigger.closest("[inert]")) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [image, trigger]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      data-testid="sun-image-dialog"
      onCancel={(event) => { event.preventDefault(); onDismiss(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const targets = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((target) => target.getClientRects().length > 0);
        const first = targets[0];
        const last = targets[targets.length - 1];
        if (first && last && (targets.length === 1 || (event.shiftKey ? document.activeElement === first : document.activeElement === last))) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }}
      onClose={() => { if (!dialogRef.current?.open) onDismiss(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
      }}
    >
      <div className={styles.dialogHeader}>
        <div>
          <p>{copy.preview}</p>
          <h2 id={titleId} data-sun-server-evidence="true">{alt}</h2>
        </div>
        <button ref={closeRef} type="button" className={styles.closeButton} aria-label={copy.close} data-testid="sun-image-close" onClick={onDismiss}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.dialogMedia}>
        <canvas ref={canvasRef} hidden={previewFailed} role="img" aria-label={alt} data-sun-server-evidence="true" data-testid="sun-image-expanded" />
        {previewFailed && <p role="status">{copy.previewUnavailable}</p>}
      </div>
    </dialog>
  );
}

// Only presents contract-supplied media. Failure never substitutes a stock item.
export function SunProductImage({ src, alt, className, priority = false, zoomable = false }: {
  src: string; alt: string; className?: string; priority?: boolean; zoomable?: boolean;
}) {
  const { locale } = useSunLocale();
  const copy = imageCopy[locale];
  const [sourceState, setSourceState] = useState<{ src: string; state: ImageState }>({ src, state: "loading" });
  const [zoomedSource, setZoomedSource] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const decodingRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef<HTMLButtonElement>(null);
  const state = sourceState.src === src ? sourceState.state : "loading";

  const changeState = (image: HTMLImageElement, source: string, next: ImageState) => {
    if (image !== imageRef.current || image.getAttribute("src") !== source) return;
    setSourceState((previous) => previous.src === source && previous.state === next ? previous : { src: source, state: next });
  };
  const finishLoading = async (image: HTMLImageElement, source: string) => {
    if (image !== imageRef.current || decodingRef.current === image) return;
    decodingRef.current = image;
    try {
      await image.decode();
      changeState(image, source, image.complete && image.naturalWidth > 0 ? "ready" : "failed");
    } catch {
      changeState(image, source, "failed");
    } finally {
      if (decodingRef.current === image) decodingRef.current = null;
    }
  };

  useEffect(() => {
    setHydrated(true);
    setZoomedSource(null);
    // Cached success and failure can precede React's load/error handlers.
    const image = imageRef.current;
    if (!image?.complete) return;
    if (image.naturalWidth === 0) changeState(image, src, "failed");
    else void finishLoading(image, src);
  }, [src]);

  if (state === "failed") return (
    <div className={`${className || ""} ${styles.fallback}`} role="img" aria-label={copy.unavailable} data-testid="sun-image-unavailable">
      <ImageOff size={28} aria-hidden="true" /><span>{copy.unavailable}</span>
    </div>
  );
  return (
    <>
      <img
        key={src}
        ref={imageRef}
        src={src}
        alt={alt}
        className={`${className || ""} ${styles.image}`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        referrerPolicy="no-referrer"
        data-testid="sun-product-image"
        data-image-state={state}
        onLoad={(event) => { void finishLoading(event.currentTarget, src); }}
        onError={(event) => changeState(event.currentTarget, src, "failed")}
      />
      {hydrated && state === "loading" && <div className={styles.loading} role="status" aria-label={copy.loading} data-testid="sun-image-loading"><span aria-hidden="true" />{copy.loading}</div>}
      {zoomable && state === "ready" && <button ref={zoomRef} type="button" className={styles.zoomButton} aria-label={copy.enlarge} aria-haspopup="dialog" data-testid="sun-image-zoom" onClick={() => setZoomedSource(src)}><Maximize2 size={18} aria-hidden="true" /></button>}
      {zoomedSource === src && state === "ready" && imageRef.current && <ProductImageDialog image={imageRef.current} alt={alt} copy={copy} trigger={zoomRef.current} onDismiss={() => setZoomedSource(null)} />}
    </>
  );
}
