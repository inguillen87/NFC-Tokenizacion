import Link from "next/link";
import { Button, Card, SectionHeading } from "@product/ui";

export default function DocsPage() {
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow="Docs" title="Implementation quickstart" description="Operational docs for SUN, batch manifests and activation flow." />
      <Card className="mt-8 p-6">
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• API health: /health/</li>
          <li>• SUN validation: /sun/</li>
          <li>• Admin tenants: /admin/tenants/</li>
          <li>• Batch lifecycle: /admin/batches/ ...</li>
        </ul>
      </Card>
      <div className="mt-10"><Link href="/"><Button variant="secondary">Back</Button></Link></div>
    </main>
  );
}
