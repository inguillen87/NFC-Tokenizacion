"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Boxes, Database, QrCode, Send, ShieldCheck, ShoppingBag, Sprout } from "lucide-react";
import styles from "./ops-command-center.module.css";
import { DASHBOARD_DESTINATIONS } from "../lib/dashboard-destination-policy";
import type { OpsDestinationAccess, OpsDestinationKey } from "../lib/ops-destination-access";

export type OpsCommandMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "good" | "warn" | "risk" | "neutral";
};

export type OpsCommandStep = {
  label: string;
  body: string;
  status: "ready" | "working" | "blocked";
  owner: "Super Admin" | "Owner" | "Operaciones" | "Growth" | "Seguridad";
};

export type OpsCommandTenantRow = {
  name: string;
  slug: string;
  scans: number;
  riskScore: number;
  batches: number;
  tags: number;
  status: "active" | "healthy" | "pending" | "risk";
};

export type OpsCommandCenterProps = {
  title?: string;
  subtitle?: string;
  metrics: OpsCommandMetric[];
  // Retained for callers; heterogeneous counts and inferred steps are not progress.
  steps: OpsCommandStep[];
  tenants?: OpsCommandTenantRow[];
  funnel: Array<{ stage: string; value: number }>;
  readiness: Array<{ label: string; ready: number; pending: number }>;
  mode?: "global" | "tenant" | "auditor";
  allowedDestinations: OpsDestinationAccess;
};

const roles = {
  global: { label: "Super Admin" },
  tenant: { label: "Admin tenant" },
  auditor: { label: "Equipo operativo" },
} as const;

function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "good" | "warn" | "risk" | "neutral" }) {
  return <span className={styles.statusChip} data-tone={tone}>{label}</span>;
}

function formatNumber(value: number) {
  return Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)
    : "No informado";
}

function tenantSlugLabel(slug: string) {
  return slug.toLowerCase() === "demobodega" ? "bodega-balmec" : slug;
}

function riskTone(value: number): "good" | "warn" | "risk" | "neutral" {
  if (value >= 65) return "risk";
  if (value >= 30) return "warn";
  if (value > 0) return "good";
  return "neutral";
}

