"use client";

import { sunDemoScenarioHref, type SunGalleryDemoProfile } from "../../lib/sun-demo-links";
import { useSunLocale } from "./sun-locale-provider";
import type { SunDemoScenario } from "./sun-demo-scenario";
import styles from "./sun-demo-gallery.module.css";

const COPY = {
  "es-AR": { title: "Compará los estados de esta demo", note: "Simulación sin tap físico. Abierto no significa falsificado.", closed: "Cerrado", opened: "Abierto", invalid: "Lectura no válida" },
  en: { title: "Compare the states in this demo", note: "Simulation without a physical tap. Open does not mean counterfeit.", closed: "Closed", opened: "Open", invalid: "Invalid reading" },
  "pt-BR": { title: "Compare os estados desta demo", note: "Simulação sem toque físico. Aberto não significa falsificado.", closed: "Fechado", opened: "Aberto", invalid: "Leitura inválida" },
} as const;

export function SunDemoScenarioSelector({ profile, scenario, compact = false }: { profile: SunGalleryDemoProfile; scenario?: SunDemoScenario; compact?: boolean }) {
  const { locale } = useSunLocale();
  const copy = COPY[locale];
  return (
    <div className={`${styles.scenarioSelector} ${compact ? styles.compactSelector : ""}`} data-testid={compact ? undefined : "sun-demo-scenario-selector"}>
      <p className={styles.scenarioTitle}>{copy.title}</p>
      <nav className={styles.scenarioLinks} aria-label={copy.title}>
        {(["closed", "opened", "invalid"] as const).map((state) => (
          <a key={state} href={`${sunDemoScenarioHref(profile, state)}&lang=${encodeURIComponent(locale)}`} data-demo-scenario-profile={profile} data-demo-scenario={state} aria-current={scenario === state ? "page" : undefined} referrerPolicy="no-referrer">
            <span className={styles.scenarioDot} aria-hidden="true" />{copy[state]}
          </a>
        ))}
      </nav>
      {!compact ? <p className={styles.scenarioNote}>{copy.note}</p> : null}
    </div>
  );
}
