"use client";

import React, { useEffect, useRef, useState } from "react";
import { Badge, Card, StatusChip } from "@product/ui";
import RewardReservationNotice from "../../../../components/reward-reservation-notice";
import { REWARD_REQUIREMENTS_VERSION, rewardProgramConfigurationLink } from "../../../../lib/reward-reservation-notices";
import {
  Plus,
  Edit2,
  Image as ImageIcon,
  Trophy,
  Layers,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  X,
  Sparkles
} from "lucide-react";

interface Reward {
  id?: string;
  program_id?: string;
  tenant_slug?: string;
  code: string;
  title: string;
  points: number | null;
  status: string;
  description?: string | null;
  type?: string | null;
  image_url?: string | null;
  stock_total?: number | null;
  stock_remaining?: number | null;
  requires_age_gate?: boolean;
  network_visible?: boolean;
  reservation_requirements?: unknown;
}

type RewardForm = { code: string; title: string; description: string; type: string; points_cost: number; stock_total: number | null; image_url: string; status: string; requires_age_gate: boolean; network_visible: boolean };
const isStockCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647;

export function rewardStockLabel(remaining: unknown, total: unknown): string {
  if (remaining === null && total === null) return "Sin límite de stock registrado";
  if ((remaining != null && !isStockCount(remaining)) || (total != null && !isStockCount(total))) {
    return "Stock inconsistente";
  }
  if (remaining == null) {
    return total == null ? "Stock no informado" : `Stock: ${total} en total · disponibilidad sin confirmar`;
  }
  if (total == null) return `Disponibles: ${remaining} · total sin informar`;
  if (remaining > total) return "Stock inconsistente";
  return `Disponibles: ${remaining} de ${total}`;
}

export function buildRewardSavePayload(tenant: string, form: RewardForm, editing: Reward | null) {
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  const scope = (editing?.tenant_slug || tenant).trim().toLowerCase();
  if (!scope) throw new Error("tenant_required");
  if (!Number.isSafeInteger(form.points_cost) || form.points_cost < 0 || form.points_cost > 2_147_483_647) throw new Error("invalid_points_cost");
  if (form.stock_total !== null && (!Number.isSafeInteger(form.stock_total) || form.stock_total < 0 || form.stock_total > 2_147_483_647)) throw new Error("invalid_stock_total");
  if (editing && (!uuid.test(editing.id || "") || !uuid.test(editing.program_id || "")
    || typeof editing.requires_age_gate !== "boolean" || typeof editing.network_visible !== "boolean")) throw new Error("reward_configuration_unavailable");
  if (!editing && form.stock_total === null) throw new Error("invalid_stock_total");
  const { stock_total, description, ...metadata } = form;
  return {
    tenant_slug: scope, ...metadata,
    ...(editing?.description === null && description === "" ? {} : { description }),
    ...(editing ? { reward_id: editing.id, program_id: editing.program_id } : { creationIntent: "admin-reward-first-create.v1" }),
    ...(!editing || stock_total !== (editing.stock_total ?? null) ? { stock_total } : {}),
    ...(!editing ? { stock_remaining: stock_total } : {}),
  };
}

export function rewardSaveErrorCopy(code: unknown): string {
  const messages: Record<string, string> = {
    tenant_required: "Seleccioná la empresa antes de guardar. Tu formulario sigue aquí.",
    invalid_points_cost: "El costo debe ser un número entero desde cero. Revisalo; tu formulario sigue aquí.",
    invalid_stock_total: "El stock total debe ser un número entero desde cero. Revisalo; tu formulario sigue aquí.",
    invalid_stock_remaining: "No pudo validarse el stock. Volvé a consultar el beneficio antes de guardar.",
    stock_total_below_consumed: "El total no puede ser menor que las unidades ya consumidas. Puede haber nuevos canjes; revisá el stock y conservá tu formulario.",
    reward_stock_unavailable: "No pudo confirmarse el stock guardado. Volvé a consultar; tu formulario sigue aquí.",
    reward_configuration_unavailable: "Falta la configuración guardada del beneficio. Volvé a consultar antes de editar; tu formulario sigue aquí.",
    reward_program_ambiguous: "Este código existe en más de un programa. Volvé a consultar y elegí el beneficio exacto.",
    loyalty_program_not_found: "La empresa necesita un programa de beneficios configurado. Contactá al administrador; tu formulario sigue aquí.",
    reward_not_found: "El beneficio ya no está disponible en este programa. Volvé a consultar; tu formulario sigue aquí.",
    reward_update_conflict: "El beneficio cambió mientras guardabas. Volvé a consultar; tu formulario sigue aquí.",
    reward_creation_unavailable: "La creación segura no está disponible en esta versión. Tu formulario sigue aquí; consultá el catálogo y volvé a intentar cuando el servicio esté actualizado.",
    reward_create_conflict: "Este código ya pertenece a un beneficio. Elegí otro código o abrí el beneficio existente para editarlo. Tu formulario sigue aquí.",
    invalid_reward_creation_intent: "No pudo confirmarse si estabas creando o editando. Tu formulario sigue aquí; volvé a consultar el catálogo antes de continuar.",
  };
  return typeof code === "string" && messages[code] ? messages[code] : "No se pudo confirmar el guardado. Tu formulario sigue aquí; revisá los datos y reintentá la consulta.";
}

