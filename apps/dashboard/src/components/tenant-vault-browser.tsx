import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  FileKey2,
  FileSearch,
  FolderClosed,
  FolderLock,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { Badge, Card, SectionHeading } from "@product/ui";
import type {
  TenantVaultArtifact,
  TenantVaultOrder,
  TenantVaultPayload,
  TenantVaultSubBatch,
} from "../lib/tenant-vault-contract";
import { TenantVaultDownloadControl } from "./tenant-vault-download-control";

const folderDefinitions = [
  { key: "exports", label: "exports", icon: FileKey2, description: "Packs cifrados y recibos de entrega controlada." },
  { key: "manifests", label: "manifests", icon: FileSearch, description: "Manifiestos sanitizados, hashes y conteos." },
  { key: "qa-reports", label: "qa-reports", icon: FileCheck2, description: "Recibos QA derivados de evidencia de backend." },
  { key: "proofs", label: "proofs", icon: ShieldCheck, description: "Compromisos, rotaciones y evidencia verificable." },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(Number(value || 0));
}

function formatDate(value: string | null) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Sin registro";
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function shortDigest(value: string | null) {
  if (!value) return "Sin hash publicado";
  return value.length > 28 ? `${value.slice(0, 18)}…${value.slice(-8)}` : value;
}

function stateClass(value: string) {
  const normalized = String(value || "").toLowerCase();
  if (["active", "passed", "approved", "imported", "ready"].includes(normalized)) {
    return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
  }
  if (["failed", "quarantined", "revoked", "rejected"].includes(normalized)) {
    return "border-rose-300/25 bg-rose-500/10 text-rose-100";
  }
  return "border-amber-300/25 bg-amber-500/10 text-amber-100";
}

