import Link from "next/link";
import { Badge, Card } from "@product/ui";

export function MfaSettingsPanel() {
  return (
    <Card className="p-6" data-mfa-enrollment="unavailable">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Estado de seguridad</p>
          <h2 className="mt-2 text-xl font-semibold text-white">TOTP nexID temporalmente no disponible</h2>
        </div>
        <Badge tone="amber">fail-closed</Badge>
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
        El alta, la confirmación y la desactivación de TOTP están bloqueadas mientras se completa el flujo versionado de
        enrollment, step-up, recovery y auditoría. Esta pantalla no genera secretos ni recovery codes incompletos.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">Disponible ahora</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">Google/Clerk allowlisted para Super Admin y sesiones nexID con permisos por recurso.</p>
        </div>
        <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">No disponible</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">Setup TOTP, verificación de código, recovery codes y desactivación self-service.</p>
        </div>
        <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">Recuperación</p>
          <p className="mt-2 text-sm leading-6 text-slate-200">Un Super Admin puede revocar un MFA legacy detectado y sus sesiones; no puede habilitar uno nuevo.</p>
        </div>
      </div>
      <Link href="/settings" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2 text-sm font-bold text-slate-100 transition hover:border-cyan-300/40 hover:text-cyan-100">
        Volver a seguridad de la cuenta
      </Link>
    </Card>
  );
}
