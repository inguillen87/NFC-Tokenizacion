import { Button, Card } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";

export default async function WebRegisterPage() {
  const { locale } = await getWebI18n();
  const content = landingContent[locale];

  return (
    <main className="container-shell grid min-h-screen place-items-center">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white">{content.auth.registerTitle}</h1>
        <p className="mt-2 text-sm text-slate-400">{content.auth.registerBody}</p>
        <div className="mt-6 grid gap-3">
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder={content.auth.company} />
          <input className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2" placeholder={content.auth.email} />
          <Button className="w-full">{content.nav.requestDemo}</Button>
        </div>
      </Card>
    </main>
  );
}
