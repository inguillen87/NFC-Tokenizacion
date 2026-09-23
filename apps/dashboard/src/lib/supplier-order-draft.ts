import { parseSupplierOrderCreationPurpose } from "./supplier-pack-purpose-policy";

/** Requested constructions, never supplier confirmations or packaging approvals. */
export const SUPPLIER_CONSTRUCTIONS = [
  { id: "pet_wet", label: "Bolsa · PET transparente", description: "Inlay NFC adhesivo para bolsa o debajo de una etiqueta.", chipModel: "NTAG424_DNA", carrierProfileCode: "ntag424_dna", materialType: "transparent_pet_wet_inlay", checks: ["Confirmar antena, adhesivo, liner y formato de rollo.", "Probar sobre la bolsa terminada. No incluye detección TagTamper."] },
  { id: "white_wet", label: "Bolsa o bidón · etiqueta blanca", description: "Etiqueta NFC blanca con adhesivo y liner.", chipModel: "NTAG424_DNA", carrierProfileCode: "ntag424_dna", materialType: "white_wet_inlay", checks: ["Confirmar compatibilidad del adhesivo con la superficie.", "Probar lectura sobre el envase lleno. No incluye detección TagTamper."] },
  { id: "dry_inlay", label: "Conversión local · dry inlay", description: "Inlay NFC para laminar y troquelar con un convertidor.", chipModel: "NTAG424_DNA", carrierProfileCode: "ntag424_dna", materialType: "dry_inlay", checks: ["Confirmar laminado, troquel y construcción final con el convertidor.", "La prueba del inlay no aprueba la etiqueta terminada."] },
  { id: "tt_bridge", label: "Tapa de bidón · precinto con cola", description: "TagTamper entre tapa y cuerpo, con lazo diseñado para romperse al abrir.", chipModel: "NTAG424_DNA_TT", carrierProfileCode: "ntag424_dna_tt", materialType: "tagtamper_tail", checks: ["Comprobar cierre CC y corte que permanece abierto OO, con lecturas nuevas.", "Verificar que el chip siga legible después del corte, sobre el envase lleno."] },
  { id: "tt_void", label: "Sello · material destructible", description: "TagTamper con material VOID o destructible a confirmar con fábrica.", chipModel: "NTAG424_DNA_TT", carrierProfileCode: "ntag424_dna_tt", materialType: "tagtamper_void_destructible", checks: ["Validar por separado la rotura del lazo y la evidencia física del adhesivo.", "Confirmar lectura después de abrir y resistencia al traslado del sello."] },
  { id: "uhf_label", label: "Caja o pallet · UHF", description: "Etiqueta logística RFID; el modelo de chip debe confirmarlo el proveedor.", chipModel: "", carrierProfileCode: "uhf_rfid", materialType: "uhf_logistics_label", checks: ["Confirmar modelo, frecuencia, lector y manifestación EPC/TID/UID del proveedor.", "La lectura UHF no demuestra autenticidad SUN ni estado TagTamper."] },
  { id: "uhf_metal", label: "Equipo o herramienta · UHF sobre metal", description: "Construcción UHF específica para montaje sobre metal.", chipModel: "", carrierProfileCode: "uhf_rfid", materialType: "uhf_on_metal", checks: ["Confirmar chip, montaje, lector y alcance sobre la pieza real.", "Mantener esta construcción separada de las etiquetas para cajas."] },
] as const;

export type SupplierOrderDraft = {
  tenant_slug: string;
  customer_slug: string;
  order_name: string;
  base_batch_id: string;
  total_quantity: string;
  sub_batch_size: string;
  chip_model: string;
  carrier_profile_code: string;
  material_type: string;
  notes: string;
};

export function emptySupplierOrderDraft(): SupplierOrderDraft {
  return { tenant_slug: "", customer_slug: "", order_name: "", base_batch_id: "", total_quantity: "", sub_batch_size: "", chip_model: "", carrier_profile_code: "", material_type: "", notes: "" };
}

export function applySupplierConstruction(draft: SupplierOrderDraft, id: string): SupplierOrderDraft {
  const profile = SUPPLIER_CONSTRUCTIONS.find((item) => item.id === id);
  if (!profile) return draft;
  return { ...draft, chip_model: profile.chipModel, carrier_profile_code: profile.carrierProfileCode, material_type: profile.materialType };
}

const CARRIERS = new Set(["ntag424_dna", "ntag424_dna_tt", "uhf_rfid", "qr_basic", "gs1_digital_link", "ntag213", "ntag215", "ntag216", "event_wristband", "hotel_keycard", "iot_tracker_placeholder"]);
// Mirror existing API limits; these are not a production sampling plan.
export const SUPPLIER_ORDER_MAX_QUANTITY = 100_000_000;
export const SUPPLIER_ORDER_MAX_SUB_BATCHES = 52;

type Payload = Omit<SupplierOrderDraft, "total_quantity" | "sub_batch_size"> & {
  total_quantity: number;
  sub_batch_size: number;
  pack_purpose: "trial_integration" | "production";
};
type Validation = { ok: true; payload: Payload; subBatchCount: number; secureSun: boolean } | { ok: false; error: string };

