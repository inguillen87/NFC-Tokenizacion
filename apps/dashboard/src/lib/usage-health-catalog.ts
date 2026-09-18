import type { ServiceId, HealthState } from "./usage-health-model";
import type { DashboardDestinationKey } from "./dashboard-destination-policy";
export const SERVICE_CATALOG: Record<ServiceId,{title:string;caption:string;runbook:string;destination:DashboardDestinationKey;action:string}> = {
  sun:{title:"Lecturas NFC",caption:"Completitud de los eventos SUN guardados. No mide las solicitudes que fallaron antes de persistirse.",runbook:"sun-adjudication",destination:"events",action:"Revisar lecturas"},
  canonical_event_outbox:{title:"Integridad de eventos",caption:"Correspondencia entre operaciones, eventos y entregas persistidas.",runbook:"canonical-event-outbox",destination:"proof",action:"Abrir evidencia"},
  webhooks:{title:"Entregas a integraciones",caption:"Resultados terminales y pendientes de los webhooks; no equivalen a ventas.",runbook:"webhook-delivery",destination:"apiKeys",action:"Revisar integración"},
  incidents:{title:"Respuesta a incidentes",caption:"Reconocimiento y resolución registrados. Descartar no prueba que el problema se haya corregido.",runbook:"incident-response",destination:"leadsTickets",action:"Abrir casos"},
  polygon_queue:{title:"Cola de derechos digitales",caption:"Solicitudes Polygon reales; simulaciones excluidas. No se activa al consultar.",runbook:"polygon-queue",destination:"tokenization",action:"Revisar cola"},
  iota_queue:{title:"Cola de evidencia",caption:"Anclajes IOTA reales; entradas de prueba excluidas. No publica transacciones.",runbook:"iota-queue",destination:"proof",action:"Abrir pruebas"},
};
export const STATE_LABEL: Record<HealthState,string> = {
  healthy:"Dentro del objetivo",breach:"Objetivo excedido",insufficient_data:"Muestra insuficiente",no_data:"Sin muestra elegible",ticket:"Investigar",page:"Revisión prioritaria",unavailable:"Fuente no disponible",
};
export const METRIC_LABEL: Record<string,string> = {
  "webhooks.oldest_open_delivery_age":"Antigüedad de la entrega pendiente más antigua",
  "webhooks.overdue_delivery_count":"Entregas pendientes vencidas",
  "sun.persisted_adjudication_completeness":"Lecturas con evidencia completa",
  "canonical_event_outbox.persistence_integrity":"Integridad del registro y su entrega",
  "webhooks.terminal_delivery_success":"Entregas terminales correctas",
  "incidents.acknowledged_within_15m":"Reconocimiento dentro de 15 minutos",
  "incidents.terminal_disposition_within_4h":"Cierre o descarte dentro de 4 horas",
  "polygon_queue.terminal_anchor_success":"Solicitudes con anclaje confirmado",
  "iota_queue.terminal_confirmation_success":"Pruebas con confirmación",
  "incidents.open_high_critical_count":"Incidentes abiertos de severidad alta o crítica",
  "incidents.oldest_open_age":"Antigüedad del incidente abierto más antiguo",
  "polygon_queue.oldest_pending_age":"Antigüedad del pendiente más antiguo",
  "polygon_queue.overdue_count":"Solicitudes pendientes vencidas",
  "iota_queue.oldest_pending_age":"Antigüedad del anclaje pendiente más antiguo",
  "iota_queue.overdue_count":"Anclajes pendientes vencidos",
};
