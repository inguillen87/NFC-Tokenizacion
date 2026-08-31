"use client";

import type { AppLocale } from "@product/config";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./public-route-context.module.css";

type SectionKey = "solutions" | "platform" | "resources";
type PageKey =
  | "pricing"
  | "demo"
  | "proof"
  | "sun"
  | "offline"
  | "login"
  | "sdk"
  | "about"
  | "docs"
  | "stack"
  | "glossary"
  | "audiences"
  | "resellers";

type RouteContext = {
  prefix: string;
  section: SectionKey;
  page: PageKey;
};

const routeContexts: readonly RouteContext[] = [
  { prefix: "/pricing", section: "solutions", page: "pricing" },
  { prefix: "/demo", section: "platform", page: "demo" },
  { prefix: "/proof", section: "platform", page: "proof" },
  { prefix: "/sun", section: "platform", page: "sun" },
  { prefix: "/offline", section: "platform", page: "offline" },
  { prefix: "/login", section: "platform", page: "login" },
  { prefix: "/sdk", section: "platform", page: "sdk" },
  { prefix: "/about", section: "resources", page: "about" },
  { prefix: "/docs", section: "resources", page: "docs" },
  { prefix: "/stack", section: "resources", page: "stack" },
  { prefix: "/glossary", section: "resources", page: "glossary" },
  { prefix: "/audiences", section: "resources", page: "audiences" },
  { prefix: "/resellers", section: "resources", page: "resellers" },
];

const copyByLocale = {
  "es-AR": {
    aria: "Contexto de la sección",
    sections: { solutions: "Soluciones", platform: "Plataforma", resources: "Recursos" },
    pages: {
      pricing: "Planes y pilotos",
      demo: "Experiencia guiada",
      proof: "Evidencia pública",
      sun: "Seguridad NFC",
      offline: "Modo offline",
      login: "Portal del consumidor",
      sdk: "SDK y APIs",
      about: "Quiénes somos",
      docs: "Documentación",
      stack: "Arquitectura",
      glossary: "Glosario",
      audiences: "Por audiencia",
      resellers: "Programa reseller",
    },
  },
  "pt-BR": {
    aria: "Contexto da seção",
    sections: { solutions: "Soluções", platform: "Plataforma", resources: "Recursos" },
    pages: {
      pricing: "Planos e pilotos",
      demo: "Experiência guiada",
      proof: "Evidência pública",
      sun: "Segurança NFC",
      offline: "Modo offline",
      login: "Portal do consumidor",
      sdk: "SDK e APIs",
      about: "Quem somos",
      docs: "Documentação",
      stack: "Arquitetura",
      glossary: "Glossário",
      audiences: "Por público",
      resellers: "Programa reseller",
    },
  },
  en: {
    aria: "Section context",
    sections: { solutions: "Solutions", platform: "Platform", resources: "Resources" },
    pages: {
      pricing: "Plans and pilots",
      demo: "Guided experience",
      proof: "Public evidence",
      sun: "NFC security",
      offline: "Offline mode",
      login: "Consumer portal",
      sdk: "SDK and APIs",
      about: "About us",
      docs: "Documentation",
      stack: "Architecture",
      glossary: "Glossary",
      audiences: "By audience",
      resellers: "Reseller program",
    },
  },
} as const;

function matchesPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function PublicRouteContext({ locale }: { locale: AppLocale }) {
  const pathname = usePathname() || "/";
  const copy = copyByLocale[locale];
  const context = routeContexts.find((candidate) => matchesPath(pathname, candidate.prefix));

  if (!context) {
    return null;
  }

  return (
    <div className={styles.context} data-nav-inert>
      <div className={styles.inner}>
        <nav className={styles.breadcrumb} aria-label={copy.aria}>
          <Link href="/" className={styles.home}>nexID</Link>
          <span className={styles.separator} aria-hidden="true">/</span>
          <span className={styles.section}>{copy.sections[context.section]}</span>
          <span className={`${styles.separator} ${styles.currentSeparator}`} aria-hidden="true">/</span>
          <span className={styles.current} aria-current="page">{copy.pages[context.page]}</span>
        </nav>
      </div>
    </div>
  );
}