export function OpsCommandCenter({
  title = "Operación NFC",
  subtitle = "Consultá la actividad informada y abrí los módulos habilitados para tu cuenta.",
  metrics,
  tenants = [],
  readiness,
  mode = "global",
  allowedDestinations,
}: OpsCommandCenterProps) {
  const canOpen = (destination: OpsDestinationKey) => allowedDestinations?.[destination] === true;
  const role = roles[mode];
  const operationalActions = [
    {
      icon: ShieldCheck,
      title: "Eventos NFC",
      body: "Revisá lecturas y alertas. Los eventos aportan evidencia digital; no certifican el producto físico.",
      destination: "events" as const,
      href: DASHBOARD_DESTINATIONS.events.href,
      cta: "Auditar eventos",
    },
    {
      icon: ShoppingBag,
      title: "Beneficios",
      body: "Consultá el catálogo y los canjes. Este acceso no activa ventas ni envía promociones.",
      destination: "rewards" as const,
      href: DASHBOARD_DESTINATIONS.rewards.href,
      cta: "Ver beneficios",
    },
    {
      icon: Send,
      title: "Campañas",
      body: "Revisá campañas disponibles. Los envíos requieren configuración, permisos y consentimiento.",
      destination: "campaigns" as const,
      href: DASHBOARD_DESTINATIONS.campaigns.href,
      cta: "Ver campañas",
    },
    {
      icon: Boxes,
      title: "Lotes",
      body: "Consultá los lotes registrados dentro del alcance de tu cuenta.",
      destination: "batches" as const,
      href: DASHBOARD_DESTINATIONS.batches.href,
      cta: "Consultar lotes",
    },
    {
      icon: Boxes,
      title: "Lotes de proveedor",
      body: "Consultá proveedor, SKU y manifest. La carga o edición requiere permisos propios.",
      destination: "supplierBatches" as const,
      href: DASHBOARD_DESTINATIONS.supplierBatches.href,
      cta: "Ver lotes",
    },
    {
      icon: QrCode,
      title: "Registro de tags",
      body: "Consultá UIDs, estado reportado y ficha asociada.",
      destination: "tags" as const,
      href: DASHBOARD_DESTINATIONS.tags.href,
      cta: "Ver tags",
    },
    {
      icon: BadgeCheck,
      title: "Anclaje opcional",
      body: "Consultá solicitudes de tokenización. Abrir este módulo no emite tokens ni publica un pasaporte.",
      destination: "tokenization" as const,
      href: DASHBOARD_DESTINATIONS.tokenization.href,
      cta: "Revisar anclaje",
    },
  ];
  const technicalResources = [
    {
      icon: Sprout,
      title: "Documentación NFC / QR",
      body: "Referencias técnicas para productos, lotes y soportes físicos. No acredita una integración activa.",
      destination: "sdkVision" as const,
      href: `${DASHBOARD_DESTINATIONS.sdkVision.href}?vertical=agro`,
      cta: "Consultar documentación",
    },
    {
      icon: Database,
      title: "API e integraciones",
      body: "La conexión con sistemas externos requiere configuración y validación independientes.",
      destination: "apiKeys" as const,
      href: DASHBOARD_DESTINATIONS.apiKeys.href,
      cta: "Consultar integración",
    },
  ];
  const permittedActions = operationalActions.filter((item) => canOpen(item.destination));
  const permittedResources = technicalResources.filter((item) => canOpen(item.destination));
  const unavailableDestinations = [...operationalActions, ...technicalResources].filter((item) => !canOpen(item.destination));
  const tenantActions = [
    { destination: "batches" as const, label: "Lotes" },
    { destination: "tags" as const, label: "Tags" },
    { destination: "events" as const, label: "Eventos" },
  ].filter((item) => canOpen(item.destination));

  const renderDestination = (item: (typeof operationalActions)[number] | (typeof technicalResources)[number]) => {
    const Icon = item.icon;
    return (
      <Link key={item.destination} href={item.href} className={styles.actionCard}>
        <span className={styles.actionHeading}><Icon className={styles.icon} aria-hidden="true" /><span>{item.title}</span></span>
        <span className={styles.actionBody}>{item.body}</span>
        <span className={styles.actionCta}>{item.cta}<ArrowUpRight className={styles.smallIcon} aria-hidden="true" /></span>
      </Link>
    );
  };

  return (
    <section data-testid="ops-command-center" className={styles.workspace}>
      <header className={styles.header}>
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <span data-testid="operations-session-role" className={styles.roleBadge}>{role.label} · Alcance de la sesión</span>
      </header>

      {metrics.length ? (
        <div className={styles.metrics} aria-label="Indicadores informados">
          {metrics.map((metric) => (
            <article key={metric.label} className={styles.metric} data-tone={metric.tone || "neutral"}>
              <h3>{metric.label}</h3>
              <p className={styles.metricValue}>{metric.value.trim() ? metric.value : "No informado"}</p>
              <p className={styles.metricDetail}>{metric.detail}</p>
            </article>
          ))}
        </div>
      ) : <p className={styles.emptyState}>No hay indicadores informados para esta vista.</p>}

      <section className={styles.section} data-testid="ops-permitted-actions">
        <div className={styles.sectionHeading}>
          <h3>Acciones disponibles</h3>
          <p>Las funciones dependen de los permisos y la configuración del módulo.</p>
        </div>
        {permittedActions.length ? <div className={styles.actionGrid}>{permittedActions.map(renderDestination)}</div>
          : <p className={styles.emptyState}>No hay módulos operativos habilitados para esta cuenta.</p>}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h3>Actividad informada por empresa</h3>
          <p>Registros de la fuente consultada, dentro del alcance de tu sesión.</p>
        </div>
        <div className={styles.tableScroll} role="region" aria-label="Actividad informada por empresa; tabla desplazable" tabIndex={0}>
          <table className={styles.table}>
            <caption>Conteos y estados reportados. El riesgo se muestra sólo cuando hay lecturas y un valor informado.</caption>
            <thead>
              <tr>
                <th scope="col">Empresa</th><th scope="col">Lecturas</th><th scope="col">Lotes</th><th scope="col">Tags</th>
                <th scope="col">Riesgo informado</th><th scope="col">Estado reportado</th><th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length ? tenants.map((tenant) => {
                const hasRiskBase = Number.isFinite(tenant.scans) && tenant.scans > 0 && Number.isFinite(tenant.riskScore) && tenant.riskScore >= 0 && tenant.riskScore <= 100;
                return (
                  <tr key={`${tenant.slug}-${tenant.name}`}>
                    <th scope="row"><span>{tenant.name}</span><span className={styles.tenantSlug}>{tenantSlugLabel(tenant.slug)}</span></th>
                    <td>{formatNumber(tenant.scans)}</td><td>{formatNumber(tenant.batches)}</td><td>{formatNumber(tenant.tags)}</td>
                    <td><StatusChip label={hasRiskBase ? `${tenant.riskScore}/100` : "Sin base"} tone={hasRiskBase ? riskTone(tenant.riskScore) : "neutral"} /></td>
                    <td><StatusChip label={tenant.status} tone={tenant.status === "risk" ? "risk" : tenant.status === "pending" ? "warn" : "neutral"} /></td>
                    <td>
                      <div className={styles.rowActions}>
                        {mode === "global" ? (canOpen("overview") ? (
                          <Link href={`/?tenant=${encodeURIComponent(tenant.slug)}`} className={styles.tableLink}>Abrir empresa</Link>
                        ) : <span className={styles.muted}>Vista no habilitada para tu cuenta.</span>) : (
                          tenantActions.length ? tenantActions.map((item) => (
                            <Link key={item.destination} href={DASHBOARD_DESTINATIONS[item.destination].href} className={styles.tableLink}>{item.label}</Link>
                          )) : <span className={styles.muted}>Sin acciones habilitadas.</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }) : <tr><td colSpan={7} className={styles.emptyCell}>La fuente consultada no contiene empresas para el alcance actual.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.secondary}>
        {unavailableDestinations.length ? (
          <details className={styles.disclosure} data-testid="ops-restricted-destinations">
            <summary>Módulos no habilitados <span className={styles.count}>{unavailableDestinations.length}</span></summary>
            <div className={styles.disclosureContent}>
              <p>Estos módulos no están habilitados para tu cuenta. Si los necesitás, solicitá su habilitación al administrador de tu empresa. Consultar datos no habilita acciones sobre ellos.</p>
              <div className={styles.restrictedGrid}>
                {unavailableDestinations.map((item) => (
                  <article key={item.destination} data-unavailable-destination={item.destination} className={styles.restrictedCard}>
                    <h4>{item.title}</h4><p>No habilitado para tu cuenta.</p>
                  </article>
                ))}
              </div>
            </div>
          </details>
        ) : null}
        {permittedResources.length ? (
          <details className={styles.disclosure} data-testid="ops-technical-resources">
            <summary>Recursos técnicos e integraciones</summary>
            <div className={styles.disclosureContent}><div className={styles.actionGrid}>{permittedResources.map(renderDestination)}</div></div>
          </details>
        ) : null}
        {readiness.length ? (
          <details className={styles.disclosure} data-testid="ops-readiness-details">
            <summary>Disponibilidad informada por etapa</summary>
            <div className={styles.disclosureContent}>
              <p>Cada etapa tiene su propia base: listos más pendientes. Estos registros no constituyen una aprobación de QA o producción.</p>
              <div className={styles.readinessGrid}>
                {readiness.map((item, index) => {
                  const validCounts = Number.isFinite(item.ready) && Number.isFinite(item.pending) && item.ready >= 0 && item.pending >= 0;
                  const total = item.ready + item.pending;
                  const hasBase = validCounts && Number.isFinite(total) && total > 0;
                  return (
                    <article key={`${item.label}-${index}`} className={styles.readinessItem}>
                      <h4>{item.label}</h4>
                      {validCounts ? <p>Listos: {formatNumber(item.ready)} · Pendientes: {formatNumber(item.pending)} · Base: {formatNumber(total)}</p> : null}
                      {hasBase ? <progress className={styles.progress} value={item.ready} max={total} aria-label={`${item.label}: ${formatNumber(item.ready)} listos de ${formatNumber(total)} registros`} />
                        : <p>Sin base para calcular.</p>}
                    </article>
                  );
                })}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
