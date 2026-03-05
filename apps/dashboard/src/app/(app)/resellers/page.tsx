import { Badge, Card, SectionHeading } from "@product/ui";

export default function ResellersPage() {
  return (
    <main>
      <SectionHeading eyebrow="White-label" title="Reseller and partner operations" description="Run sub-tenants, partner margins and branded experiences from one dashboard." />
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6"><Badge tone="amber">Channel</Badge><h3 className="mt-3 text-white">Agency program</h3><p className="mt-2 text-sm text-slate-400">Campaign-focused bundles for premium launches.</p></Card>
        <Card className="p-6"><Badge tone="amber">Channel</Badge><h3 className="mt-3 text-white">Packaging converters</h3><p className="mt-2 text-sm text-slate-400">Manufacturing-integrated secure tags and manifests.</p></Card>
        <Card className="p-6"><Badge tone="amber">Channel</Badge><h3 className="mt-3 text-white">Regional distributors</h3><p className="mt-2 text-sm text-slate-400">Enterprise anti-fraud rollouts for pharma/cosmetics.</p></Card>
      </div>
    </main>
  );
}
