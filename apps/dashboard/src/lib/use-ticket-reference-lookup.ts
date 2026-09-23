"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { canonicalTicketReference, createTicketLookupRunner, type TicketLookupState } from "./ticket-reference-lookup";

/** No reads on mount. Both the form and row entries use the same guarded reader. */
export function useTicketReferenceLookup(tenantScope: string, isDemo: boolean, canLookup: boolean, onLockChange?: (locked: boolean) => void) {
  const context = JSON.stringify([tenantScope, isDemo, canLookup]);
  const scope = useMemo(() => ({ context, runner: createTicketLookupRunner() }), [context]);
  const active = useRef(scope); active.current = scope;
  const [referenceState, setReference] = useState({ scope, value: "" });
  const reference = referenceState.scope === scope ? referenceState.value : "";
  const [result, setResult] = useState<{ scope: typeof scope; state: TicketLookupState }>({ scope, state: { status: "idle" } });
  const state = result.scope === scope ? result.state : { status: "idle" as const };
  const current = useRef(state); current.current = state;
  const lock = useRef({ scope, value: false });
  if (lock.current.scope !== scope) lock.current = { scope, value: false };
  const [lockState, setLockState] = useState({ scope, value: false });
  const listener = useRef(onLockChange); listener.current = onLockChange;
  const isLocked = () => lock.current.scope === scope && lock.current.value;
  function publish(next: TicketLookupState) {
    if (active.current !== scope) return;
    current.current = next;
    setResult({ scope, state: next });
  }
  useEffect(() => () => scope.runner.cancel(), [scope]);
  function setLocked(value: boolean) {
    if (active.current !== scope) return;
    lock.current = { scope, value };
    setLockState({ scope, value });
    listener.current?.(value);
  }
  function reset() {
    if (active.current !== scope || isLocked()) return false;
    scope.runner.cancel(); publish({ status: "idle" }); return true;
  }
  function edit(value: string) { if (reset()) setReference({ scope, value }); }
  function open(value: string, reuse = false) {
    if (active.current !== scope || isLocked() || isDemo || !canLookup) return false;
    const canonical = canonicalTicketReference(value);
    if (!canonical) { if (reset()) publish({ status: "invalid" }); return false; }
    setReference({ scope, value: canonical });
    if (current.current.reference === canonical && (current.current.status === "loading" || reuse && current.current.status === "found")) return true;
    publish({ status: "loading", reference: canonical });
    void scope.runner.search(canonical, tenantScope).then(next => { if (next) publish(next); });
    return true;
  }
  function updateStatus(ticketId: string, status: string) {
    const previous = current.current;
    if (previous.status === "found" && previous.ticket?.id === ticketId) publish({ ...previous, ticket: { ...previous.ticket, status } });
  }
  return { context, reference, state, locked: lockState.scope === scope && lockState.value, isLocked, setLocked, reset, edit, open, updateStatus };
}
