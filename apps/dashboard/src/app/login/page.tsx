import Link from "next/link";
import { Button, Card } from "@product/ui";
import { getDashboardI18n } from "../../lib/locale";

export default async function LoginPage() {
  const { copy } = await getDashboardI18n();

  return (
    <main className="container-shell grid min-h-screen place-items-center py-10">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-white">{copy.auth.loginTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{copy.auth.loginBody}</p>

        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.email} />
          <input type="password" className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm" placeholder={copy.auth.password} />
          <Link href="/"><Button className="w-full">{copy.auth.loginTitle}</Button></Link>
        </div>

        <div className="mt-4 flex justify-between text-xs">
          <Link href="/register" className="text-cyan-300">{copy.auth.registerTitle}</Link>
          <Link href="/forgot-password" className="text-cyan-300">{copy.auth.forgotTitle}</Link>
        </div>
      </Card>
    </main>
  );
}
