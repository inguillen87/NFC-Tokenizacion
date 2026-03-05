import { Button, Card } from "@product/ui";
import { getWebI18n } from "../../lib/locale";

export default async function WebLoginPage() {
  const { t } = await getWebI18n();
  return <main className="container-shell grid min-h-screen place-items-center"><Card className="w-full max-w-md p-8"><h1 className="text-2xl font-bold text-white">{t.common.login}</h1><p className="mt-2 text-sm text-slate-400">{t.web.heroBody}</p><div className="mt-6 grid gap-3"><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder="email"/><input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder="password" type="password"/><a href="https://dashboard.tudominio.com/login"><Button className="w-full">{t.common.dashboard}</Button></a></div></Card></main>;
}
