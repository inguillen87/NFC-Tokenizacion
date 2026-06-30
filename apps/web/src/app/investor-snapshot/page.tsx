import { InvestorSnapshotClient } from "./investor-snapshot-client";

export const metadata = {
  title: "nexID Investor Hub - Ecosistema Interactivo",
  description: "Presentación premium de negocios, manual de FAQs de objeciones y simulador de tap NFC Web3 interactivo para inversores y clientes.",
};

export default function InvestorSnapshotPage() {
  return (
    <main className="investor-snapshot-page min-h-screen bg-[#020617] text-slate-100 overflow-x-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      <InvestorSnapshotClient />
    </main>
  );
}
