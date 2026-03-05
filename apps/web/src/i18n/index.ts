import { en } from "./locales/en";
import { esAR } from "./locales/es-AR";
import { ptBR } from "./locales/pt-BR";
import type { WebLocale } from "./types";

export const webI18n: Record<WebLocale, typeof esAR> = {
  "es-AR": esAR,
  "pt-BR": ptBR,
  en,
};
