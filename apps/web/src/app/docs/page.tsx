import Link from "next/link";
import { Card } from "@product/ui";

export default function DocsPage() {
  return (
    <main className="container-shell py-16">
      <Link href="/" className="text-sm text-cyan-300">← Volver</Link>
      <h1 className="mt-6 text-4xl font-black text-white">Docs overview</h1>
      <p className="mt-4 max-w-3xl text-slate-400">Esto es una pagina placeholder. En v2 puede moverse a una app docs separada o a MDX. Para arrancar, alcanza con overview + endpoints clave.</p>
      <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-6"><div className="text-white font-semibold">/sun</div><p className="mt-2 text-sm text-slate-400">Valida taps SDM/SUN y devuelve resultado.</p></Card>
        <Card className="p-6"><div className="text-white font-semibold">/admin/tenants</div><p className="mt-2 text-sm text-slate-400">Alta de tenants.</p></Card>
        <Card className="p-6"><div className="text-white font-semibold">/admin/batches</div><p className="mt-2 text-sm text-slate-400">Crea lote y keys batch.</p></Card>
      </div>
    </main>
  );
}
