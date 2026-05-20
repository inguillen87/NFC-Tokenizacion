import { SectionHeading } from "@product/ui";
import { ProductAssetBankPanel } from "../../../components/product-asset-bank-panel";
import { TokenizationQueuePanel } from "../../../components/tokenization-queue-panel";

export default function TokenizationPage() {
  return (
    <main className="space-y-6">
      <SectionHeading
        eyebrow="Blockchain sandbox"
        title="Tokenization & API runway"
        description="Cola operativa para conectar taps reales, passport publico, marketplace y proof on-chain en Polygon Amoy o modo simulado."
      />
      <ProductAssetBankPanel />
      <TokenizationQueuePanel />
    </main>
  );
}
