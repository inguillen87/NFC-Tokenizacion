import Link from "next/link";
import { Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function RegisterPage() {
  const { copy } = await getDashboardI18n();

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-lg p-8">
        <h1 className="text-3xl font-bold text-white">{copy.auth.registerTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{copy.auth.registerBody}</p>
        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.company} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.email} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.tenantSlug} />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.password} />
          <Button className="w-full">{copy.auth.registerTitle}</Button>
        </div>
        <p className="mt-4 text-xs text-slate-400"><Link href="/login" className="text-cyan-300">{copy.auth.loginTitle}</Link></p>
      </Card>
    </main>
  );
}
