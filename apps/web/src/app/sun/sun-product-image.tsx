"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { useSunLocale } from "./sun-locale-provider";
import styles from "./sun-product-image.module.css";

// Only presents contract-supplied media. Failure never substitutes a stock item.
export function SunProductImage({ src, alt, className, priority = false }: {
  src: string; alt: string; className?: string; priority?: boolean;
}) {
  const { locale } = useSunLocale();
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached failure may occur before React attaches the error handler.
    const image = imageRef.current;
    if (image?.complete && image.naturalWidth === 0) setFailedSource(src);
  }, [src]);
  const failed = failedSource === src;
  const label = locale === "en" ? "Product image unavailable" : locale === "pt-BR" ? "Imagem do produto indisponível" : "Imagen del producto no disponible";
  if (failed) return <div className={`${className || ""} ${styles.fallback}`} role="img" aria-label={label} data-testid="sun-image-unavailable"><ImageOff size={28} aria-hidden="true"/><span>{label}</span></div>;
  return <img ref={imageRef} src={src} alt={alt} className={className} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "low"} onError={() => setFailedSource(src)}/>;
}
