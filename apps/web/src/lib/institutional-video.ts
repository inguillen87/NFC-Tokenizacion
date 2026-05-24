export const legacyInstitutionalVideo = "/video/nexid-institutional-english-sub-es-1080p.mp4";

export const institutionalVideoDropTargets = {
  "es-AR": "/video/nexid-institutional-es-1080p.mp4",
  en: "/video/nexid-institutional-en-1080p.mp4",
  "pt-BR": "/video/nexid-institutional-pt-1080p.mp4",
} as const;

const activeInstitutionalVideos: Record<string, string> = {
  "es-AR": institutionalVideoDropTargets["es-AR"],
  en: institutionalVideoDropTargets.en,
  "pt-BR": institutionalVideoDropTargets["pt-BR"],
};

export function resolveInstitutionalVideo(locale: string) {
  const normalized = locale === "en" || locale === "pt-BR" ? locale : "es-AR";
  return {
    locale: normalized,
    src: activeInstitutionalVideos[normalized] || activeInstitutionalVideos["es-AR"],
    futureSrc: institutionalVideoDropTargets[normalized],
    type: "video/mp4",
  };
}
