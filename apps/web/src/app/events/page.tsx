import Link from "next/link";
import { BackLink } from "../../components/back-link";

export default function EventsPage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">Un evento no necesita solo acceso. Necesita identidad operativa.</h1>
      <p className="max-w-3xl text-slate-300">Usá Basic para escala y activaciones. Usá Secure para VIP, staff crítico y vouchers sensibles.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Events Basic</h2><p className="mt-2 text-sm text-slate-300">Check-in, wristbands, badges, activaciones y lead capture.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Events Secure</h2><p className="mt-2 text-sm text-slate-300">VIP, backstage, contratistas, vouchers y proof-of-presence.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Para organizadores</h2><p className="mt-2 text-sm text-slate-300">Más control de acceso, mejor trazabilidad y más datos por interacción.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Para sponsors</h2><p className="mt-2 text-sm text-slate-300">Cada toque puede medir interés real, no solo tráfico.</p></div>
      </div>
      <Link href="/demo" className="inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Ver demo de Events</Link>
    </main>
  );
}
