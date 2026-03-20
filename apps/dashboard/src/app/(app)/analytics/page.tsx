import { SectionHeading } from "@product/ui";
import { AnalyticsPanels } from "../../../components/analytics-panels";
import { ModuleAudienceHero } from "../../../components/module-audience-hero";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function getAnalytics() {
  try {
    const response = await fetch(`${API_BASE}/admin/analytics`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default async function AnalyticsPage() {
  const { locale, t } = await getDashboardI18n();
  const copy = dashboardContent[locale];
  const analyticsData = await getAnalytics();

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.analytics} title={copy.pages.analytics.title} description={copy.pages.analytics.description} />
      <ModuleAudienceHero
        ceo={{ eyebrow: "CEO / Investor read", summary: "Analytics prueba adopción, fraude evitado y expansión del negocio con evidencia real.", decision: "Decidís dónde acelerar inversión comercial, qué vertical está traccionando y cómo evoluciona el riesgo.", cta: "Usalo para mostrar crecimiento, legitimidad operativa y retorno de una demo exitosa." }}
        operator={{ eyebrow: "Operator / Engineer read", summary: "Analytics es el tablero de observabilidad para ver scans, duplicados, tamper y comportamiento por región.", decision: "Decidís dónde ajustar reglas, revisar anomalías y priorizar respuesta operativa.", cta: "Leelo junto a Events y API Keys para conectar operación + integraciones." }}
        buyer={{ eyebrow: "Buyer / Client read", summary: "Analytics demuestra que la solución no es humo: se usa, detecta riesgo y genera interacción real.", decision: "Decidís si esto mejora confianza de marca, postventa y trazabilidad para tus clientes.", cta: "Mostralo después de Demo Lab para cerrar con prueba cuantitativa." }}
      />
      <div>
        <AnalyticsPanels kpis={t.dashboard.kpis} extra={copy.analytics} data={analyticsData || undefined} />
      </div>
    </main>
  );
}
