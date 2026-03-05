import { Card, SectionHeading } from "@product/ui";

export default function TenantsPage() {
  return <main><SectionHeading eyebrow="Tenants" title="Tenant management" description="Create and govern enterprise customers, plans and operational access." /><Card className="mt-8 p-6"><p className="text-sm text-slate-300">Tenant listing, plan assignment and lifecycle controls.</p></Card></main>;
}
