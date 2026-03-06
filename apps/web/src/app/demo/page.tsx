import { Button } from "@product/ui";
import { LiveDemoSurfaces } from "../../components/live-demo-surfaces";
import { VerticalDemoLibrary } from "../../components/vertical-demo-library";
import { getWebI18n } from "../../lib/locale";

export default async function PublicDemoPage() {
  const { locale } = await getWebI18n();
  return (
    <main className="py-10">
      <section className="container-shell space-y-4">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">nexID demo</p>
        <h1 className="text-3xl font-semibold text-white">Winery demo mode</h1>
        <p className="text-slate-300">Bottle simulation, live map/feed, and mobile authenticity states for investor/winery demos.</p>
        <div className="flex flex-wrap gap-3">
          <a href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3002"}/demo-lab`}><Button>Use built-in winery demo</Button></a>
          <a href="/demo/demobodega_seed.json" download><Button variant="secondary">Download demo files</Button></a>
          <a href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || "http://localhost:3002"}/demo-lab`}><Button variant="secondary">Open full Demo Lab</Button></a>
        </div>
      </section>
      <VerticalDemoLibrary locale={locale} />
      <LiveDemoSurfaces />
    </main>
  );
}
