import Link from "next/link";
import { Card, SectionHeading } from "@product/ui";
import { requireDashboardSession } from "../../../../lib/session";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.nexid.lat";

type PassportResponse = {
  ok: boolean;
  scope?: { tenant: string };
  passport?: {
    uid_hex: string;
    bid: string;
    tenant_slug: string;
    product_name: string | null;
    sku: string | null;
    winery: string | null;
    region: string | null;
    grape_varietal: string | null;
    vintage: string | null;
    harvest_year: number | null;
    barrel_months: number | null;
    temperature_storage: string | null;
    tag_status: string;
    scan_count: number;
    first_verified_at: string | null;
    last_verified_at: string | null;
    first_city: string | null;
    first_country: string | null;
    last_city: string | null;
    last_country: string | null;
    last_result: string | null;
    tokenization_status: string | null;
    network: string | null;
    tx_hash: string | null;
    token_id: string | null;
  };
  timeline?: Array<{
    id: number;
    created_at: string;
    result: string;
    reason: string | null;
    city: string | null;
    country_code: string | null;
    source: string | null;
    device_label: string | null;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
}

async function getPassport(uid: string, tenant: string) {
  if (!(process.env.ADMIN_API_KEY || "").trim()) return null;
  const query = tenant ? `?tenant=${encodeURIComponent(tenant)}` : "";
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

export default async function TagPassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const session = await requireDashboardSession();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const uid = decodeURIComponent(resolvedParams.uid || "").toUpperCase();
  const tenantScope = session.role === "tenant-admin" ? (session.tenantSlug || "") : (resolvedSearchParams.tenant || "");
  const data = await getPassport(uid, tenantScope);
  const passport = data?.passport;
  const timeline = data?.timeline || [];

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Tag passport" title={uid} description="Identidad física + trazabilidad verificada + estado de tokenización." />
      <div>
        <Link href="/tags" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">← Volver a tags</Link>
      </div>

      {!passport ? (
        <Card className="p-5 text-sm text-amber-100">No encontramos passport para este UID en el scope seleccionado.</Card>
      ) : (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Bottle passport</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Tenant: <b>{passport.tenant_slug}</b></p>
              <p>BID: <b>{passport.bid}</b></p>
              <p>Producto: <b>{passport.product_name || passport.sku || "-"}</b></p>
              <p>Bodega / Región: <b>{passport.winery || "-"} / {passport.region || "-"}</b></p>
              <p>Varietal / Vintage: <b>{passport.grape_varietal || "-"} / {passport.vintage || "-"}</b></p>
              <p>Cosecha: <b>{passport.harvest_year || "-"}</b></p>
              <p>Tag status: <b>{passport.tag_status}</b></p>
              <p>Scan count: <b>{passport.scan_count}</b></p>
              <p>Primera verificación: <b>{formatDate(passport.first_verified_at)} · {passport.first_city || "-"}, {passport.first_country || "-"}</b></p>
              <p>Última ubicación verificada: <b>{formatDate(passport.last_verified_at)} · {passport.last_city || "-"}, {passport.last_country || "-"}</b></p>
              <p>Último resultado: <b>{passport.last_result || "-"}</b></p>
              <p>Storage: <b>{passport.temperature_storage || "-"}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tokenización</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Status: <b>{passport.tokenization_status || "none"}</b></p>
              <p>Network: <b>{passport.network || "-"}</b></p>
              <p>Token ID: <b>{passport.token_id || "-"}</b></p>
              <p className="break-all">Tx hash: <b>{passport.tx_hash || "-"}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Timeline de verificaciones</h2>
            {!timeline.length ? (
              <p className="mt-3 text-sm text-slate-400">Sin eventos todavía.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[900px] text-left text-xs">
                  <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Resultado</th>
                      <th className="px-3 py-2">Ubicación</th>
                      <th className="px-3 py-2">Dispositivo</th>
                      <th className="px-3 py-2">Fuente</th>
                      <th className="px-3 py-2">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((event) => (
                      <tr key={event.id} className="border-b border-white/5 text-slate-200">
                        <td className="px-3 py-2">{formatDate(event.created_at)}</td>
                        <td className="px-3 py-2">{event.result}</td>
                        <td className="px-3 py-2">{event.city || "-"}, {event.country_code || "-"}</td>
                        <td className="px-3 py-2">{event.device_label || "-"}</td>
                        <td className="px-3 py-2">{event.source || "-"}</td>
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
