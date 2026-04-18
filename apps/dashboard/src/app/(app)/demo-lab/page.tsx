import { SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";

function safeHost(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

export default function DemoLabPage() {
  const publicDemoLab = `${productUrls.web}/demo-lab`;
  const dashboardBase =
    process.env.NEXT_PUBLIC_DASHBOARD_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_SITE_URL
    || productUrls.web;
  const isSameHostEmbed = safeHost(publicDemoLab) === safeHost(dashboardBase);

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Demo Mission Control" title="Demo Lab" description="Flagship orchestration module: use vertical packs, upload CSV/JSON, simulate taps and stream live scans for buyer/investor demos." />
      <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
        <p>Para evitar bloqueos por extensiones del navegador en modo admin, el Demo Lab público corre en web.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={publicDemoLab} target="_blank" rel="noreferrer" className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">Open public demo lab</a>
          <a href={`${productUrls.web}/login`} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300/35 bg-emerald-500/10 px-3 py-1.5 text-emerald-100">Open login (roles)</a>
        </div>
      </div>
      {isSameHostEmbed ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Embed desactivado para evitar superposición de páginas.</p>
          <p className="mt-1 text-amber-100/85">
            El Demo Lab público y el dashboard comparten host, y cargarlo en iframe duplica shell/chat/overlays.
            Usá “Open public demo lab” para abrirlo limpio en otra pestaña.
          </p>
        </div>
      ) : (
        <iframe title="public-demo-lab" src={publicDemoLab} className="h-[850px] w-full rounded-2xl border border-white/10 bg-slate-950" />
      )}
    </main>
  );
}
