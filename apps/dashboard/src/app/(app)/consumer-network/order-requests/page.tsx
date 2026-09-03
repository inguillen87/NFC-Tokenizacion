import { SectionHeading } from "@product/ui";
import { DataTable } from "../../../../components/data-table";
import { EnterpriseOpsState } from "../../../../components/enterprise-ops-state";
import {
  createAdminPageContext,
  fetchAdminPage,
  type AdminPageContext,
} from "../../../../lib/admin-page-access";
import { readDemoDataMetaFromResponse } from "../../../../lib/demo-data-mode";
import { dashboardHighImpactPermissionMatches } from "../../../../lib/permission-policy";
import { requireDashboardSession } from "../../../../lib/session";

type OrderRequest = Record<string, unknown>;
type OrderRequestsAvailability = "ready" | "upstream_error" | "invalid_payload" | "unreachable";
type OrderRequestsResult = {
  availability: OrderRequestsAvailability;
  items: OrderRequest[];
  source: "production" | "demo" | "unavailable";
  reason: string;
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Solicitado",
  new: "Nuevo",
  pending: "Pendiente",
  open: "Abierto",
  contacted: "Contactado",
  qualified: "Calificado",
  completed: "Completado",
  cancelled: "Cancelado",
};

function unavailableResult(availability: Exclude<OrderRequestsAvailability, "ready">, reason: string): OrderRequestsResult {
  return { availability, items: [], source: "unavailable", reason };
}

