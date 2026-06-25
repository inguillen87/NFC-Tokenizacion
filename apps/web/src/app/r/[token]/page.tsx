import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Gift,
  LockKeyhole,
  MailCheck,
  MapPin,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TicketCheck,
  WalletCards,
} from "lucide-react";
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
  if (!date || Number.isNaN(date.getTime())) return "48h desde emisión";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function labelForStatus(value?: string) {
  const status = String(value || "").toLowerCase();
  if (status === "redeemed") return { label: "Canjeado", tone: "border-slate-300/20 bg-slate-400/10 text-slate-200", dot: "bg-slate-300" };
  if (status === "expired") return { label: "Vencido", tone: "border-amber-300/25 bg-amber-400/10 text-amber-100", dot: "bg-amber-300" };
  if (status === "cancelled") return { label: "Pausado", tone: "border-rose-300/25 bg-rose-400/10 text-rose-100", dot: "bg-rose-300" };
  return { label: "Activo", tone: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100", dot: "bg-emerald-300" };
}

function formatCode(value?: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : "NEXID";
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
          <div className="card-holographic mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">nexID reward pass</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Voucher no disponible</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Este enlace no existe, venció o fue reemplazado por un pase más nuevo.
            </p>
            <Link href="/" className="btn-neon-glass mt-6 inline-flex rounded-xl px-4 py-2 text-sm font-black">
              Volver a nexID
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const summaryCards = [
    {
      label: "Beneficio",
      value: reward.reward?.title || "Voucher nexID",
      Icon: TicketCheck,
      tone: "border-cyan-300/20 bg-cyan-400/[0.07] text-cyan-200",
    },
    {
      label: "Válido hasta",
      value: formatDate(reward.expiresAt),
      Icon: CalendarClock,
      tone: "border-emerald-300/20 bg-emerald-400/[0.07] text-emerald-200",
    },
    {
      label: "Comercio",
      value: reward.tenant?.name || "nexID Partner",
      Icon: ShieldCheck,
      tone: "border-violet-300/20 bg-violet-400/[0.07] text-violet-200",
    },
  ];

  const validationSteps = [
    { label: "QR para comercio", detail: "El QR del pase abre validación staff, no datos internos.", Icon: QrCode },
    { label: "Código manual", detail: "El staff puede validar aunque falle la cámara.", Icon: WalletCards },
    { label: "Backup doble", detail: "WhatsApp y email conservan el beneficio para el cliente.", Icon: MailCheck },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_4%,rgba(34,211,238,.18),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(52,211,153,.14),transparent_28%),linear-gradient(135deg,#03131d_0%,#050816_48%,#10091d_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="group flex items-center gap-3 rounded-2xl outline-none ring-cyan-300/30 transition focus-visible:ring-4">
          <BrandLockup size={48} variant="ripple" theme="dark" />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-black text-white">nexID</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Reward Pass</span>
          </div>
        </Link>
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${status.tone}`}>
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-8 px-5 pb-12 pt-2 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_30px_100px_rgba(0,0,0,.42)] md:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-cyan-300/[0.04] to-transparent" />

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-200">Beneficio verificado</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">WhatsApp + email</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">CRM staff-ready</span>
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white md:text-6xl">
            Tu experiencia está lista para canjear.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            Mostrá este pase al llegar. El comercio confirma el código, tu teléfono enmascarado y el sello nexID antes de entregar el premio, cena, experiencia o descuento.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {summaryCards.map(({ label, value, Icon, tone }, index) => (
              <div key={label} className={`card-holographic animate-stagger-step rounded-2xl p-4 ${tone}`} style={{ animationDelay: `${index * 90}ms` }}>
                <Icon className="h-5 w-5" aria-hidden="true" />
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-black leading-snug text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,47,73,.28),rgba(15,23,42,.78))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Código de canje</p>
                <p className="mt-2 font-mono text-3xl font-black tracking-[0.18em] text-cyan-100 md:text-4xl">{formatCode(reward.code)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sello nexID</p>
                <p className="mt-2 font-mono text-sm font-black tracking-[0.14em] text-white">{reward.seal || "NEXID"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-cyan-200">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Titular</p>
              </div>
              <p className="mt-3 text-sm font-black text-white">{reward.consumer?.name || "Cliente nexID"}</p>
              <p className="mt-1 text-xs text-slate-400">{reward.consumer?.phoneMasked || "Teléfono verificado"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <MailCheck className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Respaldo</p>
              </div>
              <p className="mt-3 text-sm font-black text-white">{reward.consumer?.emailMasked || "WhatsApp verificado"}</p>
              <p className="mt-1 text-xs text-slate-400">No compartimos datos completos en este enlace.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="grid gap-3 md:grid-cols-3">
              {validationSteps.map(({ label, detail, Icon }) => (
                <div key={label} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-400/10 text-cyan-200">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-white">{label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={reward.passImageUrl} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,.22)] transition hover:-translate-y-0.5 hover:bg-cyan-200">
              Abrir pase visual <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href="/me/rewards" className="btn-neon-glass inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black">
              Ver beneficios
            </Link>
          </div>
        </div>

        <aside className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/60 p-4 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Reward Pass activo</p>
                <p className="text-[11px] text-slate-400">Visual listo para WhatsApp, email y mostrador.</p>
              </div>
            </div>
            <Sparkles className="h-5 w-5 text-cyan-200" aria-hidden="true" />
          </div>

          <div className="tilt-container relative overflow-hidden rounded-[1.7rem] border border-cyan-300/20 bg-cyan-300/[0.03] p-3">
            <div className="scan-laser-line opacity-60" />
            {reward.passImageUrl ? (
              <img src={reward.passImageUrl} alt="Pase visual nexID" className="h-auto w-full rounded-[1.35rem] border border-cyan-300/15 shadow-[0_24px_80px_rgba(8,145,178,.18)]" />
            ) : null}
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4">
            <div className="flex items-start gap-3">
              <LockKeyhole className="mt-0.5 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-white">Validación segura</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{reward.staffInstruction || "Validar código, teléfono y sello nexID antes de entregar beneficio."}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-xs font-bold text-cyan-100">
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Enlace seguro: no expone IDs internos ni datos privados de la empresa.</span>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Checklist staff</p>
            <div className="mt-3 space-y-2">
              {["Escanear QR o ingresar código", "Confirmar teléfono enmascarado", "Aplicar premio y marcar canjeado"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-violet-300/15 bg-violet-400/5 p-4 text-xs font-bold text-violet-100">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            Listo para campañas por cercanía, vouchers y fidelización post-tap.
          </div>
        </aside>
      </section>
    </main>
  );
}
