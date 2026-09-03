import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CreditCard,
  ExternalLink,
  Globe2,
  KeyRound,
  PackageCheck,
  RadioTower,
  Settings,
  ShieldCheck,
  Smartphone,
  Target,
  Users,
} from "lucide-react";
import { Badge, Card, SectionHeading } from "@product/ui";
import { TENANT_DIRECTORY } from "../../../../lib/tenant-directory";
import { productUrls } from "@product/config";
import { requireDashboardSession } from "../../../../lib/session";
import { requireDashboardTenantScope } from "../../../../lib/admin-page-access";
import {
  DASHBOARD_DESTINATIONS,
  dashboardCanOpenDestination,
  type DashboardDestinationKey,
} from "../../../../lib/dashboard-destination-policy";
import { dashboardPermissionMatches } from "../../../../lib/permission-policy";

type TenantKpis = {
  batches: string;
  tags: string;
  scans: string;
  incidents: string;
};

type TenantPlaybook = {
  productLabel: string;
  readiness: string;
  boardSignal: string;
  kpis: TenantKpis;
  nextActions: string[];
};

const statusTone = {
  active: "green",
  risk: "amber",
  pending: "cyan",
} as const;

function tenantPlaybook(vertical: string): TenantPlaybook {
  const key = vertical.toLowerCase();
  if (key.includes("wine")) {
    return {
      productLabel: "Wine Trust Passport",
      readiness: "Configuracion sugerida: etiquetado premium, postventa y defensa anti-replay.",
      boardSignal: "Playbook orientativo: muestra movil, evidencia NFC y salida hash-only.",
      kpis: { batches: "—", tags: "—", scans: "—", incidents: "Sin fuente operativa" },
      nextActions: [
        "Cerrar onboarding de lote proveedor con import y activacion.",
        "Activar ownership, warranty y CTA post-scan para compradores.",
        "Presentar panel ejecutivo de riesgo por region y canal.",
      ],
    };
  }
  if (key.includes("pharma")) {
    return {
      productLabel: "Cold Chain Proof",
      readiness: "Configuracion sugerida: lote serializado, registros de QA y controles de campo.",
      boardSignal: "Playbook orientativo para compliance: eventos minimos, privacidad por diseno y auditoria.",
      kpis: { batches: "—", tags: "—", scans: "—", incidents: "Sin fuente operativa" },
      nextActions: [
        "Vincular QA de lote y temperatura como evento hash-only.",
        "Separar datos privados del paciente de la evidencia publica.",
        "Conectar webhooks ERP y auditoria de recalls.",
      ],
    };
  }
  if (key.includes("events")) {
    return {
      productLabel: "Event Access Shield",
      readiness: "Configuracion sugerida: ticketing, señales anti-replay y control de venue.",
      boardSignal: "Playbook orientativo: validacion de credencial, replay, turnstile y leads del evento.",
      kpis: { batches: "—", tags: "—", scans: "—", incidents: "Sin fuente operativa" },
      nextActions: [
        "Integrar validador con operacion de ingreso.",
        "Monitorear replay/tamper en picos de evento.",
        "Activar dashboard por venue y campanas post-evento.",
      ],
    };
  }
  return {
    productLabel: "Secure Product Passport",
    readiness: "Configuracion sugerida: trazabilidad digital y soporte comercial conectado.",
    boardSignal: "Playbook orientativo para escalar por canal, producto y region.",
    kpis: { batches: "—", tags: "—", scans: "—", incidents: "Sin fuente operativa" },
    nextActions: [
      "Consolidar lotes y politica de reorden.",
      "Activar modulos de warranty, provenance y tokenizacion.",
      "Definir playbook de expansion por canal.",
    ],
  };
}

