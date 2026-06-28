import Link from "next/link";
import { Card } from "@product/ui";
import { LockKeyhole, ShieldCheck, TimerReset } from "lucide-react";

type SupplierLegacyIntakeBlockedProps = {
  context?: "supplier" | "onboarding";
};

export function SupplierLegacyIntakeBlocked({ context = "supplier" }: SupplierLegacyIntakeBlockedProps) {
  const isOnboarding = context === "onboarding";

  return (
    <Card className="border-amber-300/25 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(2,6,23,0.96))] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-100">
            <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
            legacy intake bloqueado
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
            Las llaves de fabrica ya no se pegan en el navegador.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            El flujo productivo usa Supplier Order: nexID genera K_META_BATCH y K_FILE_BATCH en servidor, crea sub-batches, exporta un pack cifrado de un solo uso y deja evidencia en Tenant Vault.
            {isOnboarding ? " Para onboarding operativo, el primer paso es abrir Supplier batches y trabajar contra el pedido industrial." : ""}
          </p>
        </div>
        <Link
          href="/batches/supplier"
          className="rounded-2xl border border-cyan-300/35 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-50 transition hover:bg-cyan-400/15"
        >
          Abrir Supplier Order
        </Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          {
            Icon: ShieldCheck,
            title: "Sin llaves plaintext",
            body: "El frontend no pide K_META ni K_FILE. El proveedor recibe solo el ZIP cifrado y la clave va por canal separado.",
          },
          {
            Icon: TimerReset,
            title: "Pack one-time",
            body: "Si el pack ya fue exportado, se bloquea una segunda entrega. Para corregir, se rota lote o se crea un nuevo pedido.",
          },
          {
            Icon: LockKeyhole,
            title: "Manifest inmutable",
            body: "Una vez importado, el manifiesto no se pisa. Las correcciones se auditan como nuevo sub-batch.",
          },
        ].map(({ Icon, title, body }) => (
          <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <Icon className="h-5 w-5 text-amber-100" aria-hidden="true" />
            <h3 className="mt-3 text-sm font-black text-white">{title}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
          </article>
        ))}
      </div>
    </Card>
  );
}
