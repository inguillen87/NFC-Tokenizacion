import { DashboardLayout } from "@product/ui";

export default async function ProofPage() {
  return (
    <DashboardLayout title="Trust Layers (IOTA / Polygon)">
      <div className="p-8 space-y-8 max-w-5xl text-white">
        <h1 className="text-3xl font-bold text-sky-400 tracking-tight">Trust Layers</h1>
        <p className="text-zinc-400">
          nexID allows enterprise clients to optionally anchor proofs to immutable ledgers.
          Polygon is used for ownership tokenization. IOTA is used for audit trails and evidence hashing.
        </p>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-semibold text-emerald-400">IOTA Audit Anchors</h2>
          <p className="text-sm text-zinc-500">
            Recent Merkle Roots representing batches of proof events.
          </p>
          <div className="text-zinc-400 text-sm">
            Please use the API directly for now. The full React table for IOTA anchors is currently being integrated.
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
