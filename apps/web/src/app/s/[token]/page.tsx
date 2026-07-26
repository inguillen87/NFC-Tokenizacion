import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Smartphone,
  TicketCheck,
} from "lucide-react";
import { BrandLockup } from "@product/ui";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";
const DASHBOARD_BASE = process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://app.nexid.lat";

type PublicReward = {
  code?: string;
  status?: string;
  seal?: string;
  expiresAt?: string;
  passImageUrl?: string;
  reward?: { title?: string; description?: string };
  tenant?: { name?: string };
  consumer?: {
    name?: string;
    phoneMasked?: string;
    emailMasked?: string;
    phoneVerifiedAt?: string;
    phone_verified_at?: string;
    phoneStatus?: string;
    phone_status?: string;
    emailVerifiedAt?: string;
    email_verified_at?: string;
    emailStatus?: string;
    email_status?: string;
  };
  staffInstruction?: string;
};

function cleanToken(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
}

function formatDate(value?: string) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Vencimiento no disponible";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusView(value?: string) {
  const status = String(value || "").toLowerCase();
  if (status === "redeemed") return { label: "Ya canjeado", className: "border-slate-300/20 bg-slate-400/10 text-slate-200" };
  if (status === "expired") return { label: "Vencido", className: "border-amber-300/25 bg-amber-400/10 text-amber-100" };
  if (status === "cancelled") return { label: "Pausado", className: "border-rose-300/25 bg-rose-400/10 text-rose-100" };
  if (["active", "issued", "available"].includes(status)) return { label: "Listo para validar", className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100" };
  return { label: "Estado no reportado", className: "border-amber-300/25 bg-amber-400/10 text-amber-100" };
}

function formatCode(value?: string) {
  const digits = String(value || "").replace(/[^\d]/g, "");
  return digits ? digits.replace(/(\d{4})(?=\d)/g, "$1 ") : "No disponible";
}

function hasExplicitContactVerification(consumer: PublicReward["consumer"], channel: "phone" | "email") {
  if (!consumer) return false;
  const masked = channel === "phone" ? consumer.phoneMasked : consumer.emailMasked;
  const verifiedAt = channel === "phone"
    ? consumer.phoneVerifiedAt || consumer.phone_verified_at
    : consumer.emailVerifiedAt || consumer.email_verified_at;
  const status = String(channel === "phone" ? consumer.phoneStatus || consumer.phone_status : consumer.emailStatus || consumer.email_status).toLowerCase();
  return Boolean(masked && verifiedAt && ["verified", "confirmed", "active"].includes(status));
}

