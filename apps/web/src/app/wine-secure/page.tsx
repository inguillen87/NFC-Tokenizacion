import Link from "next/link";
import { BackLink } from "../../components/back-link";

export default function WineSecurePage() {
  return (
    <main className="container-shell space-y-8 py-16">
      <BackLink />
      <h1 className="text-4xl font-black text-white">Cada botella puede probar algo.</h1>
      <p className="max-w-3xl text-slate-300">Autenticidad antes de la compra. Estado de apertura después del descorche. Un solo backend para bodega, canal y consumidor.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Antes de comprar</h2><p className="mt-2 text-sm text-slate-300">Validá autenticidad y origen con un toque.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Después de abrir</h2><p className="mt-2 text-sm text-slate-300">Registrá el cambio de estado y activá una experiencia postventa distinta.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Para la bodega</h2><p className="mt-2 text-sm text-slate-300">Detectá duplicados, desvíos de canal y regiones anómalas.</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5"><h2 className="font-semibold text-white">Para el comprador</h2><p className="mt-2 text-sm text-slate-300">Accedé a ownership, contenido exclusivo y garantía de origen.</p></div>
      </div>
      <Link href="/?contact=demo#contact-modal" className="inline-flex rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100">Quiero un piloto Wine Secure</Link>
    </main>
  );
}
