import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { AlertTriangle, Boxes, CheckCircle2, Fingerprint, MapPin, PackageCheck, ShieldCheck, Truck } from "lucide-react";
import { headers } from "next/headers";
import { requireDashboardSession } from "../../../../../lib/session";
import { getServerOrigin } from "../../../../../lib/server-origin";
import { SecureDeliveryClaimForm } from "../../../../../components/secure-delivery-claim-form";

type ShipmentDetailResponse = {
  ok?: boolean;
  shipment?: Record<string, any>;
  items?: Array<Record<string, any>>;
  seals?: Array<Record<string, any>>;
  custodyEvents?: Array<Record<string, any>>;
  verifications?: Array<Record<string, any>>;
  claims?: Array<Record<string, any>>;
  reason?: string;
};

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

function statusTone(status: string) {
  const normalized = String(status || "").toUpperCase();
  if (["DELIVERED_CLOSED", "SEALED"].includes(normalized)) return "good" as const;
  if (["IN_TRANSIT", "ASSIGNED"].includes(normalized)) return "neutral" as const;
  if (["DELIVERED_OPENED", "QUARANTINED"].includes(normalized)) return "risk" as const;
  return "warn" as const;
}

async function getShipmentDetail(origin: string, shipmentId: string, cookie: string, tenantScope: string, sandbox: boolean) {
  const params = new URLSearchParams();
  if (tenantScope) params.set("tenant", tenantScope);
  if (sandbox) params.set("sandbox", "1");
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetch(`${origin}/api/admin/logistics/shipments/${encodeURIComponent(shipmentId)}${query}`, {
      cache: "no-store",
      headers: cookie ? { cookie } : undefined,
    });
    if (!response.ok) return null;
    return await response.json() as ShipmentDetailResponse;
  } catch {
    return null;
  }
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: any }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export default async function ShipmentDetailPage({ params, searchParams }: { params: Promise<{ shipmentId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession("logistics:read");
  const origin = await getServerOrigin();
  const cookie = (await headers()).get("cookie") || "";
  const { shipmentId } = await params;
  const query = await searchParams;
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : String(query.tenant || "");
  const data = await getShipmentDetail(origin, decodeURIComponent(shipmentId || ""), cookie, tenantScope, query.sandbox === "1");

  const shipment = data?.shipment;
  const items = data?.items || [];
  const seals = data?.seals || [];
  const custodyEvents = data?.custodyEvents || [];
  const verifications = data?.verifications || [];
  const claims = data?.claims || [];

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Secure Delivery" title={shipment?.shipment_code || decodeURIComponent(shipmentId || "")} description="Shipment identity, physical seal evidence, custody timeline, recipient verification and delivery claims." />
      <div className="flex flex-wrap gap-2">
        <Link href="/logistics" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">← Logistics hub</Link>
        <Link href="/logistics/shipments" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">All shipments</Link>
      </div>

      {!shipment ? (
        <Card className="p-5 text-sm text-amber-100">Shipment not found in the selected tenant scope.</Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">{shipment.tenant_name || shipment.tenant_slug}</p>
                <h2 className="mt-2 text-3xl font-black text-white">{shipment.shipment_code}</h2>
                <p className="mt-2 text-sm text-slate-400">Tracking: <b className="text-slate-200">{shipment.tracking_number || "-"}</b></p>
              </div>
              <StatusChip label={shipment.status || "unknown"} tone={statusTone(shipment.status)} />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500"><MapPin className="h-4 w-4 text-cyan-300" /> Origin</p>
                <p className="mt-2 text-sm text-slate-200">{shipment.origin_address || "-"}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500"><Truck className="h-4 w-4 text-emerald-300" /> Destination</p>
                <p className="mt-2 text-sm text-slate-200">{shipment.destination_address || "-"}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-5">
            <MetricCard label="Items" value={shipment.item_quantity || items.length} icon={Boxes} />
            <MetricCard label="Seals" value={shipment.seal_count || seals.length} icon={Fingerprint} />
            <MetricCard label="Custody events" value={shipment.custody_event_count || custodyEvents.length} icon={PackageCheck} />
            <MetricCard label="Verifications" value={shipment.verification_count || verifications.length} icon={CheckCircle2} />
            <MetricCard label="Claims" value={shipment.claim_count || claims.length} icon={AlertTriangle} />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-5">
              <h3 className="text-lg font-black text-white">Custody timeline</h3>
              {!custodyEvents.length ? <p className="mt-3 text-sm text-slate-400">No custody events yet.</p> : (
                <div className="mt-5 space-y-3">
                  {custodyEvents.map((event) => (
                    <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-cyan-100">{event.event_type}</p>
                        <p className="text-xs text-slate-500">{formatDate(event.created_at)}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-300">{event.location || "No location"} · {event.scanned_by || "Unknown operator"}</p>
                      {event.notes ? <p className="mt-2 text-xs text-slate-500">{event.notes}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div className="space-y-5">
              <Card className="p-5">
                <h3 className="text-lg font-black text-white">Physical seals</h3>
                {!seals.length ? <p className="mt-3 text-sm text-slate-400">No seal assigned yet.</p> : (
                  <div className="mt-4 space-y-3">
                    {seals.map((seal) => (
                      <div key={seal.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-sm font-black text-white">{seal.uid_hex}</p>
                          <StatusChip label={seal.status || seal.inventory_status || "unknown"} tone={statusTone(seal.status || seal.inventory_status)} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Applied: {formatDate(seal.applied_at || seal.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h3 className="text-lg font-black text-white">Recipient verification</h3>
                {!verifications.length ? <p className="mt-3 text-sm text-slate-400">No recipient verification yet.</p> : (
                  <div className="mt-4 space-y-3">
                    {verifications.map((verification) => (
                      <div key={verification.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-white">{verification.recipient_name || "Recipient"}</p>
                          <StatusChip label={verification.status || "pending"} tone={verification.status === "verified" ? "good" : "warn"} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{verification.verification_method || "NFC_TAP"} · {formatDate(verification.verified_at || verification.created_at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <h3 className="text-lg font-black text-white">Items</h3>
              </div>
              {!items.length ? <p className="mt-3 text-sm text-slate-400">No items registered.</p> : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Product / asset</th><th className="px-4 py-3">Qty</th></tr></thead>
                    <tbody>{items.map((item) => <tr key={item.id} className="border-t border-white/5"><td className="px-4 py-3 text-slate-200">{item.product_name}</td><td className="px-4 py-3 text-slate-200">{item.quantity}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-lg font-black text-white">Delivery claims</h3>
              {!claims.length ? <p className="mt-3 text-sm text-slate-400">No claims opened.</p> : (
                <div className="mt-4 space-y-3">
                  {claims.map((claim) => (
                    <div key={claim.id} className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-black text-rose-100">{claim.issue_type}</p>
                        <StatusChip label={claim.status || "open"} tone={claim.status === "open" ? "risk" : "neutral"} />
                      </div>
                      <p className="mt-2 text-sm text-rose-50/80">{claim.description}</p>
                      <p className="mt-2 text-xs text-rose-100/50">{formatDate(claim.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <SecureDeliveryClaimForm shipmentId={String(shipment.id)} />
        </>
      )}
    </main>
  );
}
