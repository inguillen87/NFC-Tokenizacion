import type { DashboardLocale } from "./types";
import { en } from "./locales/en";
import { esAR } from "./locales/es-AR";
import { ptBR } from "./locales/pt-BR";

export const dashboardI18n: Record<DashboardLocale, typeof esAR> = {
  "es-AR": esAR,
  "pt-BR": ptBR,
  en,
};
