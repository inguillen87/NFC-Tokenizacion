import { SectionHeading } from "@product/ui";
import { DemoLab } from "../../../components/demo-lab";

export default function DemoLabPage() {
  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Demo" title="Demo Lab" description="Generate an investor-ready winery demo using built-in files or custom CSV/JSON uploads." />
      <DemoLab />
    </main>
  );
}
