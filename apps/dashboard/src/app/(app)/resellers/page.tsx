import { Card, SectionHeading } from "@product/ui";

export default function ResellersPage() {
  return <main><SectionHeading eyebrow="Resellers" title="White-label channel management" description="Operate agencies and distributors with tenant-level controls and margin visibility." /><div className="mt-8 grid gap-6 lg:grid-cols-3"><Card className="p-6"><h3 className="text-white">Agency</h3></Card><Card className="p-6"><h3 className="text-white">Converter</h3></Card><Card className="p-6"><h3 className="text-white">Distributor</h3></Card></div></main>;
}
