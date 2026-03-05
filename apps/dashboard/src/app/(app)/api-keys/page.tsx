import { Card, SectionHeading } from "@product/ui";

export default function ApiKeysPage() {
  return <main><SectionHeading eyebrow="API Keys" title="API credential management" description="Issue, rotate and revoke API keys for tenant and reseller integrations." /><Card className="mt-8 p-6"><p className="text-sm text-slate-300">Key inventory with role-aware visibility and rotation policy status.</p></Card></main>;
}
