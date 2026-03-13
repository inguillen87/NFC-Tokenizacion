import { SectionHeading } from "@product/ui";
import { DemoPublicExperience } from "../../../components/demo-public-experience";

export default function DemoPage() {
  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Public Demo"
        title="Probá un toque NFC simulado"
        description="Vista anónima: elegí vertical, corré escenario y mirá resultado + passport + mapa en vivo."
      />
      <DemoPublicExperience />
    </main>
  );
}