export function validateSupplierOrderDraft(draft: SupplierOrderDraft, purpose: unknown): Validation {
  const fail = (error: string): Validation => ({ ok: false, error });
  const packPurpose = parseSupplierOrderCreationPurpose(purpose);
  if (!packPurpose) return fail("Elegí si el pedido es para pruebas o para producción.");
  const tenant = draft.tenant_slug.trim().toLowerCase();
  if (!tenant) return fail("Indicá la empresa del pedido.");
  if (!draft.order_name.trim()) return fail("Dale un nombre al pedido para encontrarlo después.");
  if (new TextEncoder().encode(draft.order_name.trim()).byteLength > 200) return fail("El nombre del pedido técnico supera 200 bytes UTF-8. Abrevialo antes de crear; el texto no fue modificado.");
  if (new TextEncoder().encode(draft.notes.trim()).byteLength > 4000) return fail("Las notas del pedido técnico superan 4000 bytes UTF-8. Resumilas antes de crear; el texto no fue modificado.");
  // Match the API's normalization without silently changing a supplier's reference.
  const bid = draft.base_batch_id.trim();
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(bid)) return fail("La referencia del lote debe usar mayúsculas, números y guiones entre palabras.");
  if (!/^\d+$/.test(draft.total_quantity.trim())) return fail("La cantidad debe ser un número entero de etiquetas.");
  const quantity = Number(draft.total_quantity);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > SUPPLIER_ORDER_MAX_QUANTITY) return fail("La cantidad debe estar entre 1 y 100.000.000 etiquetas.");
  const sizeText = draft.sub_batch_size.trim();
  if (sizeText && !/^\d+$/.test(sizeText)) return fail("El tamaño de cada lote debe ser un número entero.");
  const size = sizeText ? Number(sizeText) : quantity;
  if (!Number.isSafeInteger(size) || size < 1 || size > quantity) return fail("Cada lote debe contener entre 1 y la cantidad total de etiquetas.");
  const count = Math.ceil(quantity / size);
  if (count > SUPPLIER_ORDER_MAX_SUB_BATCHES) return fail("Un pedido admite hasta 52 lotes. Aumentá el tamaño de cada lote.");
  const chip = draft.chip_model.trim();
  const carrier = draft.carrier_profile_code;
  if (!CARRIERS.has(carrier)) return fail("Aplicá un perfil de envase o elegí una tecnología válida.");
  if (!chip) return fail(carrier === "uhf_rfid" ? "Ingresá el modelo de chip UHF confirmado por el proveedor." : "Indicá el modelo de chip o portador.");
  const secureSun = carrier === "ntag424_dna" || carrier === "ntag424_dna_tt";
  if ((carrier === "ntag424_dna" && chip !== "NTAG424_DNA") || (carrier === "ntag424_dna_tt" && chip !== "NTAG424_DNA_TT") || (!secureSun && ["NTAG424_DNA", "NTAG424_DNA_TT"].includes(chip))) {
    return fail("El chip y la tecnología no coinciden. Volvé a aplicar el perfil de envase correspondiente.");
  }
  if (carrier === "uhf_rfid" && /^NTAG/i.test(chip)) return fail("UHF requiere un chip RFID compatible; un NTAG es NFC.");
  const staticChip: Record<string, string> = { ntag213: "NTAG213", ntag215: "NTAG215", ntag216: "NTAG216" };
  if (Object.hasOwn(staticChip, carrier) && chip !== staticChip[carrier]) return fail("El chip no coincide con el perfil NFC estático seleccionado.");
  const payload: Payload = {
    tenant_slug: tenant, customer_slug: draft.customer_slug.trim() || tenant,
    order_name: draft.order_name.trim(), base_batch_id: bid,
    total_quantity: quantity, sub_batch_size: size,
    chip_model: chip, carrier_profile_code: carrier,
    material_type: draft.material_type.trim(), notes: draft.notes.trim(), pack_purpose: packPurpose,
  };
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 64 * 1024) return fail("El pedido supera el tamaño permitido. Reducí las notas y los campos de texto.");
  return { ok: true, payload, subBatchCount: count, secureSun };
}

/** Never render arbitrary provider errors or response bodies into the operator view. */
export function supplierOrderErrorMessage(reason: unknown): string {
  const messages: Record<string, string> = {
    tenant_not_found: "No encontramos esa empresa. Revisá su identificador.",
    tenant_scope_forbidden: "Tu cuenta no puede crear pedidos para esa empresa.",
    forbidden: "Tu cuenta no tiene permiso para completar esta acción.",
    permission_denied: "Tu cuenta no tiene permiso para completar esta acción.",
    supplier_batch_key_generation_mfa_required: "Verificá tu cuenta con el segundo factor antes de crear un pedido NFC seguro.",
    tenant_sun_profile_incomplete: "La empresa necesita completar su configuración NFC segura. Contactá a su administrador; conservamos los datos del pedido.",
    batch_bid_already_exists: "Esa referencia ya tiene lotes registrados. Revisá los pedidos existentes antes de usar otra referencia.",
    supplier_order_bid_already_exists: "Esa referencia ya tiene lotes registrados. Revisá los pedidos existentes antes de usar otra referencia.",
    supplier_pack_purpose_required: "Elegí explícitamente si el pedido es para pruebas o para producción.",
    supplier_order_quantity_out_of_range: "La cantidad debe estar entre 1 y 100.000.000 etiquetas.",
    supplier_order_sub_batch_size_invalid: "El tamaño de cada lote no puede superar la cantidad total.",
    too_many_sub_batches: "Un pedido admite hasta 52 lotes. Aumentá el tamaño de cada lote.",
    request_body_too_large: "El pedido es demasiado grande. Reducí las notas y conservá los documentos en el expediente.",
  };
  return typeof reason === "string" && Object.hasOwn(messages, reason) ? messages[reason] : "No se pudo completar el pedido. Conservamos tus datos; revisá el detalle con el administrador antes de volver a enviarlo.";
}
