import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../components/data-table";
import { dashboardContent } from "../../../lib/dashboard-content";
import { getDashboardI18n } from "../../../lib/locale";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

async function adminGet(path: string) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });

    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export default async function ExperiencesPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow={copy.nav.experiences} title={copy.pages.experiences.title} description={copy.pages.experiences.description} />
      <section className="rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,.05),transparent_40%),#020617] p-5 shadow-[0_24px_70px_rgba(2,6,23,.7)] md:p-6">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Eventos y Reservas</p>
        <p className="mt-2 text-sm text-slate-100">Administra tours, catas y activaciones in-situ desbloqueables mediante escaneo de productos auténticos.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-slate-300/30">
            <p className="text-2xl font-semibold text-white">0</p>
            <p className="mt-1 text-xs text-slate-400">Experiencias creadas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-slate-300/30">
            <p className="text-2xl font-semibold text-white">0</p>
            <p className="mt-1 text-xs text-slate-400">Reservas confirmadas</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 transition-colors duration-300 hover:border-slate-300/30">
            <p className="text-2xl font-semibold text-white">0</p>
            <p className="mt-1 text-xs text-slate-400">Check-ins verificados</p>
          </div>
        </div>
      </section>

      <DataTable
        title="Agenda de Experiencias"
        columns={[{ key: "title", label: "Título" }, { key: "date", label: "Fecha" }, { key: "capacity", label: "Capacidad" }, { key: "status", label: "Estado" }]}
        rows={[]}
        filterKey="status"
        loadingLabel={copy.shell.loading}
        emptyLabel="No hay experiencias programadas todavía."
        searchPlaceholder={copy.shell.search}
        allFilterLabel={copy.shell.all}
      />
    </main>
  );
}
