import { Card, SectionHeading } from "@product/ui";
import { Activity, Coins, Globe, HardDrive, KeyRound, Layers, Shield, Sparkles, Terminal } from "lucide-react";
import { getDashboardI18n } from "../../../lib/locale";
import { dashboardContent } from "../../../lib/dashboard-content";

const code = `import { NexIdClient } from "@nexid/sdk";

const nexid = new NexIdClient({ apiKey, tenantSlug: "demobodega" });
const product = await nexid.getProduct("DEMO-2026-02");
const pos = await nexid.activatePosPurchase({ bid: product.batch.bid, uidHex, externalOrderId });
await nexid.claimOwnership({ contact: buyer.email, bid: product.batch.bid, uidHex, posToken: pos.posToken });`;

const hardwareModes = [
  {
    title: "nexID secure chips",
    icon: Shield,
    tone: "cyan",
    body: "NTAG 424 DNA / TagTamper y perfiles SUN para anti-copia fuerte, anti-replay y apertura fisica. Las llaves privadas no se descargan: se gobiernan desde backend/HSM, rotacion y manifests auditables.",
  },
  {
    title: "Bring your own QR / NFC",
    icon: HardDrive,
    tone: "amber",
    body: "Si el cliente ya tiene QR, codigo de barras, GS1 Digital Link o NFC basico, el SDK captura passport, analytics, leads, sommelier y marketplace. No promete anti-clon criptografico sin SUN.",
  },
];

const businessModel = [
  "Setup y onboarding por tenant, lote, carrier profile y reglas comerciales.",
  "SaaS mensual por dashboard, SDK usage, analytics, alertas y soporte.",
  "Uso API por verificaciones, webhooks, POS activations, claims y marketplace events.",
  "Capa premium opcional: tokenizacion, ownership transfer, certificados y SLAs enterprise.",
];

const globalPillars = [
  { title: "LATAM", body: "Entrada barata con QR/SDK y tags de menor costo cuando el margen por unidad lo exige." },
  { title: "Europa", body: "Lujo, vinos premium y trazabilidad fuerte con NTAG 424 DNA, tamper y evidencia criptografica." },
  { title: "Global", body: "GS1 Digital Link, webhooks, UHF/NFC hibrido y APIs para integrarse con retail, ERP y logistica." },
];

export default async function SdkVisionPage() {
  const { locale } = await getDashboardI18n();
  const copy = dashboardContent[locale];

  return (
    <main className="space-y-8 pb-12">
      <SectionHeading
        eyebrow="Developer Hub"
        title={copy.pages.sdkVision.title}
        description={copy.pages.sdkVision.description}
      />

      <Card className="relative overflow-hidden p-6">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">Que hace el SDK</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Convierte nexID en infraestructura integrable, no solo en una app cerrada.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              El SDK permite que una bodega, marca, retailer o integrador conecte productos fisicos con e-commerce, POS, ERP, CRM, marketplace, loyalty y analytics. La diferencia frente a plataformas enterprise cerradas no es negar que tengan APIs: es dar un camino mas directo, barato y autoservicio para implementar.
            </p>
          </div>
          <div className="rounded-xl border border-cyan-300/15 bg-slate-950 p-4">
            <pre className="overflow-x-auto text-xs leading-6 text-cyan-50"><code>{code}</code></pre>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {hardwareModes.map((mode) => {
          const Icon = mode.icon;
          const classes = mode.tone === "cyan"
            ? "border-cyan-500/30 bg-cyan-500/5 text-cyan-300"
            : "border-amber-500/30 bg-amber-500/5 text-amber-300";
          return (
            <Card key={mode.title} className={`p-6 ${classes}`}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-current/30 bg-slate-950/40">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="text-base font-bold text-white">{mode.title}</h3>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-300">{mode.body}</p>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">SDK calls</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <b className="mt-4 block text-2xl font-black text-white">Auditables</b>
          <span className="mt-2 block text-xs text-slate-500">Cada endpoint registra tenant, key, latencia, status, IP/country y trace.</span>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Claim seguro</span>
            <KeyRound className="h-4 w-4 text-emerald-400" />
          </div>
          <b className="mt-4 block text-2xl font-black text-white">POS + PIN</b>
          <span className="mt-2 block text-xs text-slate-500">Leer en gondola no da propiedad. POS token y politica de marca controlan ownership.</span>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Webhooks</span>
            <Terminal className="h-4 w-4 text-violet-400" />
          </div>
          <b className="mt-4 block text-2xl font-black text-white">Firmados</b>
          <span className="mt-2 block text-xs text-slate-500">Eventos hacia ERP, CRM, soporte y data warehouse con HMAC cuando hay secret.</span>
        </Card>
      </div>

      <Card className="p-6">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-300"><DollarIcon />Modelo de negocio</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {businessModel.map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{item}</div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {globalPillars.map((pillar) => (
          <Card key={pillar.title} className="p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-cyan-300">
              <Globe className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-bold text-white">{pillar.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{pillar.body}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <h4 className="text-sm font-bold text-white">Eventos y telemetria real</h4>
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-400">`verifyTap`, `claimOwnership`, `activatePosPurchase` y `reportEvent` alimentan analytics, heatmaps, leads, riesgos y el CRM tenant.</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-bold text-white">Web3 como capa opcional</h4>
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-400">NFT, certificados y ownership tokenizado se activan solo cuando hay ROI y prueba suficiente. No se fuerza blockchain para casos QR/engagement basicos.</p>
        </Card>
      </div>
    </main>
  );
}

function DollarIcon() {
  return <Sparkles className="h-4 w-4 text-cyan-300" />;
}