async function fetchReward(token: string): Promise<PublicReward | null> {
  const safeToken = cleanToken(token);
  if (!safeToken) return null;
  const response = await fetch(`${API_BASE}/public/rewards/v/${encodeURIComponent(safeToken)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  }).catch(() => null);
  if (!response?.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.ok ? payload.reward : null;
}

export default async function StaffRewardValidationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const safeToken = cleanToken(token);
  const reward = await fetchReward(safeToken);
  const status = statusView(reward?.status);
  const crmUrl = `${DASHBOARD_BASE.replace(/\/$/, "")}/loyalty/campaigns`;

  if (!reward) {
    return (
      <main className="min-h-screen bg-[#030712] px-5 py-10 text-slate-100">
        <section className="mx-auto flex min-h-[76vh] max-w-xl flex-col justify-center">
          <BrandLockup size={54} variant="ripple" theme="dark" />
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Validador nexID</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Pase no encontrado</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              El QR no existe, venció o fue reemplazado por un pase más nuevo. Pedile al cliente que muestre el WhatsApp o el email más reciente.
            </p>
            <a href={crmUrl} className="mt-6 inline-flex rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100">
              Abrir CRM de canjes
            </a>
          </div>
        </section>
      </main>
    );
  }

  const phoneVerified = hasExplicitContactVerification(reward.consumer, "phone");
  const emailVerified = hasExplicitContactVerification(reward.consumer, "email");
  const hasVerifiedContact = phoneVerified || emailVerified;
  const hasCodeAndSeal = Boolean(reward.code && reward.seal);

  const checklist = [
    { label: hasCodeAndSeal ? "Comparar codigo y sello reportados con el pase presentado." : "BLOQUEADO: codigo o sello no reportado.", ready: hasCodeAndSeal },
    { label: hasVerifiedContact ? "Canal enmascarado con status y fecha de verificación reportados." : "BLOQUEADO: no hay teléfono o email con verificación explícita reportada.", ready: hasVerifiedContact },
    { label: "Registrar el canje desde el CRM para evitar reutilización.", ready: false },
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,.2),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(16,185,129,.14),transparent_28%),linear-gradient(135deg,#03131d_0%,#050816_52%,#10091d_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.035)_1px,transparent_1px)] bg-[size:72px_72px]" />

      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-3 rounded-2xl outline-none ring-cyan-300/30 transition focus-visible:ring-4">
          <BrandLockup size={48} variant="ripple" theme="dark" />
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-black text-white">nexID</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">Staff Validator</span>
          </div>
        </Link>
        <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] ${status.className}`}>
          {status.label}
        </span>
      </nav>

      <section className="mx-auto grid w-full max-w-6xl gap-6 px-5 pb-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/72 p-6 shadow-[0_30px_100px_rgba(0,0,0,.42)] md:p-8">
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1.5 text-cyan-200">Validación de comercio</span>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">QR staff</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">Datos protegidos</span>
          </div>

          <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] tracking-tight text-white md:text-6xl">
            Validá este beneficio antes de entregarlo.
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
            Esta pantalla es para staff del comercio. El cliente conserva su Reward Pass en WhatsApp/email; el equipo valida código, sello y contacto enmascarado desde el CRM nexID.
          </p>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-300/18 bg-cyan-400/[0.07] p-4">
              <TicketCheck className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Beneficio</p>
              <p className="mt-1 text-sm font-black leading-snug text-white">{reward.reward?.title || "Beneficio no disponible"}</p>
            </div>
            <div className="rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.07] p-4">
              <CalendarClock className="h-5 w-5 text-emerald-200" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Válido hasta</p>
              <p className="mt-1 text-sm font-black leading-snug text-white">{formatDate(reward.expiresAt)}</p>
            </div>
            <div className="rounded-2xl border border-violet-300/18 bg-violet-400/[0.07] p-4">
              <ShieldCheck className="h-5 w-5 text-violet-200" aria-hidden="true" />
              <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Comercio</p>
              <p className="mt-1 text-sm font-black leading-snug text-white">{reward.tenant?.name || "Comercio no disponible"}</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(8,47,73,.32),rgba(15,23,42,.78))] p-5">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Código de canje</p>
                <p className="mt-2 font-mono text-4xl font-black tracking-[0.18em] text-cyan-100 md:text-5xl">{formatCode(reward.code)}</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Sello nexID</p>
                <p className="mt-2 font-mono text-sm font-black tracking-[0.14em] text-white">{reward.seal || "No disponible"}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-cyan-200">
                <Smartphone className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cliente</p>
              </div>
              <p className="mt-3 text-sm font-black text-white">{reward.consumer?.name || "Nombre no disponible"}</p>
              <p className="mt-1 text-xs text-slate-400">{reward.consumer?.phoneMasked || "Teléfono no disponible"} · {phoneVerified ? "verificado" : "sin verificación reportada"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Privacidad</p>
              </div>
              <p className="mt-3 text-sm font-black text-white">{reward.consumer?.emailMasked || "Email no disponible"}</p>
              <p className="mt-1 text-xs text-slate-400">{emailVerified ? "Email verificado" : "Sin verificación de email reportada"}</p>
              <p className="mt-1 text-xs text-slate-400">No se exponen IDs internos, tenant slug ni datos completos.</p>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={crmUrl} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_16px_48px_rgba(34,211,238,.22)] transition hover:-translate-y-0.5 hover:bg-cyan-200">
              Abrir CRM de canjes <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link href={`/r/${safeToken}`} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 text-sm font-black text-white">
              Ver pase del cliente <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-slate-950/62 p-4 shadow-[0_30px_100px_rgba(0,0,0,.35)]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">QR de comercio</p>
                <p className="text-[11px] text-slate-400">No es la vista del consumidor.</p>
              </div>
            </div>
          </div>

          {reward.passImageUrl ? (
            <img src={reward.passImageUrl} alt="Reward Pass nexID" className="mt-4 h-auto w-full rounded-[1.35rem] border border-cyan-300/15 shadow-[0_24px_80px_rgba(8,145,178,.18)]" />
          ) : null}

          <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4">
            <div className="flex items-start gap-3">
              <ClipboardCheck className="mt-0.5 h-5 w-5 text-emerald-300" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-white">Checklist de canje</p>
                <div className="mt-3 space-y-2">
                  {checklist.map((item) => (
                    <div key={item.label} className={`flex items-start gap-2 text-xs font-bold leading-relaxed ${item.ready ? "text-slate-300" : "text-amber-200"}`}>
                      {item.ready ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" /> : <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />}
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-400/5 p-4 text-xs font-bold leading-relaxed text-cyan-100">
            <div className="flex items-start gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Canje final protegido: esta página informa; la acción operativa debe quedar registrada en el CRM del tenant.</span>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
