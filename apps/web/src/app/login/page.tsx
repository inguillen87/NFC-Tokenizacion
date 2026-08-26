import Link from "next/link";
import { BackLink } from "../../components/back-link";
import { Button, Card } from "@product/ui";
import { BrandHomeLink } from "../../components/brand-home-link";
import { landingContent } from "../../lib/landing-content";
import { getWebI18n } from "../../lib/locale";
import { ConsumerLoginPanel } from "./consumer-login-panel";

export default async function WebLoginPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale, t } = await getWebI18n();
  const params = (await searchParams) || {};
  const nextPath = typeof params.next === "string" ? params.next : "/me";
  const hasMagicToken = typeof params.t === "string" || typeof params.token === "string";
  const isTapReturn = nextPath.includes("fromTap=1") || nextPath.includes("eventId=");
  const isConsumerAccess = isTapReturn || hasMagicToken || params.consumer === "1";
  const content = landingContent[locale];

  return (
    <main className="auth-surface relative min-h-screen overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(6,182,212,.2),transparent_30%),radial-gradient(circle_at_88%_82%,rgba(99,102,241,.16),transparent_34%)]" />
      <div className="relative z-10 w-full max-w-[430px] mx-auto min-h-screen flex flex-col justify-center py-8 px-3 gap-4">
        <section className="w-full">
          <div className="w-full py-2"><BackLink /></div>
          <Card className="auth-card w-full border border-white/10 bg-slate-900/70 p-6">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
              <BrandHomeLink locale={locale} markOnly size={32} />
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">{isConsumerAccess ? "Pasaporte nexID" : "Panel empresa"}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">OTP por canal</span>
              <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100">{isConsumerAccess ? "Usuario verificado" : "Tenant + reseller"}</span>
              <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-100">Login seguro</span>
            </div>
            <h1 className="brand-editorial-gradient mt-5 text-3xl font-bold text-white">{isConsumerAccess ? "Entrar a mi Pasaporte nexID" : t.web.auth.loginTitle}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {isConsumerAccess
                ? "Validá el link o código recibido por WhatsApp/email. Desde ahí accedés a tus beneficios, productos guardados y marketplace."
                : content.hero.body}
            </p>
            {!isConsumerAccess ? (
              <div className="mt-6 grid gap-3">
                <input suppressHydrationWarning className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={t.web.auth.emailPlaceholder} />
                <input suppressHydrationWarning type="password" className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/40 focus:outline-none" placeholder={t.web.auth.passwordPlaceholder} />
                <a href="https://app.nexid.lat/login"><Button className="w-full">Entrar al panel empresa</Button></a>
              </div>
            ) : null}

            <ConsumerLoginPanel nextPath={nextPath} />
            {!isConsumerAccess ? <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <Link href="/register" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200">Crear cuenta</Link>
              <Link href="/docs" className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200">Ver docs</Link>
              <Link href="/?contact=demo#contact-modal" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-100">Solicitar demo</Link>
            </div> : null}
          </Card>
        </section>

        <section className="auth-info-panel rounded-2xl border border-white/10 bg-slate-900/55 p-5 shadow-[0_24px_80px_rgba(2,6,23,.45)]">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-200">{isTapReturn ? "Continuar desde el tap" : "Portal premium + marketplace"}</p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {isConsumerAccess ? "Primero identidad. Después beneficios, productos y marketplace." : "Una sola plataforma para autenticación, trazabilidad y fidelización."}
          </h2>
          <div className="mt-4 grid gap-2.5 text-xs text-slate-200">
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Lectura pública para ficha, bodega, ruta y sommelier sin reclamar ownership.</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Garantía, ownership, wallet/NFT o beneficios sensibles requieren compra validada, POS/PIN o política de marca.</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Marketplace por tenant con catálogo editable para beneficios, experiencias y productos.</div>
            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3">Panel enterprise para eventos, pharma, agro y cosmética con monitoreo geográfico y antifraude.</div>
          </div>
          <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-3 text-[11px] text-cyan-100">
            Security stack: QR + NTAG215 + NTAG424 DNA TT, con modo blockchain-ready cuando hay ROI de negocio.
          </div>
        </section>
      </div>
    </main>
  );
}
