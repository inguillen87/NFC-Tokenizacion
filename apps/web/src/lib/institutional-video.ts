export const legacyInstitutionalVideo = "/video/nexid_institutional_es_1920x1080.mp4";

export const institutionalVideoDropTargets = {
  "es-AR": "/video/nexid_institutional_es_1920x1080.mp4",
  en: "/video/nexid_institutional_en_1920x1080.mp4",
  "pt-BR": "/video/nexid_institutional_pt_1920x1080.mp4",
} as const;

export const institutionalVideoPosters = {
  "es-AR": "/video/poster_nexid_institutional_es.jpg",
  en: "/video/poster_nexid_institutional_en.jpg",
  "pt-BR": "/video/poster_nexid_institutional_pt.jpg",
} as const;

export const institutionalVideoLightPosters = {
  "es-AR": "/video/poster_nexid_institutional_es_light.jpg",
  en: "/video/poster_nexid_institutional_en_light.jpg",
  "pt-BR": "/video/poster_nexid_institutional_pt_light.jpg",
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
    poster: institutionalVideoPosters[normalized] || institutionalVideoPosters["es-AR"],
    lightPoster: institutionalVideoLightPosters[normalized] || institutionalVideoLightPosters["es-AR"],
    type: "video/mp4",
  };
}