function metricCards(tenant: (typeof TENANT_DIRECTORY)[number], playbook: TenantPlaybook) {
  return [
    { label: "Producto", value: playbook.productLabel, detail: tenant.vertical, icon: <PackageCheck className="h-4 w-4" /> },
    { label: "Lotes", value: playbook.kpis.batches, detail: "Fuente operativa no conectada", icon: <BadgeCheck className="h-4 w-4" /> },
    { label: "Tags", value: playbook.kpis.tags, detail: "Fuente operativa no conectada", icon: <RadioTower className="h-4 w-4" /> },
    { label: "Lecturas", value: playbook.kpis.scans, detail: playbook.kpis.incidents, icon: <BarChart3 className="h-4 w-4" /> },
  ];
}

function proofLayers(tenantSlug: string) {
  return [
    {
      destination: "events" as const,
      label: "nexID Core",
      body: "Identidad de producto, reglas de canal, CRM y permisos del tenant.",
      href: `/events?tenant=${tenantSlug}`,
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: "cyan",
    },
    {
      destination: "proof" as const,
      label: "IOTA proof",
      body: "Integridad hash-only para registros declarados de custodia o QA.",
      href: `/proof/anchor?tenant=${tenantSlug}`,
      icon: <RadioTower className="h-4 w-4" />,
      tone: "green",
    },
    {
      destination: "tokenization" as const,
      label: "Polygon titularidad digital",
      body: "Capa opcional para reclamo, garantia o certificado digital segun policy; no prueba propiedad fisica.",
      href: `/tokenization?tenant=${tenantSlug}`,
      icon: <Globe2 className="h-4 w-4" />,
      tone: "violet",
    },
    {
      destination: "apiKeys" as const,
      label: "SDK / API",
      body: "Keys, webhooks y salida publica conectada a apps externas.",
      href: `/api-keys?tenant=${tenantSlug}`,
      icon: <KeyRound className="h-4 w-4" />,
      tone: "amber",
    },
  ];
}

function toneClass(tone: string) {
  if (tone === "green") return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  if (tone === "amber") return "border-amber-300/25 bg-amber-500/10 text-amber-100";
  if (tone === "violet") return "border-violet-300/25 bg-violet-500/10 text-violet-100";
  return "border-cyan-300/25 bg-cyan-500/10 text-cyan-100";
}