function normalizedTenant(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function getOrderRequests(context: AdminPageContext, allowDemoData: boolean): Promise<OrderRequestsResult> {
  try {
    const response = await fetchAdminPage(context, "consumer-portal/order-requests");
    const meta = readDemoDataMetaFromResponse(response);
    const payload = await response.json().catch(() => null);
    if (!response.ok || (payload && typeof payload === "object" && (payload as { ok?: boolean }).ok === false)) {
      const reason = payload && typeof payload === "object"
        ? String((payload as { reason?: unknown; error?: unknown }).reason || (payload as { error?: unknown }).error || `upstream_${response.status}`)
        : `upstream_${response.status}`;
      return unavailableResult("upstream_error", reason);
    }
    if (!payload || typeof payload !== "object" || !Array.isArray((payload as { items?: unknown }).items)) {
      return unavailableResult("invalid_payload", "order_requests_payload_invalid");
    }
    if (meta.demoMode && !allowDemoData) {
      return unavailableResult("invalid_payload", "demo_data_not_authorized");
    }

    const items = (payload as { items: OrderRequest[] }).items;
    if (context.tenantSlug && normalizedTenant((payload as { tenant?: unknown }).tenant) !== context.tenantSlug) {
      return unavailableResult("invalid_payload", "tenant_scope_mismatch");
    }
    if (context.tenantSlug && items.some((item) => normalizedTenant(item.tenant_slug) !== context.tenantSlug)) {
      return unavailableResult("invalid_payload", "tenant_scope_mismatch");
    }
    return {
      availability: "ready",
      items,
      source: meta.demoMode ? "demo" : "production",
      reason: "",
    };
  } catch {
    return unavailableResult("unreachable", "admin_bff_unreachable");
  }
}

function formatDate(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? "No informada" : date.toISOString();
}

function contactFor(item: OrderRequest) {
  const values = [item.email, item.phone].map((value) => String(value || "").trim()).filter(Boolean);
  return values.join(" · ") || "Contacto no informado";
}

function exportUnavailable(reasonId: string, reason: string) {
  return (
    <button
      type="button"
      disabled
      aria-describedby={reasonId}
      title={reason}
      className="cursor-not-allowed rounded-lg border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-500 opacity-70"
    >
      Exportar CSV
    </button>
  );
}

export default async function OrderRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireDashboardSession();
  const canReadConsumerPii = dashboardHighImpactPermissionMatches(
    session.role,
    session.permissions,
    "consumers.read_pii",
    session.deniedPermissions,
  );

  if (!canReadConsumerPii) {
    return (
      <main className="space-y-6" data-order-requests-availability="access_denied" data-order-requests-source="unavailable">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeading
            eyebrow="Marketplace"
            title="Solicitudes de pedido"
            description="Pedidos iniciados por consumidores, protegidos por tenant y capacidad de lectura de PII."
          />
          {exportUnavailable("order-requests-access-reason", "Requiere la capacidad consumers.read_pii")}
        </div>
        <EnterpriseOpsState
          variant="warning"
          title="Acceso restringido a solicitudes con PII"
          description="Esta sesión no tiene la capacidad consumers.read_pii. El servidor no consultó nombres, emails, teléfonos ni mensajes de compra."
          checklist={[
            "Solicitá acceso al administrador del tenant.",
            "La exportación permanece deshabilitada mientras el acceso esté denegado.",
          ]}
          testId="order-requests-access-denied"
        />
        <p id="order-requests-access-reason" className="sr-only">La exportación requiere la capacidad consumers.read_pii.</p>
      </main>
    );
  }

  const query = searchParams ? await searchParams : {};
  const adminContext = await createAdminPageContext(session, query.tenant);
  const result = await getOrderRequests(adminContext, Boolean(session.isDemo));
  const sourceReady = result.availability === "ready";
  const rows = result.items.map((item) => ({
    status: normalizedTenant(item.status) || "requested",
    product: `${String(item.product_title || "Producto no informado")}\nCantidad: ${Number(item.quantity || 1)}`,
    consumer: contactFor(item),
    message: String(item.consumer_message || "Sin mensaje del consumidor"),
    tenant: normalizedTenant(item.tenant_slug) || "No informado",
    createdAt: formatDate(item.created_at),
  }));
  const retryParams = new URLSearchParams();
  if (adminContext.tenantSlug) retryParams.set("tenant", adminContext.tenantSlug);
  const retryHref = `/consumer-network/order-requests${retryParams.size ? `?${retryParams.toString()}` : ""}`;

  return (
    <main
      className="space-y-6"
      data-order-requests-availability={result.availability}
      data-order-requests-source={result.source}
      data-tenant-scope={adminContext.tenantSlug || "global-authorized"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          eyebrow="Marketplace"
          title="Solicitudes de pedido"
          description="Solicitudes confirmadas por la API operativa del marketplace, dentro del scope autorizado de la sesión."
        />
        {sourceReady ? (
          <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-200">
            CSV disponible en la tabla
          </span>
        ) : exportUnavailable("order-requests-source-reason", "La fuente de pedidos no está disponible")}
      </div>

      <section className="rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-xs text-slate-300" data-testid="order-requests-source">
        Fuente: <b className={result.source === "production" ? "text-emerald-200" : result.source === "demo" ? "text-amber-200" : "text-slate-200"}>{result.source}</b>
        {` · scope ${adminContext.tenantSlug ? `tenant:${adminContext.tenantSlug}` : "global autorizado"}`}
        {result.source === "demo" ? " · DEMO DATA; no representa pedidos productivos." : null}
      </section>

      {!sourceReady ? (
        <>
          <EnterpriseOpsState
            variant="warning"
            title="Solicitudes de pedido no disponibles"
            description="El backend no pudo confirmar la colección. No se muestran fixtures, personas inventadas ni una tabla vacía como si fueran cero pedidos."
            checklist={[
              `Estado: ${result.availability}`,
              `Motivo: ${result.reason}`,
              "Exportación CSV deshabilitada hasta recibir una respuesta válida.",
            ]}
            action={(
              <a href={retryHref} className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200">
                Reintentar fuente
              </a>
            )}
            testId="order-requests-source-unavailable"
          />
          <p id="order-requests-source-reason" className="sr-only">La fuente no respondió con pedidos válidos; la exportación está deshabilitada.</p>
        </>
      ) : (
        <>
          {!rows.length ? (
            <EnterpriseOpsState
              variant="empty"
              title="Sin solicitudes en el scope actual"
              description="La API respondió correctamente y confirmó una colección vacía para este tenant."
              testId="order-requests-confirmed-empty"
            />
          ) : null}
          <div id="order-requests-table">
            <DataTable
              title="Solicitudes de pedido"
              columns={[
                { key: "status", label: "Pipeline" },
                { key: "product", label: "Producto" },
                { key: "consumer", label: "Contacto" },
                { key: "message", label: "Mensaje" },
                { key: "tenant", label: "Tenant" },
                { key: "createdAt", label: "Fecha (ISO)" },
              ]}
              rows={rows}
              filterKey="status"
              statusMap={STATUS_LABELS}
              loadingLabel="Actualizando solicitudes"
              emptyLabel="La fuente confirmó que no hay solicitudes para el scope actual."
              searchPlaceholder="Buscar solicitud"
              allFilterLabel="Todos los estados"
              refreshLabel="Actualizar"
            />
          </div>
        </>
      )}
    </main>
  );
}
