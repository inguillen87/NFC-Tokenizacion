import { Badge, Card } from "@product/ui";

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";

const MODE_STATE: Record<DemoMode, { label: string; tone: "green" | "amber" | "cyan" | "red"; message: string }> = {
  consumer_tap: { label: "VALID", tone: "green", message: "Producto auténtico. Escaneo válido y trazabilidad activa." },
  consumer_opened: { label: "OPENED", tone: "cyan", message: "Producto abierto / ownership activo en postventa." },
  consumer_tamper: { label: "TAMPER ALERT", tone: "amber", message: "Riesgo de manipulación detectado en el sello." },
  consumer_duplicate: { label: "REPLAY SUSPECT", tone: "red", message: "Lectura sospechosa de clon o repetición anómala." },
};

const PACK_DETAILS: Record<string, { title: string; fields: Array<{ label: string; value: string }> }> = {
  "wine-secure": {
    title: "Gran Reserva Malbec",
    fields: [
      { label: "Varietal", value: "Malbec" },
      { label: "Vintage", value: "2022" },
      { label: "Alcohol", value: "13.8%" },
      { label: "Barrica", value: "18 meses roble francés" },
      { label: "Región", value: "Valle de Uco, Mendoza" },
      { label: "Temperatura servicio", value: "16°C" },
      { label: "Ventana de guarda", value: "2026-2032" },
    ],
  },
};

export default async function PublicMobileDemoPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string; itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenant, itemId } = await params;
  const query = await searchParams;
  const pack = String(query.pack || "wine-secure");
  const modeValue = String(query.demoMode || "consumer_tap");
  const mode = (["consumer_tap", "consumer_opened", "consumer_tamper", "consumer_duplicate"].includes(modeValue) ? modeValue : "consumer_tap") as DemoMode;
  const state = MODE_STATE[mode];
  const detail = PACK_DETAILS[pack] || PACK_DETAILS["wine-secure"];

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <div className="mx-auto w-full max-w-[420px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estado comercial</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{state.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{state.message}</p>
              </div>
              <Badge tone={state.tone}>{state.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">Tenant: {tenant} · Item: {itemId} · Pack: {pack}</p>
          </Card>

          <Card className="p-4">
            <p className="text-lg font-semibold text-white">{detail.title}</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {detail.fields.map((field) => (
                <div key={field.label} className="rounded-lg border border-white/10 bg-slate-900 p-2.5 text-xs">
                  <p className="text-slate-400">{field.label}</p>
                  <p className="font-semibold text-white">{field.value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">CTA comerciales</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">Activar ownership</div>
              <div className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-violet-100">Registrar garantía</div>
              <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100">Ver provenance</div>
              <div className="rounded-lg border border-white/20 px-3 py-2 text-white">Tokenización opcional</div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}