import { EventEmitter } from "node:events";

type RealtimeEventPayload = {
  id?: string | number;
  tenant_slug?: string;
  bid?: string;
  uid_hex?: string;
  result?: string;
  reason?: string | null;
  city?: string | null;
  country_code?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: string | null;
  created_at?: string;
};

const BUS_KEY = "__nexid_realtime_bus__";

type BusStore = {
  emitter: EventEmitter;
};

function getStore(): BusStore {
  const scope = globalThis as typeof globalThis & { [BUS_KEY]?: BusStore };
  if (!scope[BUS_KEY]) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    scope[BUS_KEY] = { emitter };
  }
  return scope[BUS_KEY]!;
}

export function publishRealtimeEvent(payload: RealtimeEventPayload) {
  getStore().emitter.emit("event", payload);
}

export function onRealtimeEvent(listener: (payload: RealtimeEventPayload) => void) {
  const emitter = getStore().emitter;
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}
