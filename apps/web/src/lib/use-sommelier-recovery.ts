"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { managedSommelierRecovery, sommelierRecoveryNotice, type ManagedSommelierResult, type SommelierRecovery } from "./managed-sommelier";

type RecoverySnapshot = { recovery: SommelierRecovery; until: number };

/** Local request feedback only. The API remains the admission authority.
 * Scope identifies the tenant/demo journey, not an inferred quota bucket.
 * Cosmetic resets and locale/product labels do not change this scope.
 */
export function useSommelierRecovery(locale: "es-AR" | "en" | "pt-BR", scope: string) {
  const snapshots = useRef(new Map<string, RecoverySnapshot>());
  const owner = useRef({ scope, epoch: 0 });
  const mounted = useRef(true);
  const [, render] = useState(0);
  if (owner.current.scope !== scope) {
    owner.current = { scope, epoch: owner.current.epoch + 1 };
    for (const [key, value] of snapshots.current) if (key !== scope && value.until <= Date.now()) snapshots.current.delete(key);
  }
  const epoch = owner.current.epoch;
  const current = snapshots.current.get(scope);
  const until = current?.until ?? 0;
  const waiting = until > Date.now();

  useEffect(() => {
    const remaining = until - Date.now();
    if (remaining <= 0) return;
    // One wake-up changes availability. No countdown announcements or automatic request.
    const timer = setTimeout(() => render(value => value + 1), remaining + 1);
    return () => clearTimeout(timer);
  }, [scope, until]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const isWaiting = useCallback(() => !mounted.current || owner.current.scope !== scope || owner.current.epoch !== epoch
    || (snapshots.current.get(scope)?.until ?? 0) > Date.now(), [scope, epoch]);
  const remember = useCallback((result: ManagedSommelierResult) => {
    // Old A cannot write into B, including an A -> B -> A transition.
    if (!mounted.current || owner.current.scope !== scope || owner.current.epoch !== epoch) return;
    const recovery = managedSommelierRecovery(result);
    const previous = snapshots.current.get(scope);
    const now = Date.now();
    if (recovery) {
      snapshots.current.set(scope, { recovery, until: Math.max(previous?.until ?? 0, recovery.retryAfter === undefined ? 0 : now + recovery.retryAfter * 1000) });
    } else if (!previous || previous.until <= now) snapshots.current.delete(scope);
    render(value => value + 1);
  }, [scope, epoch]);

  return { waiting, isWaiting, remember, notice: sommelierRecoveryNotice(current?.recovery, locale, waiting) };
}
