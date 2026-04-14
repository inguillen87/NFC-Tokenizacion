import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { TENANT_DIRECTORY } from "../../../../lib/tenant-directory";
import { productUrls } from "@product/config";

export default async function TenantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = TENANT_DIRECTORY.find((item) => item.slug === slug);

  if (!tenant) {
    return (
      <main className="space-y-6">
        <SectionHeading eyebrow="Tenants" title={slug} description="Cuenta no encontrada en el directorio demo." />
        <Card className="p-6 text-sm text-rose-200">Tenant no encontrado. Volvé a la lista y elegí una cuenta disponible.</Card>
      </main>
    );
  }

  const publicMobile = `${productUrls.web}/demo-lab/mobile/${tenant.slug}/demo-item-001?pack=wine-secure&demoMode=consumer_tap`;

  return (
    <main className="space-y-8">
      <SectionHeading eyebrow="Tenant overview" title={tenant.tenant} description="Vista navegable de cuenta enterprise: estado operativo, comercial y próximos pasos." />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <h2 className="text-base font-semibold text-white">Resumen de cuenta</h2>
          <dl className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div><dt className="text-slate-400">Slug</dt><dd className="text-white">{tenant.slug}</dd></div>
            <div><dt className="text-slate-400">Plan</dt><dd className="text-white">{tenant.plan}</dd></div>
            <div><dt className="text-slate-400">Region</dt><dd className="text-white">{tenant.region}</dd></div>
            <div><dt className="text-slate-400">Vertical</dt><dd className="text-white">{tenant.vertical}</dd></div>
            <div><dt className="text-slate-400">Operational health</dt><dd className="text-white">{tenant.health}</dd></div>
            <div><dt className="text-slate-400">Status</dt><dd className="text-white">{tenant.status}</dd></div>
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold text-white">Quick CTA</h2>
          <div className="mt-3 grid gap-2 text-xs">
            <Link href="/batches/supplier" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">Create supplier batch</Link>
            <Link href={`/batches?tenant=${tenant.slug}`} className="rounded-lg border border-white/15 px-3 py-2 text-slate-100">Import manifest / activate</Link>
            <Link href={`/demo-lab?tenant=${tenant.slug}`} className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-violet-100">Open demo lab</Link>
            <a href={publicMobile} className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100" target="_blank" rel="noreferrer">Open public mobile preview</a>
            <Link href={`/leads-tickets?tenant=${tenant.slug}`} className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100">Lead / opportunities</Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Link href={`/batches?tenant=${tenant.slug}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-200">Batches</Link>
        <Link href={`/tags?tenant=${tenant.slug}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-200">Tags</Link>
        <Link href={`/events?tenant=${tenant.slug}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-200">Events</Link>
        <Link href={`/subscriptions?tenant=${tenant.slug}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-xs text-slate-200">Plan / billing</Link>
        <Link href={`/analytics?tenant=${tenant.slug}`} className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4 text-xs text-cyan-100">Operational health</Link>
        <Link href={`/leads-tickets?tenant=${tenant.slug}`} className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-xs text-amber-100">Leads / opportunities</Link>
        <Link href={`/api-keys?tenant=${tenant.slug}`} className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4 text-xs text-violet-100">Webhooks / keys</Link>
        <Link href={`/demo?tenant=${tenant.slug}`} className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-xs text-emerald-100">Manifests / demo ops</Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5 text-sm text-slate-300">
          <h3 className="font-semibold text-white">Operational modules</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Batches y tags para emisión y lifecycle.</li>
            <li>Events para auditoría, excepción y cumplimiento.</li>
            <li>Manifests para trazabilidad de programación proveedor.</li>
            <li>Webhooks para integración externa ERP/CRM.</li>
          </ul>
        </Card>
        <Card className="p-5 text-sm text-slate-300">
          <h3 className="font-semibold text-white">Commercial modules</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Leads y oportunidades generadas por CTA de demo.</li>
            <li>Planes y expansión por país/canal.</li>
            <li>Reseller context (si aplica) y soporte de cuenta.</li>
            <li>Ownership / warranty / provenance / tokenization-ready.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
