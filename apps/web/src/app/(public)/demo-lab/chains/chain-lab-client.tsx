"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Check,
  CircleAlert,
  CircleDashed,
  Database,
  ExternalLink,
  FileCheck2,
  Fingerprint,
  Info,
  Link2,
  LockKeyhole,
  Network,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { ThemeToggle } from "@product/ui";
import styles from "./chain-lab.module.css";

export type LabGoal = "audit" | "ownership" | "dual";
type LabStatusCode = "verified" | "partial" | "configured" | "unavailable";
type CheckState = "pass" | "warn" | "unavailable";

type LabStatus = {
  code: LabStatusCode;
  label: string;
  shortLabel: string;
  explanation: string;
};

type LabEvidence = {
  id: string;
  label: string;
  value: string;
  displayValue: string;
  href: string | null;
};

type LabSample = {
  id: string;
  title: string;
  claim: string;
  state: LabStatusCode;
  stateLabel: string;
  anchorHash: string | null;
  anchorExplorerUrl: string | null;
  receiptHash: string | null;
  receiptExplorerUrl: string | null;
  merkleRoot: string | null;
  eventHash: string | null;
};

type LabChain = {
  id: "iota" | "polygon";
  name: string;
  role: string;
  network: string;
  environment: string;
  status: LabStatus;
  headline: string;
  summary: string;
  plainLanguage: string;
  checks: Array<{ id: string; label: string; state: CheckState; detail: string }>;
  metrics: Array<{ label: string; value: string }>;
  evidence: LabEvidence[];
  samples: LabSample[];
  proofBoundary: { proves: string[]; doesNotProve: string[] };
  actions: {
    primary: { href: string; label: string };
    secondary: { href: string; label: string; external?: boolean } | null;
  };
};

export type ChainLabModel = {
  environment: string;
  environmentNotice: string;
  observedAt: string;
  status: LabStatus;
  sources: {
    catalog: { ok: boolean; status: number; error: string | null };
    certificate: { ok: boolean; status: number; error: string | null };
    warnings: string[];
  };
  privacy: string;
  chains: { iota: LabChain; polygon: LabChain };
};

type ChainLabClientProps = {
  model: ChainLabModel;
  initialGoal: LabGoal;
};

const GOALS: Array<{
  id: LabGoal;
  eyebrow: string;
  title: string;
  body: string;
  outcome: string;
  chains: Array<"iota" | "polygon">;
}> = [
  {
    id: "audit",
    eyebrow: "Auditoria y trazabilidad",
    title: "Quiero demostrar que una evidencia no cambio",
    body: "Para QA, cadena de frio, entrega, stewardship, sensores o un hito de custodia.",
    outcome: "Usa IOTA como recibo hash-only; los datos operativos siguen privados en nexID.",
    chains: ["iota"],
  },
  {
    id: "ownership",
    eyebrow: "Propiedad y garantia",
    title: "Quiero demostrar quien controla un token",
    body: "Para ownership, certificado NFT, garantia con registro digital o una futura reventa gobernada.",
    outcome: "Usa Polygon para inspeccionar mint, holder y metadata en testnet. Este laboratorio no ejecuta transferencias, pagos ni settlement.",
    chains: ["polygon"],
  },
  {
    id: "dual",
    eyebrow: "Caso enterprise combinado",
    title: "Quiero explicar el circuito completo",
    body: "Primero integridad de eventos; despues ownership solo cuando el negocio lo necesita.",
    outcome: "IOTA y Polygon cumplen funciones distintas. nexID orquesta ambas sin escribir cada tap en blockchain.",
    chains: ["iota", "polygon"],
  },
];

const STEPS = [
  { label: "Objetivo", helper: "Que queres probar" },
  { label: "Roles", helper: "Que hace cada red" },
  { label: "Evidencia", helper: "Que respondio hoy" },
  { label: "Verificar", helper: "Abrir la prueba" },
] as const;

function StatusIcon({ code }: { code: LabStatusCode }) {
  if (code === "verified") return <BadgeCheck aria-hidden="true" />;
  if (code === "partial") return <CircleAlert aria-hidden="true" />;
  if (code === "configured") return <CircleDashed aria-hidden="true" />;
  return <X aria-hidden="true" />;
}

function CheckIcon({ state }: { state: CheckState }) {
  if (state === "pass") return <Check aria-hidden="true" />;
  if (state === "warn") return <CircleAlert aria-hidden="true" />;
  return <CircleDashed aria-hidden="true" />;
}

