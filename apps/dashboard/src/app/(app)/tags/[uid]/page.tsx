import Link from "next/link";
import { Card, SectionHeading, StatusChip } from "@product/ui";
import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";
import {
  adminResourceFailure,
  readAdminResourceResponse,
  type AdminResourceReadResult,
} from "../../../../lib/admin-resource-read";
import { requireDashboardSession } from "../../../../lib/session";
import { createAdminPageContext, fetchAdminPage, type AdminPageContext } from "../../../../lib/admin-page-access";
import { dashboardPermissionMatches } from "../../../../lib/permission-policy";
import { TagLifecyclePanel } from "./tag-lifecycle-panel";

type PassportResponse = {
  ok: boolean;
  scope?: { tenant: string; source: string; range: string; country: string };
  passport?: {
    identity: { uidHex: string; bid: string; tenantSlug: string; tagStatus: string; lifecycleState?: string; lifecycleRevision?: number; readCounter: number; scanCount: number };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function selectPassport(payload: unknown): PassportResponse | null {
  if (!isRecord(payload) || payload.ok !== true || !isRecord(payload.passport)) return null;
  const passport = payload.passport;
  if (
    !isRecord(passport.identity)
    || !isRecord(passport.product)
    || !isRecord(passport.provenance)
    || !isRecord(passport.provenance.origin)
    || !isRecord(passport.provenance.firstVerified)
    || !isRecord(passport.provenance.lastVerified)
    || !isRecord(passport.tokenization)
  ) return null;
  if (payload.timeline !== undefined && !Array.isArray(payload.timeline)) return null;
  if (Array.isArray(payload.timeline) && payload.timeline.some((event) => (
    !isRecord(event) || !isRecord(event.location) || !isRecord(event.device)
  ))) return null;
  return payload as unknown as PassportResponse;
}

async function getPassport(
  context: AdminPageContext,
  uid: string,
  params: URLSearchParams,
): Promise<AdminResourceReadResult<PassportResponse>> {
  const query = params.toString() ? `?${params.toString()}` : "";
  try {
    const response = await fetchAdminPage(context, `tags/${encodeURIComponent(uid)}/passport${query}`);
    return await readAdminResourceResponse(response, selectPassport);
  } catch {
    return adminResourceFailure("unreachable");
  }
}

export default async function TagPassportPage({ params, searchParams }: { params: Promise<{ uid: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requireDashboardSession();
  const resolvedParams = await params;
  const query = await searchParams;
  const uid = decodeURIComponent(resolvedParams.uid || "").toUpperCase();
  const adminContext = await createAdminPageContext(session, query.tenant);
  const tenantScope = adminContext.tenantSlug;
  const source = adminContext.canSelectTenant ? String(query.source || "all") : "real";
  const range = String(query.range || "30d");
  const country = String(query.country || "");

  const apiParams = new URLSearchParams();
  if (tenantScope) apiParams.set("tenant", tenantScope);
  if (source !== "all") apiParams.set("source", source);
  apiParams.set("range", range);
  if (country) apiParams.set("country", country.toUpperCase());
  const retryHref = `/tags/${encodeURIComponent(uid)}?${apiParams.toString()}`;

  const passportResult = await getPassport(adminContext, uid, apiParams);
  const data = passportResult.data;
  const passport = data?.passport;
  const timeline = passportResult.availability === "ready" && data && Array.isArray(data.timeline) ? data.timeline : [];
  const suspiciousCount = timeline.filter((event) => event.result !== "ok").length;
  const uniqueCountries = new Set(timeline.map((event) => event.location.country).filter(Boolean)).size;

  return (
    <main className="space-y-6">
      <SectionHeading eyebrow="Asset passport" title={uid} description="Identidad declarada, eventos NFC, ubicación reportada y tokenización digital asociada al UID." />
      <div><Link href="/tags" className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/5">← Volver a tags</Link></div>
      <Card className="p-4">
        <div className="grid gap-3 text-xs text-slate-300 md:grid-cols-4">
          <p>Scope tenant: <b className="text-slate-100">{tenantScope || "global"}</b></p>
          <p>Source: <b className="text-slate-100">{source}</b></p>
          <p>Range: <b className="text-slate-100">{range}</b></p>
          <p>Country: <b className="text-slate-100">{country || "all"}</b></p>
        </div>
      </Card>

      {passportResult.availability === "not_found" ? (
        <EnterpriseOpsState
          variant="empty"
          title="Passport no encontrado en este scope"
          description="La API confirmó HTTP 404 para este UID y el alcance seleccionado. Revisá el UID, tenant y filtros antes de concluir que falta importarlo."
          action={<Link href="/tags" className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-100">Volver a tags</Link>}
          testId="tag-passport-not-found"
        />
      ) : passportResult.availability !== "ready" ? (
        <EnterpriseOpsState
          variant="error"
          title="No se pudo cargar el passport"
          description="La fuente administrativa no entregó un resultado confiable. No mostramos conteos, riesgo ni países como si fueran cero y este estado no significa que el UID no exista."
          checklist={[
            `Estado de lectura: ${passportResult.availability}`,
            passportResult.status ? `Respuesta upstream: HTTP ${passportResult.status}` : "La fuente no respondió",
          ]}
          action={<Link href={retryHref} className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100">Reintentar lectura</Link>}
          testId="tag-passport-source-unavailable"
        />
      ) : !passport ? null : (
        <>
          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Identity & product</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Tenant: <b>{passport.identity.tenantSlug}</b></p><p>BID: <b>{passport.identity.bid}</b></p>
              <p>UID: <b>{passport.identity.uidHex}</b></p><p>Lifecycle: <StatusChip label={passport.identity.lifecycleState || passport.identity.tagStatus} tone={(passport.identity.lifecycleState || passport.identity.tagStatus) === "active" ? "good" : "warn"} /> <span className="text-xs text-slate-400">operativo {passport.identity.tagStatus} · rev. {passport.identity.lifecycleRevision || 0}</span></p>
              <p>Producto: <b>{passport.product.productName}</b></p><p>Bodega / Región: <b>{passport.product.winery} / {passport.product.region}</b></p>
              <p>Varietal / Vintage: <b>{passport.product.varietal} / {passport.product.vintage}</b></p><p>Scans / Read counter: <b>{passport.identity.scanCount} / {passport.identity.readCounter}</b></p>
            </div>
          </Card>

          <TagLifecyclePanel
            uid={uid}
            tenantSlug={tenantScope || null}
            canWrite={session.role === "super-admin" || dashboardPermissionMatches(session.permissions, "tags:write")}
          />

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Datos declarados y eventos NFC</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Harvest year declarado: <b>{passport.provenance.origin.harvestYear || "-"}</b></p><p>Barrel months declarados: <b>{passport.provenance.origin.barrelMonths ?? "-"}</b></p>
              <p>Storage temp reportada (°C): <b>{passport.provenance.origin.temperatureStorage ?? "-"}</b></p><p>Primer evento reportado: <b>{formatDate(passport.provenance.firstVerified.at)} · {passport.provenance.firstVerified.city}, {passport.provenance.firstVerified.country}</b></p>
              <p>Último evento reportado: <b>{formatDate(passport.provenance.lastVerified.at)} · {passport.provenance.lastVerified.city}, {passport.provenance.lastVerified.country}</b></p><p>Resultado / dispositivo: <b>{passport.provenance.lastVerified.result} / {passport.provenance.lastVerified.deviceLabel}</b></p>
            </div>
            <p className="mt-3 text-xs text-slate-400">Las ubicaciones provienen del evento o dispositivo reportante; no prueban recorrido, custodia ni presencia física del producto.</p>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Tokenization</h2>
            <div className="mt-3 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
              <p>Status: <StatusChip label={passport.tokenization.status} tone={passport.tokenization.status === "minted" ? "good" : "neutral"} /></p><p>Network: <b>{passport.tokenization.network}</b></p>
              <p>Token ID: <b>{passport.tokenization.tokenId || "-"}</b></p><p className="break-all">Tx hash: <b>{passport.tokenization.txHash || "-"}</b></p>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-200">Timeline de eventos NFC</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Events in range<br /><b className="text-base text-slate-100">{timeline.length}</b></div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Risk / non-ok events<br /><b className="text-base text-amber-200">{suspiciousCount}</b></div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">Países reportados<br /><b className="text-base text-cyan-200">{uniqueCountries}</b></div>
            </div>
            {!timeline.length ? <p className="mt-3 text-sm text-slate-400">Sin eventos todavía.</p> : (
              <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full min-w-[1080px] text-left text-xs">
                  <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Resultado</th><th className="px-3 py-2">Ubicación reportada</th><th className="px-3 py-2">Dispositivo</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Reason</th></tr></thead>
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
