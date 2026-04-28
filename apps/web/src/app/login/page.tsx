import { BackLink } from "../../components/back-link";
import { BrandMark, Button, Card } from "@product/ui";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";
import Link from "next/link";
import { ConsumerLoginPanel } from "./consumer-login-panel";

export default async function WebLoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, t } = await getWebI18n();
  const params = (await searchParams) || {};
  const consumerMode = String(params.consumer || "") === "1";
  const nextPath = typeof params.next === "string" ? params.next : "/me";
  const content = landingContent[locale];

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(6,182,212,.2),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(99,102,241,.16),transparent_34%)]" />
      <div className="container-shell relative z-10 grid min-h-screen items-center py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <section className="order-2 mt-6 lg:order-1 lg:mt-0">
          <div className="w-full py-4"><BackLink /></div>
          <Card className="w-full max-w-xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
              <BrandMark size={32} variant="ripple" theme="dark" />
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Access center</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">MFA-ready</span>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">Tenant + reseller</span>
              <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100">Secure login</span>
            </div>
            <h1 className="mt-5 text-3xl font-bold text-white">{t.web.auth.loginTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{content.hero.body}</p>
            <div className="mt-6 grid gap-3">
              <input className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={t.web.auth.emailPlaceholder} />
              <input type="password" className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={t.web.auth.passwordPlaceholder} />
              <a href="https://app.nexid.lat/login"><Button className="w-full">{content.nav.cta}</Button></a>
            </div>

            {consumerMode ? <ConsumerLoginPanel nextPath={nextPath} /> : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link href="/register" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200">Crear cuenta</Link>
              <Link href="/docs" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200">Ver docs</Link>
              <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">Solicitar demo</Link>
            </div>
          </Card>
        </section>

        <section className="order-1 rounded-3xl border border-white/10 bg-slate-900/55 p-5 shadow-[0_24px_80px_rgba(2,6,23,.45)] lg:order-2 lg:p-7">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">Portal premium + marketplace</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Una sola plataforma para autenticación, trazabilidad y fidelización.</h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-200">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Tap de producto premium → pasaporte del consumidor + estado de autenticidad + ownership.</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Marketplace por tenant con catálogo editable para publicar nuevas experiencias y productos.</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Panel enterprise para eventos, pharma, agro y cosmética con monitoreo geográfico y anti-fraude.</div>
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/25 bg-cyan-500/10 p-4 text-xs text-cyan-100">
            Security stack: QR + NTAG215 + NTAG424 DNA TT, con modo blockchain-ready cuando hay ROI de negocio.
          </div>
        </section>
      </div>
    </main>
  );
}