function StatePill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${stateClass(value)}`}>{value || "unknown"}</span>;
}

function Metadata({ artifact }: { artifact: TenantVaultArtifact }) {
  const items = Object.entries(artifact.metadata).slice(0, 8);
  if (!items.length) return null;
  return (
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      {items.map(([key, value]) => (
        <div key={key} className="rounded-lg border border-white/8 bg-slate-950/50 px-3 py-2">
          <dt className="text-slate-500">{key.replaceAll("_", " ")}</dt>
          <dd className="mt-1 break-all text-slate-200">{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function ArtifactRow({ artifact, operator }: { artifact: TenantVaultArtifact; operator: boolean }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/55 p-4" data-download-available={String(artifact.download.available)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-xs font-semibold text-cyan-100">{artifact.artifact_type}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(artifact.created_at)} · {artifact.mime_type || "metadata segura"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {artifact.encrypted ? <Badge tone="green">Cifrado</Badge> : null}
          <StatePill value={artifact.status} />
        </div>
      </div>
      <p className="mt-3 break-all font-mono text-[11px] text-slate-400" title={artifact.content_hash || undefined}>
        SHA-256 · {shortDigest(artifact.content_hash)}
      </p>
      {operator && artifact.delivery ? (
        <p className="mt-2 text-xs text-slate-400">
          Entrega: <span className="font-semibold text-slate-200">{artifact.delivery.status}</span> · intentos registrados {artifact.delivery.attempt_count} · último {formatDate(artifact.delivery.last_attempt_at)}
        </p>
      ) : null}
      <Metadata artifact={artifact} />
      {operator && artifact.download.available ? <TenantVaultDownloadControl artifact={artifact} /> : <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-300/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
        <FolderLock className="h-4 w-4 shrink-0" />
        {artifact.download.reason === "tenant_key_pack_download_forbidden"
          ? "El tenant no puede descargar packs de claves."
          : artifact.download.reason === "operator_mfa_required"
            ? "La descarga privilegiada exige una sesión superadmin con MFA verificado."
          : "Este artefacto no contiene un pack cifrado recuperable."}
      </div>
      }
    </li>
  );
}

function ArtifactFolder({
  label,
  description,
  artifacts,
  operator,
  Icon,
}: {
  label: string;
  description: string;
  artifacts: TenantVaultArtifact[];
  operator: boolean;
  Icon: typeof FolderClosed;
}) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-slate-900/60" open={artifacts.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-cyan-100"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-white">/{label}</p>
            <p className="mt-1 text-xs text-slate-400">{description}</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-xs text-slate-400"><span>{artifacts.length}</span><ChevronRight className="h-4 w-4 transition group-open:rotate-90" /></span>
      </summary>
      <div className="border-t border-white/10 p-4">
        {artifacts.length ? (
          <ul className="space-y-3">{artifacts.map((artifact, index) => <ArtifactRow key={artifact.id || `${label}-${index}`} artifact={artifact} operator={operator} />)}</ul>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">Carpeta vacía. No se genera evidencia ficticia.</p>
        )}
      </div>
    </details>
  );
}

function SubBatchRow({ row, operator }: { row: TenantVaultSubBatch; operator: boolean }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-bold text-white">{row.bid}</p>
          <p className="mt-1 text-xs text-slate-500">Sub-batch #{row.sequence_index} · {formatNumber(row.expected_quantity)} tags esperados</p>
        </div>
        <StatePill value={row.status} />
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-slate-900/70 p-3"><p className="text-slate-500">Manifest</p><p className="mt-1 font-bold text-white">{row.manifest_status} · {formatNumber(row.manifest_count)}</p></div>
        <div className="rounded-xl border border-white/8 bg-slate-900/70 p-3"><p className="text-slate-500">QA</p><p className="mt-1 font-bold text-white">{row.qa_status}</p></div>
        <div className="rounded-xl border border-white/8 bg-slate-900/70 p-3"><p className="text-slate-500">Tags activos</p><p className="mt-1 font-bold text-white">{formatNumber(row.active_tag_count)}</p></div>
      </div>
      <p className="mt-3 break-all font-mono text-[11px] text-slate-500">Manifest SHA-256 · {shortDigest(row.manifest_hash)}</p>
      {operator && row.key_export ? (
        <p className="mt-2 text-xs text-slate-400">Pack de claves: {row.key_export.exported ? "entregado una vez" : "no entregado"} · contador {row.key_export.count} · {formatDate(row.key_export.exported_at)}</p>
      ) : null}
    </li>
  );
}

function OrderTree({ order, operator, defaultOpen }: { order: TenantVaultOrder; operator: boolean; defaultOpen: boolean }) {
  return (
    <details className="group overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/65" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-3 text-violet-100"><Archive className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="break-all font-mono text-xs text-violet-200">/supplier-orders/{order.folder_name}</p>
            <h3 className="mt-1 truncate text-lg font-black text-white">{order.order_name}</h3>
            <p className="mt-1 text-xs text-slate-400">{formatNumber(order.total_quantity)} tags · {order.chip_model} · {order.carrier_profile_code} · {order.pack_purpose}</p>
          </div>
        </div>
        <div className="flex items-center gap-3"><StatePill value={order.status} /><ChevronRight className="h-5 w-5 text-slate-500 transition group-open:rotate-90" /></div>
      </summary>
      <div className="space-y-5 border-t border-white/10 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/8 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Siguiente acción</p>
            <p className="mt-1 text-sm font-semibold text-white">{order.next_action.label}</p>
          </div>
          <Link href={order.next_action.href} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-500/20">Abrir orden</Link>
        </div>
        <details className="rounded-2xl border border-white/10 bg-slate-900/60" open>
          <summary className="flex cursor-pointer list-none items-center justify-between p-4">
            <div className="flex items-center gap-3"><PackageCheck className="h-4 w-4 text-emerald-200" /><div><p className="font-mono text-sm font-bold text-white">/sub-batches</p><p className="mt-1 text-xs text-slate-400">Alcances físicos separados por BID.</p></div></div>
            <span className="text-xs text-slate-400">{order.sub_batches.length}</span>
          </summary>
          <div className="border-t border-white/10 p-4">
            {order.sub_batches.length ? <ul className="space-y-3">{order.sub_batches.map((row) => <SubBatchRow key={row.id} row={row} operator={operator} />)}</ul> : <p className="text-xs text-slate-500">Sin sub-batches registrados.</p>}
          </div>
        </details>
        <div className="grid gap-4 xl:grid-cols-2">
          {folderDefinitions.map(({ key, label, description, icon }) => (
            <ArtifactFolder key={key} label={label} description={description} artifacts={order.folders[key]} operator={operator} Icon={icon} />
          ))}
        </div>
      </div>
    </details>
  );
}

export function TenantVaultBrowser({ vault }: { vault: TenantVaultPayload }) {
  const operator = vault.viewer.mode === "operator";
  const metrics = [
    ["Órdenes", vault.summary.orders],
    ["Sub-batches", vault.summary.sub_batches],
    ["Tags planificados", vault.summary.planned_tags],
    ["Tags manifestados", vault.summary.manifested_tags],
    ["QA aprobados", vault.summary.qa_passed_sub_batches],
    ["Tags activos", vault.summary.active_tags],
  ] as const;

  return (
    <main className="space-y-8" data-testid="tenant-vault" data-viewer={vault.viewer.mode}>
      <SectionHeading
        eyebrow="Tenant Vault · evidencia operativa"
        title={vault.tenant.name || vault.tenant.slug}
        description="Bóveda de metadata, hashes y estados de producción. No es un gestor de secretos y nunca muestra claves NFC en claro."
      />

      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_90%_0%,rgba(34,211,238,.15),transparent_35%),linear-gradient(135deg,rgba(15,23,42,.98),rgba(2,8,23,.98))] p-5 shadow-[0_26px_80px_rgba(2,6,23,.4)] md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs text-cyan-200">/{vault.tenant.slug}/supplier-orders</p>
            <h2 className="mt-2 text-2xl font-black text-white">Custodia separada por tenant y orden</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">La vista expone estados operativos y compromisos SHA-256. Los packs de fábrica permanecen restringidos a nexID Operations.</p>
          </div>
          <Badge tone={operator ? "amber" : "green"}>{operator ? "SUPERADMIN · METADATA" : "TENANT · SAFE STATUS"}</Badge>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{formatNumber(value)}</p></div>)}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-200" /><div><h2 className="font-bold text-white">Límite de custodia verificado</h2><p className="mt-2 text-sm leading-6 text-slate-300">Cifrado de sobre a nivel aplicación. <strong>No es KMS gestionado ni HSM.</strong> La API declara managed_kms=false y hsm_backed=false.</p></div></div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3"><FolderLock className="mt-0.5 h-5 w-5 text-amber-200" /><div><h2 className="font-bold text-white">Entrega privilegiada y auditada</h2><p className="mt-2 text-sm leading-6 text-slate-300">Sólo nexID Operations puede recuperar el sobre cifrado. Cada solicitud exige motivo, idempotencia, control de integridad y un recibo atómico; el tenant nunca recibe packs de claves.</p></div></div>
        </Card>
      </div>

      {(vault.pagination.orders_truncated || vault.pagination.artifacts_truncated) ? (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-sm text-amber-50"><CircleAlert className="h-5 w-5 shrink-0" />La vista está acotada a las órdenes y artefactos más recientes. No se interpreta el recorte como ausencia de evidencia.</div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">Folder browser</p><h2 className="mt-2 text-xl font-black text-white">Órdenes y evidencia</h2></div><span className="text-xs text-slate-500">Actualizado {formatDate(vault.generated_at)}</span></div>
        {vault.orders.length ? vault.orders.map((order, index) => <OrderTree key={order.id} order={order} operator={operator} defaultOpen={index === 0} />) : (
          <Card className="p-8 text-center"><FolderClosed className="mx-auto h-8 w-8 text-slate-500" /><h3 className="mt-4 font-bold text-white">Sin órdenes de proveedor</h3><p className="mt-2 text-sm text-slate-400">La bóveda está vacía y no genera registros simulados.</p></Card>
        )}
      </section>

      {operator ? (
        <section className="space-y-4" data-testid="tenant-vault-export-audit">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Superadmin only</p><h2 className="mt-2 text-xl font-black text-white">Auditoría de supplier operations</h2></div>
          <Card className="overflow-hidden p-0">
            {vault.export_audit?.length ? (
              <div className="overflow-x-auto"><table className="min-w-full text-left text-xs"><thead className="border-b border-white/10 bg-slate-950/70 text-slate-400"><tr><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Recurso</th><th className="px-4 py-3">Receipt hash</th><th className="px-4 py-3">Fecha</th></tr></thead><tbody>{vault.export_audit.map((row) => <tr key={row.id} className="border-b border-white/5"><td className="px-4 py-3 font-semibold text-white">{row.action}</td><td className="px-4 py-3 text-slate-300">{row.actor_email || row.actor_name || "Actor no proyectado"}</td><td className="px-4 py-3 font-mono text-slate-400">{row.resource_type}/{row.resource_id || "—"}</td><td className="px-4 py-3 font-mono text-slate-400" title={row.after_hash || undefined}>{shortDigest(row.after_hash)}</td><td className="px-4 py-3 text-slate-400">{formatDate(row.created_at)}</td></tr>)}</tbody></table></div>
            ) : <div className="flex items-center gap-3 p-5 text-sm text-slate-400"><CheckCircle2 className="h-5 w-5 text-slate-500" />No hay eventos supplier auditables en el alcance consultado.</div>}
          </Card>
        </section>
      ) : null}
    </main>
  );
}
