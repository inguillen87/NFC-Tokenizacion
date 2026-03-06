import { SectionHeading } from "@product/ui";
import { DemoControlCenter } from "../../../components/demo-control-center";

export default function DemoPage() {
  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Demo"
        title="Demo Control Center"
        description="Investor-ready one-click controls to seed Demo Bodega and simulate production-like scans."
      />
      <DemoControlCenter />
    </main>
  );
}
