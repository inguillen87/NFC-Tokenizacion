import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { productUrls } from "@product/config";
import { DataTable } from "../../../components/data-table";
import { requireDashboardSession } from "../../../lib/session";
import { ShieldCheck, Link2 } from "lucide-react";

const API_BASE = productUrls.api;

async function getAnchors() {
  try {
    const response = await fetch(`${API_BASE}/admin/proof/anchors`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return payload.anchors || [];
  } catch {
    return [];
  }
}

export default async function ProofPage() {
  await requireDashboardSession("proof:read");

  const anchors = await getAnchors();

  const rows = anchors.map((row: any) => ({
    id: row.id,
    root: (
      <div className="font-mono text-xs text-zinc-300 truncate max-w-[200px]" title={row.merkle_root}>
        {row.merkle_root}
      </div>
    ),
    provider: (
      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs font-bold uppercase">
        {row.provider}
      </span>
    ),
    network: <span className="text-xs text-zinc-400">{row.network}</span>,
    events: row.event_count,
    type: <span className="text-xs text-zinc-400">{row.resource_type || "batch"}</span>,
    dates: row.created_at ? new Date(row.created_at).toLocaleDateString() : "-",
  }));

  return (
    <main className="space-y-8 max-w-6xl">
      <SectionHeading 
        eyebrow="Immutable Records" 
        title="Trust Layers" 
        description="nexID is blockchain-agnostic. Manage your multi-ledger architecture for ownership and evidence." 
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Polygon Layer</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Used for Tokenized Ownership, NFTs, Digital Certificates, and transferable Warranties.
          </p>
          <div className="mt-6">
            <Link href="/tokenization" className="text-sm font-semibold text-purple-400 hover:underline">
              Manage Ownership &rarr;
            </Link>
          </div>
        </Card>

        <Card className="p-6 border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-3 py-1 rounded-bl-lg">
            ACTIVE
          </div>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">IOTA Proof Layer</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Used for Audit Trails, DPP Evidence, Logistics Tamper Evidence, and Notarization.
          </p>
          <div className="mt-6 flex items-center gap-2">
            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">Testnet Enabled</span>
            <span className="text-xs text-zinc-500">Gasless anchoring enabled for batches.</span>
          </div>
        </Card>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
        <p className="text-sm text-amber-200">
          <strong>Notice:</strong> IOTA EVM Testnet is for prototyping only. Testnet data may reset and must not be used as legal/commercial proof.
        </p>
      </div>

      <DataTable
        title="Evidence Anchors (IOTA)"
        columns={[
          { key: "root", label: "Merkle Root" },
          { key: "provider", label: "Provider" },
          { key: "network", label: "Network" },
          { key: "type", label: "Event Type" },
          { key: "events", label: "Aggregated Events" },
          { key: "dates", label: "Anchored At" },
        ]}
        rows={rows}
        filterKey="provider"
        loadingLabel="Loading..."
        emptyLabel="No anchors found."
        searchPlaceholder="Search anchors..."
        allFilterLabel="All"
        refreshLabel="Refresh"
        statusMap={{}}
      />
    </main>
  );
}
