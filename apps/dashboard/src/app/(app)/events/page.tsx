import { Card, SectionHeading } from "@product/ui";

export default function EventsPage() {
  return <main><SectionHeading eyebrow="Events" title="Security events stream" description="Operational feed for scans, duplicates, tamper and replay suspects." /><Card className="mt-8 p-6"><p className="text-sm text-slate-300">Real-time event table connected to existing API logs pipeline.</p></Card></main>;
}
