export const IOT_TRACKER_CARRIER_CODE = "iot_tracker_placeholder";

export const IOT_TRACKER_CARRIER_LABEL = "Sensor / tracker IoT · evidencia declarada";

export const IOT_TRACKER_EVIDENCE_DESCRIPTION =
  "Filtra únicamente evidencia declarada que el tenant persistió para este carrier. No confirma conexión en vivo, hardware atestado, controles anti-replay ni presencia física.";

export const IOT_TRACKER_EMPTY_TITLE = "Sin evidencia confirmada de sensor / tracker IoT";

export const IOT_TRACKER_EMPTY_DESCRIPTION =
  "No hay eventos persistidos confirmados para este scope. No se muestran ni infieren temperatura, estado offline o rutas.";

export function isIotTrackerEvidenceCarrier(value: string | null | undefined) {
  return value === IOT_TRACKER_CARRIER_CODE;
}