interface RewardsClientProps {
  initialRewards: Reward[];
  tenantScope: string;
  isDemo: boolean;
  canWrite: boolean;
  dataSource: "production" | "demo" | "unavailable";
  availability: "ready" | "ready_empty" | "forbidden" | "upstream_error";
  sourceReason: string;
}

type RewardDialogSource = Pick<RewardsClientProps, "initialRewards" | "tenantScope" | "canWrite" | "isDemo" | "dataSource" | "availability">;
type RewardDialogOwner = { id: number; source: RewardDialogSource; phase: "idle" | "pending" | "confirmed" | "uncertain"; action: number; scope: string; retired: boolean; controller: AbortController | null; timer: ReturnType<typeof setTimeout> | null; stop: (() => void) | null };
type RewardDialogResult = { kind: "confirmed" } | { kind: "refused"; error: unknown } | { kind: "uncertain" };
const REWARD_SAVE_DEADLINE_MS = 6000;
function parseRewardCatalogReview(value: unknown, tenant: string): Reward[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (body.ok !== true || body.tenant !== tenant || body.scope !== "tenant" || (body.demoMode !== undefined && body.demoMode !== false) || (body.dataSource !== undefined && body.dataSource !== "production") || !Array.isArray(body.rewards)) return null;
  const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
  const number = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v <= 2_147_483_647;
  const ids = new Set<string>();
  for (const raw of body.rewards) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    if (typeof row.id !== "string" || !uuid.test(row.id) || ids.has(row.id) || typeof row.program_id !== "string" || !uuid.test(row.program_id)
      || row.tenant_slug !== tenant || typeof row.code !== "string" || !row.code.trim() || row.code.length > 100
      || typeof row.title !== "string" || !row.title.trim() || row.title.length > 300 || !number(row.points)
      || !["active", "paused", "draft", "archived"].includes(String(row.status))
      || typeof row.requires_age_gate !== "boolean" || typeof row.network_visible !== "boolean"
      || !(row.stock_total === null || number(row.stock_total)) || !(row.stock_remaining === null || number(row.stock_remaining))
      || (typeof row.stock_total === "number" && typeof row.stock_remaining === "number" && row.stock_remaining > row.stock_total)
      || !(row.image_url === null || row.image_url === undefined || typeof row.image_url === "string" && row.image_url.length <= 2048)
      || !(row.description === null || row.description === undefined || typeof row.description === "string" && row.description.length <= 4000)
      || !(row.type === null || row.type === undefined || typeof row.type === "string" && row.type.length <= 100)) return null;
    ids.add(row.id);
  }
  return body.rewards as Reward[];
}

const sameRewardDialogSource = (a: RewardDialogSource, b: RewardDialogSource) => a.initialRewards === b.initialRewards && a.tenantScope === b.tenantScope && a.canWrite === b.canWrite && a.isDemo === b.isDemo && a.dataSource === b.dataSource && a.availability === b.availability;

const REWARD_IMAGE_OPTIONS = [
  { label: "Degustación en bodega", value: "/images/wine_tasting.png" },
  { label: "Caja de seis botellas", value: "/images/wine_crate.png" },
  { label: "Botella magnum (1,5 L)", value: "/images/premium_magnum.png" },
  { label: "Sin imagen", value: "" },
];

const REWARD_TYPES = [
  { value: "WINE_BOX", label: "Caja de Vinos 📦" },
  { value: "WINE_BOTTLE", label: "Botella de Vino 🍷" },
  { value: "TASTING", label: "Degustación 🎟️" },
  { value: "TOUR", label: "Tour de Bodega 🗺️" },
  { value: "EXPERIENCE", label: "Experiencia VIP ✨" },
  { value: "DISCOUNT", label: "Descuento 🏷️" },
  { value: "FREE_SHIPPING", label: "Envío Gratis 🚚" },
  { value: "EARLY_ACCESS", label: "Acceso Anticipado ⏳" },
  { value: "VIP_ACCESS", label: "Acceso VIP 👑" },
  { value: "DIGITAL_COLLECTIBLE", label: "Coleccionable Digital (NFT) 🌐" },
  { value: "GIFT", label: "Regalo de la Casa 🎁" },
  { value: "CONTENT_UNLOCK", label: "Contenido exclusivo" },
  { value: "SERVICE", label: "Servicio" },
  { value: "WARRANTY_EXTENSION", label: "Extensión de garantía" },
  { value: "REFILL", label: "Recarga" },
];
const REWARD_STATUSES = {
  active: "Activo",
  paused: "Pausado",
  draft: "Borrador",
  archived: "Archivado",
} as const;

type EditableReward = Reward & {
  points: number;
  type: string;
  description: string | null;
  image_url: string | null;
  stock_total: number | null;
  requires_age_gate: boolean;
  network_visible: boolean;
};

const rewardUuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const hasControl = /[\u0000-\u001f\u007f]/;
const hasDescriptionControl = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function canEditReward(reward: Reward, tenant: string): reward is EditableReward {
  const requirements = reward.reservation_requirements as { version?: unknown; program?: { association_confirmed?: unknown } } | null | undefined;
  const stock = (reward.stock_total === null && reward.stock_remaining === null)
    || (isStockCount(reward.stock_total) && isStockCount(reward.stock_remaining) && reward.stock_remaining <= reward.stock_total);
  return Boolean(tenant && reward.tenant_slug === tenant && rewardUuid.test(reward.id ?? "") && rewardUuid.test(reward.program_id ?? "")
    && requirements?.version === REWARD_REQUIREMENTS_VERSION && requirements.program?.association_confirmed === true
    && reward.code.length > 0 && reward.code.length <= 100 && !hasControl.test(reward.code) && reward.code.trim().toUpperCase() === reward.code
    && reward.title.length > 0 && reward.title.length <= 300 && !hasControl.test(reward.title) && reward.title.trim() === reward.title
    && isStockCount(reward.points) && stock && typeof reward.status === "string" && Object.hasOwn(REWARD_STATUSES, reward.status)
    && REWARD_TYPES.some(({ value }) => value === reward.type)
    && typeof reward.requires_age_gate === "boolean" && typeof reward.network_visible === "boolean"
    && (reward.description === null || (typeof reward.description === "string" && reward.description.length <= 4000
      && reward.description.trim() === reward.description && !hasDescriptionControl.test(reward.description)))
    && (reward.image_url === null || (typeof reward.image_url === "string" && reward.image_url.length <= 2048
      && reward.image_url.trim() === reward.image_url && !hasControl.test(reward.image_url))));
}

