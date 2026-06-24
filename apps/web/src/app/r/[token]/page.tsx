import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarClock, LockKeyhole, ShieldCheck, TicketCheck } from "lucide-react";
import { BrandLockup } from "@product/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type PublicReward = {
  code?: string;
  status?: string;
  seal?: string;
  expiresAt?: string;
  passImageUrl?: string;
  reward?: { title?: string; description?: string };
  tenant?: { name?: string };
  consumer?: { name?: string; phoneMasked?: string; emailMasked?: string };
  staffInstruction?: string;
};

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "48h desde emision";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelForStatus(value?: string) {
  const status = String(value || "").toLowerCase();
  if (status === "redeemed") return { label: "Canjeado", tone: "border-slate-300/20 bg-slate-400/10 text-slate-200" };
  if (status === "expired") return { label: "Vencido", tone: "border-amber-300/25 bg-amber-400/10 text-amber-100" };
  if (status === "cancelled") return { label: "Pausado", tone: "border-rose-300/25 bg-rose-400/10 text-rose-100" };
  return { label: "Activo", tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" };
}

async function fetchReward(token: string): Promise<PublicReward | null> {
  const safeToken = token.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
  if (!safeToken) return null;
  const response = await fetch(`${API_BASE}/public/rewards/v/${encodeURIComponent(safeToken)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.ok ? payload.reward : null;
}

export default async function PublicRewardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const reward = await fetchReward(token);
  const status = labelForStatus(reward?.status);

  if (!reward) {
    return (
      <main className="min-h-screen bg-[#030712] px-5 py-10 text-slate-100">
        <section className="mx-auto flex min-h-[76vh] max-w-xl flex-col justify-center">
          <BrandLockup size={54} variant="ripple" theme="dark" />
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">nexID reward pass</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Voucher no disponible</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Este enlace no existe, vencio o fue reemplazado por un pase mas nuevo.
            </p>
            <Link href="/" className="mt-6 inline-flex rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
              Volver a nexID
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_4%,rgba(34,211,238,.18),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(52,211,153,.14),transparent_28%),linear-gradient(135deg,#03131d_0%,#050816_48%,#10091d_100%)]" />
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <BrandLockup size={46} variant="ripple" theme="dark" />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-black text-white">nexID</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-200">Reward Pass</span>
          </div>
        </Link>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${status.tone}`}>
          {status.label}
        </span>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-10 pt-2 lg:grid-cols-[minmax(0,1fr)_410px] lg:items-center">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_30px_100px_rgba(0,0,0,.42)] md:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-300">Beneficio verificado</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white md:text-6xl">
            Tu experiencia esta lista para canjear.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            Mostra este pase al llegar. El comercio confirma el codigo, tu telefono enmascarado y el sello nexID antes de entregar el premio, cena, experiencia o descuento.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4">
              <TicketCheck className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Beneficio</p>
              <p className="mt-1 text-sm font-black text-white">{reward.reward?.title || "Voucher nexID"}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4">
              <CalendarClock className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Valido hasta</p>
              <p className="mt-1 text-sm font-black text-white">{formatDate(reward.expiresAt)}</p>
            </div>
            <div className="rounded-2xl border border-violet-300/15 bg-violet-400/5 p-4">
              <ShieldCheck className="h-5 w-5 text-violet-200" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Comercio</p>
              <p className="mt-1 text-sm font-black text-white">{reward.tenant?.name || "nexID Partner"}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.045] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Codigo de canje</p>
                <p className="mt-2 font-mono text-3xl font-black tracking-[0.16em] text-cyan-100">{reward.code}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Sello nexID</p>
                <p className="mt-2 font-mono text-sm font-black tracking-[0.14em] text-white">{reward.seal || "NEXID"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Titular</p>
              <p className="mt-2 text-sm font-black text-white">{reward.consumer?.name || "Cliente nexID"}</p>
              <p className="mt-1 text-xs text-slate-400">{reward.consumer?.phoneMasked || "Telefono verificado"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Respaldo</p>
              <p className="mt-2 text-sm font-black text-white">{reward.consumer?.emailMasked || "WhatsApp verificado"}</p>
              <p className="mt-1 text-xs text-slate-400">No compartimos datos completos en este enlace.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={reward.passImageUrl} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200">
              Abrir pase visual <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href="/me/rewards" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.08]">
              Ver beneficios
            </Link>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/60 p-4 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          {reward.passImageUrl ? (
            <img src={reward.passImageUrl} alt="Pase visual nexID" className="h-auto w-full rounded-[1.45rem] border border-cyan-300/15" />
          ) : null}
          <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-white">Validacion segura</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{reward.staffInstruction || "Validar codigo, telefono y sello nexID antes de entregar beneficio."}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-xs font-bold text-cyan-100">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            Enlace opaco: no expone tenant, IDs internos ni parametros de base de datos.
          </div>
        </aside>
      </section>
    </main>
  );
}
