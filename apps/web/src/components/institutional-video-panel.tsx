import Link from "next/link";
import { schedulingUrls } from "@product/config";
import { resolveInstitutionalVideo } from "../lib/institutional-video";

type InstitutionalVideoPanelProps = {
  locale: string;
  variant?: "landing" | "demo";
  className?: string;
};

export function InstitutionalVideoPanel({ locale, variant = "landing", className = "" }: InstitutionalVideoPanelProps) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const video = resolveInstitutionalVideo(locale);
  const copy = isEn
    ? {
      eyebrow: "Institutional video",
      title: "Understand nexID in one focused minute.",
      body: "Use the video as the fast explanation before the live product proof: physical tag, verified tap, mobile result and business data.",
      play: "nexID institutional",
      primary: "Open Demo Lab",
      secondary: "Schedule meeting",
      aria: "nexID institutional video",
      strip: "Physical product -> trusted tap -> customer passport -> CRM signal",
    }
    : isBr
      ? {
        eyebrow: "Video institucional",
        title: "Entenda nexID em um minuto.",
        body: "Use o video como explicacao rapida antes da prova ao vivo: tag fisica, toque verificado, resultado mobile e dados de negocio.",
        play: "Institucional nexID",
        primary: "Abrir Demo Lab",
        secondary: "Agendar reuniao",
        aria: "video institucional nexID",
        strip: "Produto fisico -> toque confiavel -> passport -> CRM",
      }
      : {
        eyebrow: "Video institucional",
        title: "Entender nexID en un minuto.",
        body: "Usa el video como explicacion rapida antes de la prueba viva: etiqueta fisica, toque verificado, resultado celular y datos de negocio.",
        play: "Institucional nexID",
        primary: "Abrir Demo Lab",
        secondary: "Agendar reunion",
        aria: "video institucional nexID",
        strip: "Producto fisico -> toque confiable -> pasaporte -> CRM",
      };

  return (
    <section className={`institutional-video-panel institutional-video-panel--${variant} ${className}`} aria-label={copy.aria}>
      <div className="institutional-video-copy">
        <p>{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
        <div className="institutional-video-actions">
          <Link href="/demo-lab">{copy.primary}</Link>
          <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer">{copy.secondary}</a>
        </div>
      </div>
      <div className="institutional-video-device">
        <div className="institutional-video-topbar">
          <span className="institutional-video-mark">N</span>
          <strong>nex<span>ID</span></strong>
          <em>{copy.play}</em>
        </div>
        <div className="institutional-video-frame">
          <video key={video.src} controls preload="metadata" playsInline controlsList="nodownload" data-video-locale={video.locale} data-video-target={video.futureSrc}>
            <source src={video.src} type={video.type} />
          </video>
          <span className="institutional-video-watermark">nexID</span>
        </div>
        <div className="institutional-video-strip">
          <span>{copy.strip}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
