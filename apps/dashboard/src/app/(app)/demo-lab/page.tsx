import { SectionHeading } from "@product/ui";
import { DemoLab } from "../../../components/demo-lab";

export default function DemoLabPage() {
  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Demo Mission Control" title="Demo Lab" description="Flagship orchestration module: use vertical packs, upload CSV/JSON, simulate taps and stream live scans for buyer/investor demos." />
      <DemoLab />
    </main>
  );
}
