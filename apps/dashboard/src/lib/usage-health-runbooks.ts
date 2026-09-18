export const RUNBOOKS: Record<string, { title: string; firstResponse: string; escalation: string }> = {
  "sun-adjudication": {
    title: "SUN adjudication",
    firstResponse: "Confirmar watermark, errores estructurados de /sun y si el evento se persistió; separar rechazo criptográfico válido de falla de plataforma.",
    escalation: "No alterar KFile/KMeta ni desactivar anti-replay. Escalar a seguridad NFC si falta evidencia atómica o sube el gap de persistencia.",
  },
  "canonical-event-outbox": {
    title: "Canonical event + outbox",
    firstResponse: "Bloquear reintentos manuales no idempotentes, comprobar operation_key y la identidad particionada del evento, luego revisar deliveries evt_canonical_*.",
    escalation: "Escalar a plataforma si existe un huérfano o mismatch; preservar filas y logs para reconstrucción, sin editar historial append-only.",
  },
  "webhook-delivery": {
    title: "Webhook delivery",
    firstResponse: "Revisar backlog, oldest age, endpoint lifecycle y códigos sanitizados. Reintentar solo deliveries cuya transición durable permite retry.",
    escalation: "Rotar el signing secret únicamente mediante dual-secret overlap; nunca copiar secretos o payload privado al ticket.",
  },
  "incident-response": {
    title: "Incident response",
    firstResponse: "Asignar owner, pasar a investigating y documentar evidencia. Para critical, contener antes de resolver y mantener el ticket enlazado.",
    escalation: "Escalar al responsable del tenant con referencias opacas; no incluir UID completo, llaves, URLs firmadas ni datos personales.",
  },
  "polygon-queue": {
    title: "Polygon queue",
    firstResponse: "Verificar modo real, executor, nonce, gas y receipt. No asumir éxito por tx_hash: exigir receipt y evidencia on-chain validada.",
    escalation: "No reemitir mint ambiguo. Preservar idempotency key y escalar el estado incierto para reconciliación antes de otro envío.",
  },
  "iota-queue": {
    title: "IOTA queue",
    firstResponse: "Revisar pending/submitted/reconciling, lease y receipt. Confirmar proof_id, chain y publisher sin revelar memo privado.",
    escalation: "No volver a publicar una transacción ambigua. Reconciliar por proof_id/tx antes de habilitar un retry.",
  },
};
