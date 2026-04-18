import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { requireDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type PassportResponse = {
  ok: boolean;
  scope?: { tenant: string; source: string; range: string; country: string };
  passport?: {
    identity: { uidHex: string; bid: string; tenantSlug: string; tagStatus: string; readCounter: number; scanCount: number };
    product: { productName: string; winery: string; region: string; vintage: string; varietal: string };
    provenance: {
      origin: { harvestYear: string | null; barrelMonths: number | null; temperatureStorage: number | null };
      firstVerified: { at: string | null; city: string; country: string };
      lastVerified: { at: string | null; result: string; city: string; country: string; deviceLabel: string };
    };
    tokenization: { status: string; network: string; txHash: string | null; tokenId: string | null };
  };
  timeline?: Array<{
    id: number;
    createdAt: string;
    result: string;
    reason: string;
    source: string;
    location: { city: string; country: string; lat: number | null; lng: number | null };
    device: { label: string; os: string; browser: string; deviceType: string; timezone: string };
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

async function getPassport(uid: string, params: URLSearchParams) {
  if (!(process.env.ADMIN_API_KEY || "").trim()) return null;
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetch(`${API_BASE}/admin/tags/${encodeURIComponent(uid)}/passport${query}`, {
      headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY || ""}` },
      cache: "no-store",
    });
    if (!response.ok) return null;
    return await response.json() as PassportResponse;
  } catch {
    return null;
  }
}

export default async function TagPassportPage({ params, searchParams }: { params: Promise<{ uid: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession();
  const resolvedParams = await params;
  const query = await searchParams;
  const uid = decodeURIComponent(resolvedParams.uid || "").toUpperCase();
  const tenantScope = session.role === "tenant-admin" ? String(session.tenantSlug || "") : String(query.tenant || "");
  const source = session.role === "tenant-admin" ? "real" : String(query.source || "all");
  const range = String(query.range || "30d");

  const apiParams = new URLSearchParams();
  if (tenantScope) apiParams.set("tenant", tenantScope);
  if (source !== "all") apiParams.set("source", source);
  apiParams.set("range", range);

  const data = await getPassport(uid, apiParams);
  const passport = data?.passport;
  const timeline = data?.timeline || [];

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Asset passport" title={uid} description="Identidad, provenance, verificaciones y estado de tokenización del activo físico." />
      <div><Link href="/tags" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">← Volver a tags</Link></div>

      {!passport ? <Card className="p-5 text-sm text-amber-100">No encontramos passport para este UID en el scope seleccionado.</Card> : (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Identity & product</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Tenant: <b>{passport.identity.tenantSlug}</b></p><p>BID: <b>{passport.identity.bid}</b></p>
              <p>UID: <b>{passport.identity.uidHex}</b></p><p>Tag status: <StatusChip label={passport.identity.tagStatus} tone={passport.identity.tagStatus === "active" ? "good" : "warn"} /></p>
              <p>Producto: <b>{passport.product.productName}</b></p><p>Bodega / Región: <b>{passport.product.winery} / {passport.product.region}</b></p>
              <p>Varietal / Vintage: <b>{passport.product.varietal} / {passport.product.vintage}</b></p><p>Scans / Read counter: <b>{passport.identity.scanCount} / {passport.identity.readCounter}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Provenance & verification</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Harvest year: <b>{passport.provenance.origin.harvestYear || "-"}</b></p><p>Barrel months: <b>{passport.provenance.origin.barrelMonths ?? "-"}</b></p>
              <p>Storage temp (°C): <b>{passport.provenance.origin.temperatureStorage ?? "-"}</b></p><p>First verified: <b>{formatDate(passport.provenance.firstVerified.at)} · {passport.provenance.firstVerified.city}, {passport.provenance.firstVerified.country}</b></p>
              <p>Last verified: <b>{formatDate(passport.provenance.lastVerified.at)} · {passport.provenance.lastVerified.city}, {passport.provenance.lastVerified.country}</b></p><p>Last result / device: <b>{passport.provenance.lastVerified.result} / {passport.provenance.lastVerified.deviceLabel}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tokenization</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Status: <StatusChip label={passport.tokenization.status} tone={passport.tokenization.status === "minted" ? "good" : "neutral"} /></p><p>Network: <b>{passport.tokenization.network}</b></p>
              <p>Token ID: <b>{passport.tokenization.tokenId || "-"}</b></p><p className="break-all">Tx hash: <b>{passport.tokenization.txHash || "-"}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Verification timeline</h2>
            {!timeline.length ? <p className="mt-3 text-sm text-slate-400">Sin eventos todavía.</p> : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Ubicación</th><th className="px-3 py-2">Dispositivo</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reason</th></tr></thead>
                  <tbody>
                    {timeline.map((event) => (
                      <tr key={event.id} className="border-b border-white/5 text-slate-200">
                        <td className="px-3 py-2">{formatDate(event.createdAt)}</td>
                        <td className="px-3 py-2">{event.result}</td>
                        <td className="px-3 py-2">{event.location.city}, {event.location.country}</td>
                        <td className="px-3 py-2">{event.device.label}<br /><span className="text-slate-400">{event.device.os} · {event.device.browser} · {event.device.deviceType} · {event.device.timezone}</span></td>
                        <td className="px-3 py-2">{event.source}</td>
                        <td className="px-3 py-2">{event.reason || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </main>
  );
}
