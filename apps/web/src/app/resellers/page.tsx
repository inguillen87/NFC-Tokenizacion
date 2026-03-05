import Link from "next/link";
import { Button, Card, SectionHeading } from "@product/ui";

export default function ResellersPage() {
  return (
    <main className="container-shell py-16">
      <SectionHeading eyebrow="Channel" title="White-label reseller program" description="Enable agencies, converters and distributors with secure NFC infrastructure." />
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <Card className="p-6"><h3 className="text-white">Co-branded console</h3><p className="mt-2 text-slate-400 text-sm">Shared product identity operations under partner branding.</p></Card>
        <Card className="p-6"><h3 className="text-white">Private-label mode</h3><p className="mt-2 text-slate-400 text-sm">Resellers can operate isolated tenant fleets with API controls.</p></Card>
      </div>
      <div className="mt-10"><Link href="/"><Button variant="secondary">Back</Button></Link></div>
    </main>
  );
}
