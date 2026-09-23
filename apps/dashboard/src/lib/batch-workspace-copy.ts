export const batchWorkspaceCopy = {
  "es-AR": {
    label: "Continuidad del lote", context: "Empresa de esta consulta", bid: "Referencia del lote", all: "Volver a lotes de esta empresa",
    overview: "Expediente", passport: "Pasaporte", production: "Producción de etiquetas", channels: "Enlaces QR / NFC", traceability: "Trazabilidad", intake: "Registrar movimiento", recalls: "Retiros y cuarentenas",
    permission: "Requiere autorización", demo: "No disponible en demo", current: "Pantalla actual",
    hint: "Estos accesos abren otras pantallas del mismo lote; no confirman operaciones. Guardá los cambios pendientes antes de salir.",
    tenant_required: "Seleccioná una empresa autorizada para continuar entre las pantallas del lote.",
    invalid_context: "No se pudo conservar una referencia válida de empresa y lote. No se ofrecen enlaces de otro contexto.",
    scope_mismatch: "La empresa de esta consulta no coincide con el alcance autorizado de la sesión.", access_denied: "La sesión no tiene acceso a la navegación de lotes.",
  },
  en: {
    label: "Continue with this batch", context: "Company for this request", bid: "Batch reference", all: "Back to this company's batches",
    overview: "Batch dossier", passport: "Passport", production: "Label production", channels: "QR / NFC links", traceability: "Traceability", intake: "Record movement", recalls: "Recalls and quarantine",
    permission: "Authorization required", demo: "Unavailable in demo", current: "Current page",
    hint: "These links open other pages for the same batch; they do not confirm operations. Save pending changes before leaving.",
    tenant_required: "Select an authorized company to continue between the batch pages.",
    invalid_context: "A valid company and batch reference could not be retained. No links to another context are offered.",
    scope_mismatch: "The requested company does not match the session's authorized scope.", access_denied: "This session cannot access batch navigation.",
  },
  "pt-BR": {
    label: "Continuar neste lote", context: "Empresa desta consulta", bid: "Referência do lote", all: "Voltar aos lotes desta empresa",
    overview: "Dossiê do lote", passport: "Passaporte", production: "Produção de etiquetas", channels: "Links QR / NFC", traceability: "Rastreabilidade", intake: "Registrar movimento", recalls: "Recolhimentos e quarentena",
    permission: "Requer autorização", demo: "Indisponível na demonstração", current: "Página atual",
    hint: "Estes links abrem outras páginas do mesmo lote; não confirmam operações. Salve alterações pendentes antes de sair.",
    tenant_required: "Selecione uma empresa autorizada para continuar entre as páginas do lote.",
    invalid_context: "Não foi possível preservar uma referência válida de empresa e lote. Não são oferecidos links para outro contexto.",
    scope_mismatch: "A empresa da consulta não corresponde ao escopo autorizado da sessão.", access_denied: "Esta sessão não tem acesso à navegação de lotes.",
  },
} as const;