function statusClass(code: LabStatusCode) {
  if (code === "verified") return styles.statusVerified;
  if (code === "partial") return styles.statusPartial;
  if (code === "configured") return styles.statusConfigured;
  return styles.statusUnavailable;
}

function checkClass(state: CheckState) {
  if (state === "pass") return styles.checkPass;
  if (state === "warn") return styles.checkWarn;
  return styles.checkUnavailable;
}

function chainIcon(id: LabChain["id"]) {
  return id === "iota" ? <Network aria-hidden="true" /> : <WalletCards aria-hidden="true" />;
}

function utcTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function ChainRoleCard({ chain }: { chain: LabChain }) {
  return (
    <article className={styles.roleCard} data-chain={chain.id}>
      <div className={styles.roleCardHeader}>
        <span className={styles.chainIcon}>{chainIcon(chain.id)}</span>
        <div>
          <span className={styles.eyebrow}>{chain.environment} · {chain.network}</span>
          <h3>{chain.name}</h3>
        </div>
        <span className={`${styles.statusPill} ${statusClass(chain.status.code)}`}>
          <StatusIcon code={chain.status.code} />
          {chain.status.shortLabel}
        </span>
      </div>
      <p className={styles.role}>{chain.role}</p>
      <p>{chain.summary}</p>
      <div className={styles.plainLanguage}>
        <Info aria-hidden="true" />
        <strong>En castellano:</strong> {chain.plainLanguage}
      </div>
      <div className={styles.boundaryGrid}>
        <div>
          <span className={styles.boundaryTitle}><Check aria-hidden="true" /> Si prueba</span>
          <ul>
            {chain.proofBoundary.proves.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div>
          <span className={`${styles.boundaryTitle} ${styles.boundaryTitleNegative}`}><X aria-hidden="true" /> No prueba por si solo</span>
          <ul>
            {chain.proofBoundary.doesNotProve.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>
    </article>
  );
}

function EvidenceCard({ chain }: { chain: LabChain }) {
  return (
    <article className={styles.evidenceCard} data-chain={chain.id}>
      <header className={styles.evidenceHeader}>
        <div>
          <span className={styles.eyebrow}>{chain.name} · consulta pública actual</span>
          <h3>{chain.headline}</h3>
        </div>
        <span className={`${styles.statusPill} ${statusClass(chain.status.code)}`}>
          <StatusIcon code={chain.status.code} />
          {chain.status.label}
        </span>
      </header>

      <dl className={styles.metrics}>
        {chain.metrics.map((metric) => (
          <div key={metric.label}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.checks} aria-label={`Comprobaciones ${chain.name}`}>
        {chain.checks.map((item) => (
          <div key={item.id} className={`${styles.checkRow} ${checkClass(item.state)}`}>
            <span className={styles.checkIcon}><CheckIcon state={item.state} /></span>
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {chain.evidence.length > 0 ? (
        <div className={styles.rawEvidence}>
          <span className={styles.subheading}>Identificadores publicos</span>
          {chain.evidence.map((item) => (
            <div key={item.id} className={styles.rawEvidenceRow}>
              <div>
                <span>{item.label}</span>
                <code title={item.value}>{item.displayValue}</code>
              </div>
              {item.href ? (
                <a href={item.href} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.label} en explorer`}>
                  Abrir <ExternalLink aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.noEvidence}>
          <CircleDashed aria-hidden="true" />
          No recibimos identificadores publicos validos. El laboratorio no muestra links inventados.
        </div>
      )}

      {chain.samples.length > 0 ? (
        <details className={styles.samples}>
          <summary>Ver los {chain.samples.length} casos IOTA y sus dos transacciones</summary>
          <div className={styles.sampleList}>
            {chain.samples.map((sample) => (
              <article key={sample.id} className={styles.sampleCard}>
                <div className={styles.sampleHeader}>
                  <div>
                    <span>{sample.id}</span>
                    <strong>{sample.title}</strong>
                  </div>
                  <span className={`${styles.sampleState} ${statusClass(sample.state)}`}>{sample.stateLabel}</span>
                </div>
                <p>{sample.claim}</p>
                <div className={styles.sampleActions}>
                  {sample.anchorExplorerUrl ? <a href={sample.anchorExplorerUrl} target="_blank" rel="noreferrer">Anchor <ExternalLink aria-hidden="true" /></a> : <span>Anchor no disponible</span>}
                  {sample.receiptExplorerUrl ? <a href={sample.receiptExplorerUrl} target="_blank" rel="noreferrer">Recibo <ExternalLink aria-hidden="true" /></a> : <span>Recibo no disponible</span>}
                </div>
              </article>
            ))}
          </div>
        </details>
      ) : null}
    </article>
  );
}

export function ChainLabClient({ model, initialGoal }: ChainLabClientProps) {
  const router = useRouter();
  const [goal, setGoal] = useState<LabGoal>(initialGoal);
  const [step, setStep] = useState(0);
  const [isRefreshing, startRefresh] = useTransition();
  const panelRef = useRef<HTMLElement>(null);
  const selectedGoal = GOALS.find((item) => item.id === goal) || GOALS[2];
  const selectedChains = useMemo(
    () => selectedGoal.chains.map((chainId) => model.chains[chainId]),
    [model.chains, selectedGoal.chains],
  );

  function goToStep(next: number) {
    const safeStep = Math.max(0, Math.min(STEPS.length - 1, next));
    setStep(safeStep);
    window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function chooseGoal(nextGoal: LabGoal) {
    setGoal(nextGoal);
  }

  function refreshEvidence() {
    startRefresh(() => router.refresh());
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/demo-lab" className={styles.backLink} aria-label="Volver al Demo Lab">
            <ArrowLeft aria-hidden="true" />
            <span>Demo Lab</span>
          </Link>
          <div className={styles.brand}>
            <Fingerprint aria-hidden="true" />
            <div>
              <strong>nexID Chain Lab</strong>
              <span>IOTA + Polygon</span>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.environmentBadge}>
            <span>{model.environment}</span>
            consulta de evidencia en redes de prueba
          </div>
          <p className={styles.eyebrow}>Laboratorio guiado para negocio, auditoria e inversores</p>
          <h1>Entende que prueba cada blockchain sin leer un contrato.</h1>
          <p className={styles.heroLead}>
            Elegi el resultado de negocio, revisa que respondieron hoy las redes y abri la evidencia publica. Los estados verdes requieren comprobaciones RPC; si una fuente falla, lo mostramos.
          </p>
        </div>
        <aside className={`${styles.overallCard} ${statusClass(model.status.code)}`} aria-live="polite">
          <div className={styles.overallHeader}>
            <StatusIcon code={model.status.code} />
            <div>
              <span>Estado del laboratorio</span>
              <strong>{model.status.label}</strong>
            </div>
          </div>
          <p>{model.status.explanation}</p>
          <small>Lectura: <time dateTime={model.observedAt}>{utcTimestamp(model.observedAt)}</time></small>
          <button type="button" onClick={refreshEvidence} disabled={isRefreshing}>
            <RefreshCw className={isRefreshing ? styles.spinning : undefined} aria-hidden="true" />
            {isRefreshing ? "Consultando..." : "Reintentar lectura"}
          </button>
        </aside>
      </section>

      <div className={styles.environmentNotice}>
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>Esto no es produccion ni una promesa legal.</strong>
          <p>{model.environmentNotice}</p>
        </div>
      </div>

      {model.sources.warnings.length > 0 ? (
        <details className={styles.sourceWarning} open>
          <summary>Una fuente no respondio como se esperaba</summary>
          <ul>{model.sources.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          <p>La pantalla conserva cualquier evidencia valida recibida, pero baja el estado cuando faltan comprobaciones.</p>
        </details>
      ) : null}

      <section className={styles.journey} aria-label="Recorrido guiado Chain Lab">
        <nav className={styles.stepNav} aria-label="Pasos del laboratorio">
          <ol>
            {STEPS.map((item, index) => (
              <li key={item.label}>
                <button
                  type="button"
                  className={index === step ? styles.activeStep : index < step ? styles.completedStep : undefined}
                  aria-current={index === step ? "step" : undefined}
                  onClick={() => goToStep(index)}
                >
                  <span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.helper}</small>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <section ref={panelRef} tabIndex={-1} className={styles.stepPanel} aria-labelledby={`chain-lab-step-${step}`}>
          <header className={styles.stepHeader}>
            <span>Paso {step + 1} de {STEPS.length}</span>
            <h2 id={`chain-lab-step-${step}`}>{STEPS[step].label}</h2>
          </header>

          {step === 0 ? (
            <div className={styles.goalGrid}>
              {GOALS.map((item) => {
                const selected = item.id === goal;
                const Icon = item.id === "audit" ? SearchCheck : item.id === "ownership" ? WalletCards : Boxes;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={selected ? styles.selectedGoal : undefined}
                    aria-pressed={selected}
                    onClick={() => chooseGoal(item.id)}
                  >
                    <span className={styles.goalIcon}><Icon aria-hidden="true" /></span>
                    <span className={styles.eyebrow}>{item.eyebrow}</span>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    <em>{item.outcome}</em>
                    <span className={styles.goalSelection}>{selected ? <><Check aria-hidden="true" /> Seleccionado</> : "Elegir objetivo"}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <div className={styles.contextIntro}>
                <Link2 aria-hidden="true" />
                <p><strong>{selectedGoal.eyebrow}:</strong> {selectedGoal.outcome}</p>
              </div>
              <div className={styles.roleGrid}>
                {selectedChains.map((chain) => <ChainRoleCard key={chain.id} chain={chain} />)}
              </div>
              {goal === "dual" ? (
                <div className={styles.sequence}>
                  <span><Database aria-hidden="true" /> Evento privado en nexID</span>
                  <ArrowRight aria-hidden="true" />
                  <span><Network aria-hidden="true" /> IOTA cuando se necesita auditoria</span>
                  <ArrowRight aria-hidden="true" />
                  <span><WalletCards aria-hidden="true" /> Polygon cuando nace ownership</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className={styles.evidenceGrid}>
              {selectedChains.map((chain) => <EvidenceCard key={chain.id} chain={chain} />)}
            </div>
          ) : null}

          {step === 3 ? (
            <div className={styles.verifyGrid}>
              {selectedChains.map((chain) => (
                <article key={chain.id} className={styles.verifyCard}>
                  <span className={styles.chainIcon}>{chainIcon(chain.id)}</span>
                  <span className={styles.eyebrow}>{chain.environment} · {chain.network}</span>
                  <h3>{chain.name}: comproba la evidencia vos mismo</h3>
                  <p>{chain.status.explanation}</p>
                  <div className={`${styles.verdict} ${statusClass(chain.status.code)}`}>
                    <StatusIcon code={chain.status.code} />
                    <div>
                      <span>Veredicto actual</span>
                      <strong>{chain.status.label}</strong>
                    </div>
                  </div>
                  <div className={styles.verifyActions}>
                    <Link href={chain.actions.primary.href} className={styles.primaryAction}>
                      {chain.actions.primary.label}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                    {chain.actions.secondary ? (
                      <a href={chain.actions.secondary.href} target="_blank" rel="noreferrer" className={styles.secondaryAction}>
                        {chain.actions.secondary.label}
                        <ExternalLink aria-hidden="true" />
                      </a>
                    ) : (
                      <span className={styles.disabledAction}>Explorer no disponible</span>
                    )}
                  </div>
                </article>
              ))}

              <aside className={styles.productionGate}>
                <ShieldCheck aria-hidden="true" />
                <div>
                  <span className={styles.eyebrow}>Puerta de produccion</span>
                  <h3>Que falta antes de vender esto como mainnet enterprise</h3>
                  <ul>
                    <li>Politica por tenant para decidir que hitos se anclan y cual es el presupuesto.</li>
                    <li>Separacion testnet/mainnet, monitoreo, alertas, runbook y SLA operativo.</li>
                    <li>Custodia y autorizacion productiva auditadas; este laboratorio no las expone.</li>
                    <li>Contrato comercial y legal que defina que representa cada prueba.</li>
                  </ul>
                </div>
              </aside>
            </div>
          ) : null}

          <footer className={styles.stepFooter}>
            <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0} className={styles.backButton}>
              <ArrowLeft aria-hidden="true" /> Anterior
            </button>
            <div className={styles.privacyNote}>
              <LockKeyhole aria-hidden="true" />
              <span>{model.privacy}</span>
            </div>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => goToStep(step + 1)} className={styles.nextButton}>
                Continuar <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <Link href="/demo-lab" className={styles.nextButton}>
                Volver al Demo Lab <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </footer>
        </section>
      </section>

      <footer className={styles.footer}>
        <span><FileCheck2 aria-hidden="true" /> Evidencia publica, limites explicitos y cero secretos expuestos.</span>
        <Link href="/sdk">Ver SDK/API <ArrowRight aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