export default async function TenantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireDashboardSession();
  const scope = requireDashboardTenantScope(session, slug);
  if (!scope.canSelectTenant && scope.tenantSlug !== slug.trim().toLowerCase()) notFound();
  const destinationAccess = {
    role: session.role,
    permissions: session.permissions,
    deniedPermissions: session.deniedPermissions,
    isDemo: session.isDemo,
  };
  const canOpenDestination = (destination: DashboardDestinationKey) => (
    dashboardCanOpenDestination(destination, destinationAccess)
  );
  const canOpenScopedLink = (link: { destination?: DashboardDestinationKey; requiredPermission?: string }) => (
    (!link.destination || canOpenDestination(link.destination))
    && (!link.requiredPermission || dashboardPermissionMatches(
      session.permissions,
      link.requiredPermission,
      session.deniedPermissions,
    ))
  );
  const backHref = canOpenDestination("tenants") ? DASHBOARD_DESTINATIONS.tenants.href : DASHBOARD_DESTINATIONS.settings.href;
  const backLabel = canOpenDestination("tenants") ? "Volver a tenants" : "Volver a configuración";
  const tenant = TENANT_DIRECTORY.find((item) => item.slug === slug);

  if (!tenant) {
    return (
      <main className="space-y-6">
        <SectionHeading eyebrow="Tenants" title={slug} description="Cuenta no encontrada en el directorio demo." />
        <Card className="p-6 text-sm text-rose-200">
          <p>Tenant no encontrado. Volve a la lista y elegi una cuenta disponible.</p>
          <Link href={backHref} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 font-bold text-rose-100">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Card>
      </main>
    );
  }

  const tenantParam = encodeURIComponent(tenant.slug);
  const publicMobile = `${productUrls.web}/demo-lab/mobile/${tenant.slug}/demo-item-001?pack=wine-secure&demoMode=consumer_tap`;
  const playbook = tenantPlaybook(tenant.vertical);
  const metrics = metricCards(tenant, playbook);
  const layerCandidates = proofLayers(tenantParam);
  const layers = layerCandidates.filter(canOpenScopedLink);

  const accountActionCandidates = [
    { destination: "settings" as const, href: DASHBOARD_DESTINATIONS.settings.href, label: "Configuracion", icon: <Settings className="h-4 w-4" />, tone: "cyan" },
    { destination: "users" as const, href: DASHBOARD_DESTINATIONS.users.href, label: "Usuarios", icon: <Users className="h-4 w-4" />, tone: "green" },
    { destination: "apiKeys" as const, href: `/api-keys?tenant=${tenantParam}`, label: "API", icon: <KeyRound className="h-4 w-4" />, tone: "violet" },
    { destination: "subscriptions" as const, href: `/subscriptions?tenant=${tenantParam}`, label: "Plan", icon: <CreditCard className="h-4 w-4" />, tone: "amber" },
  ];
  const accountActions = accountActionCandidates.filter(canOpenScopedLink);

  const operationalLinkCandidates = [
    { requiredPermission: "supplier_orders:read", href: `/admin/tenant-vault/${tenantParam}`, label: "Tenant Vault", body: "Órdenes, manifests, QA y evidencia segura." },
    { destination: "batches" as const, href: `/batches?tenant=${tenantParam}`, label: "Lotes", body: "Emision, import y activacion." },
    { destination: "tags" as const, href: `/tags?tenant=${tenantParam}`, label: "Tags", body: "NFC/QR, inventario y estado." },
    { destination: "events" as const, href: `/events?tenant=${tenantParam}`, label: "Eventos", body: "Lecturas, riesgo y auditoria." },
    { destination: "analytics" as const, href: `/analytics?tenant=${tenantParam}`, label: "Health operativo", body: "KPI, riesgo y tendencias." },
    { destination: "leadsTickets" as const, href: `/leads-tickets?tenant=${tenantParam}`, label: "Leads y tickets", body: "CRM, soporte y oportunidades." },
    { destination: "demoLab" as const, href: `/demo-lab?tenant=${tenantParam}`, label: "Demo Lab", body: "Experiencia publica y comercial." },
  ];
  const operationalLinks = operationalLinkCandidates.filter(canOpenScopedLink);
  const canOpenBatches = canOpenDestination("batches");
  const restrictedLinkCount = accountActionCandidates.length - accountActions.length
    + layerCandidates.length - layers.length
    + operationalLinkCandidates.length - operationalLinks.length;

  return (
    <main className="space-y-8" data-testid="tenant-detail-enterprise-profile" data-tenant-source={tenant.source}>
      <SectionHeading
        eyebrow={`Tenant account cockpit · ${tenant.source.toUpperCase()}`}
        title={tenant.tenant}
        description="Fixture navegable para evaluar la UX de una cuenta. No representa un cliente, contrato, plan activo ni health productivo."
      />

      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_85%_0%,rgba(34,211,238,.18),transparent_38%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,8,23,.96))] shadow-[0_28px_90px_rgba(2,6,23,.38)]">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_.9fr]">
          <div className="p-5 md:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Escenario de cuenta · no productivo</p>
                <h2 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">{tenant.tenant}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">{playbook.boardSignal}</p>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-amber-100">Vista orientativa del directorio: no consulta métricas operativas. Abrí Lotes, Tags, Eventos o Analytics para cifras confirmadas.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">{tenant.source}</Badge>
                <Badge tone={statusTone[tenant.status]}>{tenant.status}</Badge>
                <Badge tone="cyan">{tenant.plan}</Badge>
                <Badge tone="violet">{tenant.region}</Badge>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
                    <span className="text-cyan-200">{metric.icon}</span>
                  </div>
                  <p className="mt-2 text-base font-black text-white">{metric.value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{metric.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2" data-testid="tenant-detail-admin-actions">
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Administracion de cuenta</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Navegación de demostración sobre el fixture, sin implicar una cuenta contratada.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  {accountActions.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 font-bold transition hover:border-cyan-200/60 ${toneClass(item.tone)}`}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </div>
                {restrictedLinkCount > 0 ? (
                  <p data-testid="tenant-detail-restricted-destinations" className="mt-3 text-xs leading-5 text-amber-100">
                    Se omitieron {restrictedLinkCount} accesos que esta sesión no tiene habilitados; no se ofrecen rutas que luego fallen por permisos.
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Navegacion</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Volve a la cartera o abrile al cliente una prueba publica mobile.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Link href={backHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 font-bold text-slate-100 transition hover:border-cyan-300/40">
                    <ArrowLeft className="h-4 w-4" />
                    {backLabel}
                  </Link>
                  <a href={publicMobile} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 font-bold text-emerald-100 transition hover:border-emerald-200/60" target="_blank" rel="noreferrer">
                    <Smartphone className="h-4 w-4" />
                    Preview mobile
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <aside className="border-t border-white/10 bg-slate-950/38 p-5 md:p-7 xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Playbook ejecutivo</p>
            <h3 className="mt-3 text-2xl font-black text-white">{playbook.productLabel}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{playbook.readiness}</p>

            <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">Siguiente paso recomendado</p>
              <p className="mt-2 text-sm font-bold text-white">{canOpenBatches ? playbook.nextActions[0] : "Revisar el alcance efectivo antes de continuar con la operación."}</p>
              <Link href={canOpenBatches ? `/batches?tenant=${tenantParam}` : DASHBOARD_DESTINATIONS.settings.href} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm font-black text-emerald-100 transition hover:border-emerald-200/60">
                {canOpenBatches ? "Abrir lotes" : "Revisar configuración"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <ol className="mt-5 grid gap-2 text-sm text-slate-300">
              {playbook.nextActions.map((item, index) => (
                <li key={item} className="flex gap-3 rounded-xl border border-white/10 bg-slate-950/55 p-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-300/10 text-xs font-black text-cyan-100">{index + 1}</span>
                  <span className="leading-5">{item}</span>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Resumen de cuenta</p>
              <h3 className="mt-1 text-xl font-black text-white">Datos que entiende ventas, operaciones y soporte</h3>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><dt className="text-slate-400">Slug</dt><dd className="mt-1 break-all font-bold text-white">{tenant.slug}</dd></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><dt className="text-slate-400">Vertical</dt><dd className="mt-1 font-bold text-white">{tenant.vertical}</dd></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><dt className="text-slate-400">Health del fixture</dt><dd className="mt-1 font-bold text-white">{tenant.health}</dd></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><dt className="text-slate-400">Region / plan ilustrativos</dt><dd className="mt-1 font-bold text-white">{tenant.region} / {tenant.plan}</dd></div>
          </dl>
        </Card>

        <Card className="p-5" data-testid="tenant-proof-layer-grid">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-violet-300/25 bg-violet-500/10 text-violet-100">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200">Capas de confianza</p>
              <h3 className="mt-1 text-xl font-black text-white">Que evidencia registra nexID, IOTA, Polygon y API</h3>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {layers.map((layer) => (
              <Link key={layer.label} href={layer.href} className={`group rounded-2xl border p-4 transition hover:-translate-y-0.5 ${toneClass(layer.tone)}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-slate-950/45">{layer.icon}</span>
                  <ArrowRight className="h-4 w-4 opacity-70 transition group-hover:translate-x-0.5" />
                </div>
                <p className="mt-3 font-black text-white">{layer.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">{layer.body}</p>
              </Link>
            ))}
            {!layers.length ? (
              <p className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100 sm:col-span-2">
                Esta sesión no tiene habilitadas capas de evidencia adicionales. Revisá los permisos efectivos desde Configuración.
              </p>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="tenant-operational-links">
        {operationalLinks.map((item) => (
          <Link key={item.label} href={item.href} className="group rounded-2xl border border-white/10 bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/35 hover:bg-cyan-500/10">
            <div className="flex items-center justify-between gap-3">
              <p className="font-black text-white">{item.label}</p>
              <ArrowRight className="h-4 w-4 text-cyan-200 opacity-70 transition group-hover:translate-x-0.5" />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{item.body}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