export default function RewardsClient({
  initialRewards: serverRewards,
  tenantScope,
  isDemo,
  canWrite,
  dataSource: serverDataSource,
  availability: serverAvailability,
  sourceReason: serverSourceReason,
}: RewardsClientProps) {
  const serverSource: RewardDialogSource = { initialRewards: serverRewards, tenantScope, canWrite, isDemo, dataSource: serverDataSource, availability: serverAvailability };
  const [catalogSnapshot, setCatalogSnapshot] = useState<{ base: RewardDialogSource; rewards: Reward[]; held: boolean } | null>(null);
  const freshCatalog = catalogSnapshot && sameRewardDialogSource(catalogSnapshot.base, serverSource) ? catalogSnapshot : null;
  const initialRewards = freshCatalog?.rewards ?? serverRewards;
  const dataSource = freshCatalog ? "production" as const : serverDataSource;
  const availability = freshCatalog ? initialRewards.length ? "ready" as const : "ready_empty" as const : serverAvailability;
  const sourceReason = freshCatalog ? "" : serverSourceReason;
  const source: RewardDialogSource = freshCatalog?.held ? serverSource : { initialRewards, tenantScope, canWrite, isDemo, dataSource, availability };
  const latestSource = useRef(source); latestSource.current = source;
  const mounted = useRef(false);
  const ownerSequence = useRef(0);
  const owner = useRef<RewardDialogOwner | null>(null);
  const catalogReader = useRef<RewardDialogOwner | null>(null);
  const [catalogReading, setCatalogReading] = useState(false);
  const [readMessage, setReadMessage] = useState<{ source: RewardDialogSource; text: string } | null>(null);
  const reviewScopes = useRef(new Set<string>());
  const [reviewRequired, setReviewRequired] = useState<string[]>([]);
  const [catalogNotice, setCatalogNotice] = useState<{ source: RewardDialogSource; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  
  // Form State
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("WINE_BOX");
  const [pointsCost, setPointsCost] = useState(500);
  const [stockTotal, setStockTotal] = useState<number | null>(100);
  const [imageUrl, setImageUrl] = useState("/images/wine_tasting.png");
  const [status, setStatus] = useState("active");
  const [requiresAgeGate, setRequiresAgeGate] = useState(false);
  const [networkVisible, setNetworkVisible] = useState(true);
  const [customTenant, setCustomTenant] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const currentOwner = owner.current && !owner.current.retired && sameRewardDialogSource(owner.current.source, source) ? owner.current : null;
  const effectiveScope = (tenantScope || customTenant).trim().toLowerCase();
  const reviewBlocked = reviewRequired.includes(effectiveScope);
  const readingCurrentCatalog = Boolean(catalogReading && catalogReader.current && sameRewardDialogSource(catalogReader.current.source, source));
  const currentReadMessage = readMessage && sameRewardDialogSource(readMessage.source, source) ? readMessage.text : null;
  const saveBlocked = loading || currentOwner?.phase === "pending" || reviewBlocked || currentOwner?.phase === "confirmed" || currentOwner?.phase === "uncertain";
  const activeCatalogNotice = catalogNotice && sameRewardDialogSource(catalogNotice.source, source) ? catalogNotice.text : null;
  const programConfigurationHref = availability === "ready" && !isDemo
    ? rewardProgramConfigurationLink(editingReward, { tenantScope, dataSource }) : null;
  function owns(candidate: RewardDialogOwner | null, action?: number): candidate is RewardDialogOwner {
    return Boolean(candidate && mounted.current && !candidate.retired && owner.current === candidate
      && sameRewardDialogSource(candidate.source, latestSource.current) && (action === undefined || candidate.action === action));
  }
  function retire(candidate: RewardDialogOwner | null) {
    if (!candidate || candidate.retired) return;
    candidate.retired = true; candidate.action += 1;
    if (candidate.timer !== null) clearTimeout(candidate.timer);
    candidate.timer = null; candidate.stop?.(); candidate.stop = null;
    candidate.controller?.abort(); candidate.controller = null;
    if (owner.current === candidate) owner.current = null;
    if (catalogReader.current === candidate) catalogReader.current = null;
  }
  function requireReview(candidate: RewardDialogOwner) {
    candidate.phase = "uncertain";
    if (candidate.scope) { reviewScopes.current.add(candidate.scope); setReviewRequired([...reviewScopes.current]); }
  }
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; retire(owner.current); retire(catalogReader.current); };
  }, []);
  useEffect(() => {
    const read = catalogReader.current;
    if (read && !sameRewardDialogSource(read.source, latestSource.current)) { retire(read); setCatalogReading(false); }
    const previous = owner.current;
    if (previous && !sameRewardDialogSource(previous.source, latestSource.current)) {
      if (previous.phase === "pending" || previous.phase === "uncertain") requireReview(previous);
      retire(previous); setIsModalOpen(false); setLoading(false); setMessage(null);
    }
  }, [initialRewards, tenantScope, canWrite, isDemo, dataSource, availability]);
  useEffect(() => {
    if (isModalOpen && owns(currentOwner) && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [isModalOpen, currentOwner]);
  useEffect(() => { if (message && owns(currentOwner)) feedbackRef.current?.focus(); }, [message, currentOwner]);
  const closeOwner = (candidate: RewardDialogOwner | null, native = false) => {
    if (!owns(candidate)) return;
    if (candidate.phase === "pending" || candidate.phase === "uncertain") requireReview(candidate);
    if (candidate.phase === "confirmed") setCatalogNotice({ source: candidate.source, text: "Cambios guardados. Consultá el catálogo para ver su estado actualizado." });
    retire(candidate); if (!native) dialogRef.current?.close(); setIsModalOpen(false); setLoading(false);
  };
  const closeModal = () => closeOwner(currentOwner);
  const containModalFocus = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const targets = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), summary, a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])")];
    const first = targets[0], last = targets[targets.length - 1];
    const active = document.activeElement;
    if (event.shiftKey ? active === first || !targets.includes(active as HTMLElement) : active === last || !targets.includes(active as HTMLElement)) {
      event.preventDefault(); (event.shiftKey ? last : first)?.focus();
    }
  };
  const beginDialog = () => {
    if (!mounted.current || !canWrite || !tenantScope.trim() || !sameRewardDialogSource(source, latestSource.current)
      || owner.current?.phase === "pending" || (catalogReader.current && sameRewardDialogSource(catalogReader.current.source, source)) || reviewScopes.current.has(effectiveScope)) return false;
    retire(owner.current);
    owner.current = { id: ++ownerSequence.current, source, phase: "idle", action: 0, scope: effectiveScope, retired: false, controller: null, timer: null, stop: null };
    setLoading(false); setMessage(null); setIsModalOpen(true); return true;
  };
  const openCreateModal = () => {
    if (!beginDialog()) return;
    setEditingReward(null); setCode(""); setTitle(""); setDescription(""); setType("WINE_BOX"); setPointsCost(500);
    setStockTotal(100); setImageUrl("/images/wine_tasting.png"); setStatus("active"); setRequiresAgeGate(false); setNetworkVisible(true);
  };
  const openEditModal = (reward: Reward) => {
    if (isDemo || dataSource !== "production" || !canEditReward(reward, tenantScope) || !beginDialog()) return;
    setEditingReward(reward); setCode(reward.code); setTitle(reward.title); setDescription(reward.description ?? "");
    setType(reward.type); setPointsCost(reward.points); setStockTotal(reward.stock_total); setImageUrl(reward.image_url ?? "");
    setStatus(reward.status); setRequiresAgeGate(reward.requires_age_gate); setNetworkVisible(reward.network_visible);
  };
  const consultCatalog = async () => {
    if (!mounted.current || !tenantScope.trim() || !sameRewardDialogSource(source, latestSource.current) || isDemo || !effectiveScope || owner.current !== currentOwner
      || (catalogReader.current && sameRewardDialogSource(catalogReader.current.source, source))) return;
    // A completed/uncertain writer cannot be replayed while this separate read runs.
    const previous = owner.current;
    if (previous && owns(previous)) {
      if (previous.phase === "pending" || previous.phase === "idle") return;
      previous.action += 1; previous.stop?.(); previous.stop = null; previous.controller?.abort(); previous.controller = null;
      if (previous.timer !== null) clearTimeout(previous.timer); previous.timer = null;
    }
    retire(catalogReader.current);
    const candidate: RewardDialogOwner = { id: ++ownerSequence.current, source, phase: "pending", action: 1, scope: effectiveScope, retired: false, controller: new AbortController(), timer: null, stop: null };
    catalogReader.current = candidate; setCatalogReading(true); setReadMessage(null);
    const controller = candidate.controller!;
    const current = () => mounted.current && catalogReader.current === candidate && !candidate.retired
      && sameRewardDialogSource(candidate.source, latestSource.current);
    const deadline = new Promise<Reward[] | null>(resolve => {
      candidate.stop = () => resolve(null);
      candidate.timer = setTimeout(() => { controller.abort(); resolve(null); }, REWARD_SAVE_DEADLINE_MS);
    });
    const request = (async (): Promise<Reward[] | null> => {
      try {
        const response = await fetch("/api/admin/loyalty/rewards?" + new URLSearchParams({ tenant: effectiveScope }), {
          method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) { void response.body?.cancel().catch(() => {}); return null; }
        const mode = String(response.headers.get("x-nexid-data-mode") || "").trim().toLowerCase();
        if (mode !== "production") { void response.body?.cancel().catch(() => {}); return null; }
        return parseRewardCatalogReview(await response.json(), effectiveScope);
      } catch { return null; }
    })();
    const rows = await Promise.race([request, deadline]);
    if (!current()) return;
    retire(candidate); setCatalogReading(false);
    if (rows === null) {
      setReadMessage({ source, text: reviewScopes.current.has(effectiveScope)
        ? "No pudimos consultar el catálogo. Conservamos el formulario y el resultado sigue sin confirmar; podés reintentar la consulta."
        : "No pudimos consultar el catálogo. El guardado confirmado no se vuelve a enviar; podés reintentar la consulta." });
      return;
    }
    // A catalogue read cannot settle an earlier uncertain server write.
    const held = reviewScopes.current.has(effectiveScope);
    setCatalogSnapshot({ base: serverSource, rewards: rows, held });
    if (held) {
      setReadMessage({ source, text: "Catálogo consultado. Esta consulta no confirma el guardado anterior; la edición sigue en pausa. Conservamos tu formulario y podés volver a consultar." });
      return;
    }
    // Only an already-confirmed writer can leave its form after this separate read.
    retire(owner.current); setIsModalOpen(false); setLoading(false); setMessage(null);
    setCatalogNotice({ source: { ...source, initialRewards: rows, dataSource: "production", availability: rows.length ? "ready" : "ready_empty" },
      text: "Catálogo consultado. Revisá la versión guardada antes de iniciar otra operación." });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); const candidate = currentOwner;
    if (!owns(candidate) || !latestSource.current.canWrite || !latestSource.current.tenantScope.trim() || candidate.phase !== "idle" || catalogReader.current) return;
    if (editingReward && (latestSource.current.isDemo || latestSource.current.dataSource !== "production" || !canEditReward(editingReward, latestSource.current.tenantScope))) return;
    let payload: ReturnType<typeof buildRewardSavePayload>;
    try {
      payload = buildRewardSavePayload(tenantScope || customTenant, { code, title, description, type, points_cost: pointsCost, stock_total: stockTotal,
        image_url: imageUrl, status, requires_age_gate: requiresAgeGate, network_visible: networkVisible }, editingReward);
    } catch (error) { setMessage({ type: "error", text: rewardSaveErrorCopy(error instanceof Error ? error.message : null) }); return; }
    if (reviewScopes.current.has(payload.tenant_slug)) return;
    candidate.scope = payload.tenant_slug; candidate.phase = "pending"; const action = ++candidate.action;
    const controller = new AbortController(); candidate.controller = controller;
    setLoading(true); setMessage(null);
    const creating = editingReward === null;
    const deadline = new Promise<RewardDialogResult>(resolve => {
      candidate.stop = () => resolve({ kind: "uncertain" });
      candidate.timer = setTimeout(() => { controller.abort(); resolve({ kind: "uncertain" }); }, REWARD_SAVE_DEADLINE_MS);
    });
    const request = (async (): Promise<RewardDialogResult> => {
      try {
        const response = await fetch(creating ? "/api/admin/loyalty/rewards/create" : "/api/admin/loyalty/rewards", {
          method: "POST", credentials: "same-origin", cache: "no-store", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        // Unsupported old deployments cannot fall back to the legacy upsert route.
        if (creating && response.status === 404) { void response.body?.cancel().catch(() => {}); return { kind: "refused", error: "reward_creation_unavailable" }; }
        const data: unknown = await response.json();
        const body = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
        if (response.ok && body?.ok === true) return { kind: "confirmed" };
        return [400, 401, 403, 404, 409].includes(response.status) && body?.ok === false
          ? { kind: "refused", error: body.error } : { kind: "uncertain" };
      } catch { return { kind: "uncertain" }; }
    })();
    const result = await Promise.race([request, deadline]);
    if (!owns(candidate, action)) return;
    if (candidate.timer !== null) clearTimeout(candidate.timer);
    candidate.timer = null; candidate.stop = null; candidate.controller = null;
    setLoading(false);
    if (result.kind === "confirmed") {
      candidate.phase = "confirmed";
      setMessage({ type: "success", text: creating ? "Nuevo beneficio creado. Consultá el catálogo para ver su estado actualizado." : "Beneficio actualizado. Consultá el catálogo para ver su estado actualizado." });
    } else if (result.kind === "refused") {
      candidate.phase = "idle"; setMessage({ type: "error", text: rewardSaveErrorCopy(result.error) });
    } else {
      requireReview(candidate);
      setMessage({ type: "error", text: "No pudimos confirmar el resultado. El guardado puede haberse completado. Conservamos tu formulario. Podés consultar el catálogo, pero la edición sigue en pausa porque esa consulta no confirma el guardado anterior." });
    }
  };

  return (
    <div
      className="space-y-6"
      data-rewards-availability={availability}
      data-rewards-source={dataSource}
      data-rewards-source-reason={sourceReason || undefined}
    >
      {reviewBlocked ? <div role="alert" className="rounded-2xl border border-amber-300/40 bg-amber-400/10 p-4 text-sm text-amber-100"><p>Hay un guardado cuyo resultado no pudimos confirmar. Podés consultar el catálogo, pero esa consulta no confirma la operación anterior. La edición sigue en pausa; cerrar la ventana no revierte un guardado.</p><button type="button" onClick={() => void consultCatalog()} aria-disabled={readingCurrentCatalog} className="inline-flex min-h-11 items-center underline underline-offset-4">{readingCurrentCatalog ? "Consultando catálogo…" : "Consultar catálogo"}</button></div> : activeCatalogNotice ? <div role="status" className="rounded-2xl border border-cyan-300/30 p-4 text-sm text-slate-200"><p>{activeCatalogNotice}</p><button type="button" onClick={() => void consultCatalog()} aria-disabled={readingCurrentCatalog} className="inline-flex min-h-11 items-center underline underline-offset-4">{readingCurrentCatalog ? "Consultando catálogo…" : "Consultar catálogo"}</button></div> : null}
      {readingCurrentCatalog ? <p role="status" className="text-sm text-slate-300">Consultando el catálogo sin repetir el guardado…</p> : currentReadMessage && !isModalOpen ? <p role="alert" className="text-sm text-amber-100">{currentReadMessage}</p> : null}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Trophy className="h-6 w-6 text-cyan-400 animate-pulse" />
            Catálogo de Beneficios
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {isDemo
              ? "Vista ilustrativa del catálogo: no escribe beneficios ni inventario real."
              : "Gestioná los premios, experiencias y beneficios que tu tenant publica para sus consumidores."}
          </p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={openCreateModal}
            aria-disabled={reviewBlocked || readingCurrentCatalog}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-800 hover:bg-cyan-700 text-[#ffffff] text-sm font-semibold rounded-xl transition-all shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.3)] hover:-translate-y-0.5"
          >
            <Plus className="h-4 w-4" />
            Nuevo Beneficio
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300">
            <Lock className="h-4 w-4 text-amber-300" />
            {isDemo ? "Demo · solo lectura" : tenantScope ? "Solo lectura" : "Elegí un tenant para editar"}
          </span>
        )}
      </header>

      <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
        <div>
          Scope operativo: <b className="text-cyan-300 font-mono">{tenantScope ? `tenant:${tenantScope}` : "global / multi-tenant"}</b>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>
            {dataSource === "demo"
              ? "Datos ilustrativos · sin persistencia"
              : dataSource === "production"
                ? "Fuente productiva confirmada"
                : "Fuente no disponible"}
          </span>
        </div>
      </div>

      {availability === "forbidden" ? (
        <div role="alert" className="rounded-2xl border border-amber-300/30 bg-amber-400/[0.07] p-5 text-sm text-amber-100">
          Tu sesión no tiene permiso para consultar este catálogo. No se muestran fixtures ni ceros como si fueran datos reales.
        </div>
      ) : availability === "upstream_error" ? (
        <div role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/[0.07] p-5 text-sm text-rose-100">
          No se pudo confirmar la fuente de recompensas. El catálogo permanece no disponible hasta recuperar la conexión.
        </div>
      ) : availability === "ready_empty" ? (
        <div role="status" className="rounded-2xl border border-white/10 bg-slate-900/50 p-5 text-sm text-slate-300">
          La fuente respondió correctamente y confirmó que todavía no hay beneficios configurados para este scope.
        </div>
      ) : null}

      {availability === "ready" && dataSource === "production" ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-300">
          Activo indica el estado del beneficio. Cada reserva también depende del programa, la vigencia y los requisitos de la persona.
          Revisá <strong>Condiciones de acceso</strong> en cada beneficio antes de comunicar su disponibilidad.
        </p>
      ) : null}

      {availability === "ready" ? <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {initialRewards.map((item, idx) => {
          const statusLabel = typeof item.status === "string" && Object.hasOwn(REWARD_STATUSES, item.status)
            ? REWARD_STATUSES[item.status as keyof typeof REWARD_STATUSES] : "Estado sin confirmar";
          const typeLabel = REWARD_TYPES.find(({ value }) => value === item.type)?.label ?? "Tipo sin confirmar";
          const displayImage = item.image_url?.trim();
          const editable = canWrite && !isDemo && dataSource === "production" && canEditReward(item, tenantScope);
          
          return (
            <div
              key={item.id ?? `${item.code}-${idx}`}
              className="min-w-0 rounded-2xl border border-white/10 bg-slate-950/40 overflow-hidden flex flex-col group transition-colors duration-300 hover:border-cyan-500/50 hover:bg-slate-900/40 shadow-lg"
            >
              {/* Card Header Image */}
              <div className="h-44 bg-slate-900 relative overflow-hidden flex items-center justify-center">
                <div aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 text-slate-400">
                  <ImageIcon className="h-8 w-8" />
                  <span className="text-xs">Sin imagen disponible</span>
                </div>
                {displayImage ? <img
                  key={displayImage}
                  src={displayImage}
                  alt=""
                  className="relative w-full h-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
                  onError={(event) => { event.currentTarget.style.display = "none"; }}
                /> : null}

                <div className="absolute top-3 right-3 flex gap-1.5">
                  {item.requires_age_gate && (
                    <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black rounded-lg uppercase tracking-wider backdrop-blur-md">
                      +18
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 border text-[10px] font-bold rounded-lg uppercase tracking-wider backdrop-blur-md ${
                      item.status === "active"
                        ? "bg-slate-950/85 border-cyan-300/45 text-cyan-100"
                        : "bg-slate-950/85 border-slate-500/65 text-slate-200"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                
                {/* Type Tag */}
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-0.5 bg-slate-950/80 border border-white/10 text-white text-[9px] font-medium rounded-md uppercase tracking-wider backdrop-blur-md">
                    {typeLabel}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className="shrink-0 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                    {item.points !== null && item.points >= 1000 ? "PREMIO MAYOR" : "BENEFICIO"}
                  </p>
                  <span className="min-w-0 text-right text-xs text-slate-400 font-mono [overflow-wrap:anywhere]">
                    {item.code.trim() ? `#${item.code}` : "Código sin informar"}
                  </span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors [overflow-wrap:anywhere]">
                  {item.title.trim() || "Beneficio sin título informado"}
                </h3>
                <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed flex-1">
                  {item.description || "Sin descripción disponible."}
                </p>

                <RewardReservationNotice reward={item} tenantScope={tenantScope} dataSource={dataSource} />

                <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {item.points === null ? <p className="text-sm text-slate-300">Puntos sin confirmar</p>
                      : <p className="text-lg font-black text-white">{item.points} <span className="text-xs font-normal text-slate-400">pts</span></p>}
                    <p className="text-xs leading-snug text-slate-400">
                      {rewardStockLabel(item.stock_remaining, item.stock_total)}
                    </p>
                  </div>
                  {editable ? (
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      aria-disabled={reviewBlocked || readingCurrentCatalog}
                      className="flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-xs text-slate-300 hover:text-cyan-400 font-semibold transition-colors"
                    >
                      <Edit2 className="h-3 w-3" />
                      Editar
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      {canWrite && dataSource === "production" ? "Solo lectura · configuración por revisar" : "Solo lectura"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div> : null}

      {/* MODAL */}
      {isModalOpen && canWrite && currentOwner && (
        <dialog key={currentOwner.id} ref={dialogRef} aria-labelledby="reward-edit-heading" onKeyDown={containModalFocus} onCancel={(event) => { event.preventDefault(); closeModal(); }} onClose={() => closeOwner(currentOwner, true)} className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl animate-in fade-in zoom-in duration-200 sm:max-h-[min(100%,calc(75dvh+4rem))]">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-slate-900/50 px-4 py-2 sm:px-6">
              <h2 id="reward-edit-heading" className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                {editingReward ? "Editar Beneficio" : "Crear Nuevo Beneficio"}
              </h2>
              <button
                type="button"
                aria-label="Cerrar edición del beneficio"
                onClick={closeModal}
                className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form id="reward-edit-form" onSubmit={handleSubmit} aria-busy={loading} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
              {loading && <p role="status" className="text-sm leading-relaxed text-slate-300">Guardando los cambios. Si cerrás esta ventana, consultá el catálogo antes de volver a guardar.</p>}
              {editingReward && <section aria-label="Condiciones guardadas del beneficio" className="space-y-3">
                <p className="text-sm leading-relaxed text-slate-300">Esta edición conserva la asociación con el programa, la vigencia y las condiciones personalizadas. Guardar no garantiza que una persona pueda reservar; se validan los requisitos del programa y del beneficio.</p>
                <RewardReservationNotice reward={editingReward} tenantScope={tenantScope} dataSource={dataSource} initiallyOpen />
                {programConfigurationHref && <a href={programConfigurationHref} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-cyan-400/40 px-3 py-2 text-sm font-semibold text-cyan-200 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-300">Consultar programa (abre otra pestaña)</a>}
              </section>}
              {message && (
                <div
                  ref={feedbackRef}
                  role={message.type === "error" ? "alert" : "status"}
                  tabIndex={-1}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                    message.type === "success"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-100"
                      : "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950 dark:border-rose-700 dark:text-rose-100"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {/* Scope Selection for Super Admin */}
              {currentReadMessage && <p role="alert" className="text-sm text-amber-100">{currentReadMessage}</p>}
              <fieldset disabled={saveBlocked} aria-label="Datos del beneficio" className="min-w-0 space-y-4 border-0 p-0">
              {!tenantScope && !editingReward && (
                <div>
                  <label htmlFor="reward-edit-tenant" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tenant Responsable
                  </label>
                  <select
                    id="reward-edit-tenant"
                    value={customTenant}
                    onChange={(e) => setCustomTenant(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="demobodega">Bodega Balmec (demobodega)</option>
                    <option value="demoevents">Demo Events (demoevents)</option>
                    <option value="democosmetics">Demo Cosmetics (democosmetics)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reward-edit-code" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Código de Control
                  </label>
                  <input
                    id="reward-edit-code"
                    type="text"
                    required
                    value={code}
                    disabled={!!editingReward}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="E.g. WINE-KIT-6B"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed uppercase font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="reward-edit-type" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Tipo de Beneficio
                  </label>
                  <select
                    id="reward-edit-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {REWARD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="reward-edit-title" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Título del Beneficio
                </label>
                <input
                  id="reward-edit-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g. Caja Madera Edición Limitada"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label htmlFor="reward-edit-description" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Descripción Detallada
                </label>
                <textarea
                  id="reward-edit-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explicá claramente qué incluye y cómo se reclama..."
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reward-edit-points" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Costo en Puntos
                  </label>
                  <input
                    id="reward-edit-points"
                    type="number"
                    min={0}
                    required
                    value={Number.isNaN(pointsCost) ? "" : pointsCost}
                    step={1}
                    max={2_147_483_647}
                    onChange={(e) => setPointsCost(e.target.value === "" ? NaN : Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor="reward-edit-stock" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Stock total
                  </label>
                  <input
                    id="reward-edit-stock"
                    aria-describedby="reward-edit-stock-help"
                    type="number"
                    min={0}
                    required
                    step={1}
                    max={2_147_483_647}
                    disabled={Boolean(editingReward && editingReward.stock_total == null)}
                    value={stockTotal === null || Number.isNaN(stockTotal) ? "" : stockTotal}
                    onChange={(e) => setStockTotal(e.target.value === "" ? NaN : Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                  <p id="reward-edit-stock-help" className="mt-2 text-xs text-slate-400">{editingReward
                    ? editingReward.stock_total == null ? "Sin límite de stock registrado. Esta edición conserva el stock existente."
                      : `Disponible en la última consulta: ${editingReward.stock_remaining ?? "sin confirmar"}. Cambiar el total agrega o quita unidades; conserva las ya consumidas, incluidos los nuevos canjes.`
                    : "Al crear el beneficio, el total es su disponibilidad inicial."}</p>
                </div>
              </div>

              {/* Image selector */}
              <fieldset className="min-w-0">
                <legend className="mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Imagen del beneficio
                </legend>
                <div role="group" aria-label="Opciones de imagen" className="mb-2 grid grid-cols-1 gap-2">
                  {REWARD_IMAGE_OPTIONS.map((img) => {
                    const selected = imageUrl === img.value;
                    return (
                      <button
                        key={img.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setImageUrl(img.value)}
                        className={`flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-xs rounded-xl border text-left transition-all ${
                          selected
                            ? "bg-cyan-500/10 border-cyan-500 text-cyan-300 font-semibold"
                            : "bg-slate-900 border-white/5 text-slate-400 hover:border-white/15"
                        }`}
                      >
                        <span>{img.label}</span>
                        {selected && <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <label htmlFor="reward-edit-image" className="mb-1 block text-xs text-slate-400">
                  URL personalizada de imagen (opcional)
                </label>
                <input
                  id="reward-edit-image"
                  type="text"
                  value={REWARD_IMAGE_OPTIONS.some((img) => img.value === imageUrl) ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
              </fieldset>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label htmlFor="reward-edit-status" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Estado
                  </label>
                  <select
                    id="reward-edit-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    {Object.entries(REWARD_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 text-slate-300 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresAgeGate}
                      onChange={(e) => setRequiresAgeGate(e.target.checked)}
                      className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Requiere Filtro de Edad (+18)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 text-sm select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={networkVisible}
                      onChange={(e) => setNetworkVisible(e.target.checked)}
                      className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                    />
                    <span>Visible en Red Global</span>
                  </label>
                </div>
              </div>

              </fieldset>
            </form>
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-white/10 bg-[#f8fafc] px-4 py-2 dark:bg-[#020617] sm:px-6">
              <button
                type="button"
                onClick={closeModal}
                className="min-h-11 rounded-lg px-3 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="reward-edit-form"
                aria-disabled={saveBlocked}
                className="min-h-11 max-w-full rounded-xl bg-cyan-800 px-4 py-2 text-sm font-semibold text-[#ffffff] transition-colors hover:bg-cyan-700 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              >
                {loading ? "Guardando..." : currentOwner.phase === "confirmed" ? "Guardado" : currentOwner.phase === "uncertain" ? "Resultado sin confirmar" : "Guardar Beneficio"}
              </button>
              {(currentOwner.phase === "confirmed" || currentOwner.phase === "uncertain") && <button type="button" onClick={() => void consultCatalog()} aria-disabled={readingCurrentCatalog} className="inline-flex min-h-11 max-w-full items-center rounded-xl border border-cyan-300/40 px-3 text-sm font-semibold text-cyan-100 underline underline-offset-4">{readingCurrentCatalog ? "Consultando catálogo…" : "Consultar catálogo"}</button>}
            </footer>
          </div>
        </dialog>
      )}
    </div>
  );
}
