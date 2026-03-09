import Link from "next/link";
import { BackLink } from "../../components/back-link";

export default function DocsPresencePage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">Cuando el documento o la presencia importan, un QR no alcanza.</h1>
      <p className="max-w-3xl text-slate-300">nexID permite validar documentos, registrar visitas y auditar servicios desde el objeto físico.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Documentos verificables</h2><p className="mt-2 text-sm text-slate-300">Certificados, diplomas, credenciales y constancias.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Presence logs</h2><p className="mt-2 text-sm text-slate-300">Check-ins en sitio con evidencia de presencia física.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Service records</h2><p className="mt-2 text-sm text-slate-300">Bitácoras de mantenimiento, inspección y cumplimiento.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Para enterprise</h2><p className="mt-2 text-sm text-slate-300">Menos fricción, más auditoría y mejor trazabilidad operativa.</p></div>
      </div>
      <Link href="/?contact=demo#contact-modal" className="inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Quiero un piloto de Docs & Presence</Link>
    </main>
  );
}
