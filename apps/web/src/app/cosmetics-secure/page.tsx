import Link from "next/link";
import { BackLink } from "../../components/back-link";

export default function CosmeticsSecurePage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">Protegé el producto. Activá la postventa.</h1>
      <p className="max-w-3xl text-slate-300">Autenticidad, estado de apertura y canal directo con el comprador para cosmética y perfumería premium.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Autenticidad</h2><p className="mt-2 text-sm text-slate-300">Validación antes de uso o compra.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Estado</h2><p className="mt-2 text-sm text-slate-300">Contenido distinto antes y después de abrir.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Marca</h2><p className="mt-2 text-sm text-slate-300">Más control del canal y más datos postventa.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Comprador</h2><p className="mt-2 text-sm text-slate-300">Confianza, registro y beneficios exclusivos.</p></div>
      </div>
      <Link href="/?contact=demo#contact-modal" className="inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Ver caso Cosmetics Secure</Link>
    </main>
  );
}
