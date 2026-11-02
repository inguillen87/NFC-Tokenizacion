"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Coins, Store } from "lucide-react";
import { rewardTenant } from "./consumer-rewards-model";
import { normalizeConsumerAuthReturnPath } from "../../login/consumer-login-continuation";
import { readConsumerBrandPoints } from "./consumer-wallet-brand-read";
import type { WalletBrandPointsSource } from "./consumer-wallet-points-model";
import styles from "../rewards/rewards.module.css";

type Source = { initialPoints: WalletBrandPointsSource; tenant: string; sourceEpoch: string };
type View = { source: Source; points: WalletBrandPointsSource; phase: "idle" | "pending" | "ready" | "authentication-required" | "denied" | "unavailable" };
const sameSource = (a: Source, b: Source) => a.sourceEpoch === b.sourceEpoch && a.initialPoints === b.initialPoints && a.tenant === b.tenant;

/** Owns only the brand-points view. A read never replaces the rewards writer's source. */
export function ConsumerRewardBrandPoints({ initialPoints, tenant, sourceEpoch }: Source) {
  const identity = { initialPoints, tenant, sourceEpoch };
  const latest = useRef(identity); latest.current = identity;
  const mounted = useRef(false), pending = useRef(false), sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [view, setView] = useState<View>({ source: identity, points: initialPoints, phase: "idle" });
  const currentView = sameSource(view.source, identity) ? view : { source: identity, points: initialPoints, phase: "idle" as const };
  const liveView = useRef<View>(currentView); liveView.current = currentView;
  const points = currentView.points, busy = currentView.phase === "pending";
  const retained = points.status === "ready" && currentView.phase !== "idle" && currentView.phase !== "ready";
  const safeTenant = rewardTenant(tenant);
  const next = normalizeConsumerAuthReturnPath("/me/rewards" + (safeTenant ? "?tenant=" + encodeURIComponent(safeTenant) : ""));
  const reentry = "/login?consumer=1&next=" + encodeURIComponent(next);
  useEffect(() => {
    mounted.current = true; sequence.current += 1; controller.current?.abort(); controller.current = null; pending.current = false;
    setView({ source: { initialPoints, tenant, sourceEpoch }, points: initialPoints, phase: "idle" });
    return () => { mounted.current = false; sequence.current += 1; controller.current?.abort(); controller.current = null; pending.current = false; };
  }, [initialPoints, tenant, sourceEpoch]);

  async function retry() {
    if (typeof sourceEpoch !== "string" || !sourceEpoch || sourceEpoch.length > 128
      || !mounted.current || pending.current || !sameSource(latest.current, identity)) return;
    const base = latest.current, keptPoints = liveView.current.points, token = ++sequence.current, abort = new AbortController();
    pending.current = true; controller.current = abort;
    const nextPending: View = { source: base, points: keptPoints, phase: "pending" };
    liveView.current = nextPending; setView(nextPending);
    const current = () => mounted.current && sequence.current === token && !abort.signal.aborted && sameSource(latest.current, base);
    try {
      const result = await readConsumerBrandPoints({ signal: abort.signal });
      if (!current()) return;
      const nextView: View = { source: base, points: result.status === "ready" ? result.points : keptPoints, phase: result.status };
      liveView.current = nextView; setView(nextView);
    } finally {
      if (sequence.current === token) { pending.current = false; controller.current = null; }
    }
  }
  const message = currentView.phase === "pending" ? "Consultando tus puntos. Tus beneficios y reservas se conservan."
    : currentView.phase === "authentication-required" ? "Tu sesión venció. Volvé a ingresar para consultar tus puntos."
      : currentView.phase === "denied" ? points.status === "ready"
        ? "No tenés acceso para consultar estos puntos. Conservamos la información anterior; consultá con la marca."
        : "No tenés acceso para consultar estos puntos. Tus saldos no se muestran como cero; consultá con la marca."
        : currentView.phase === "unavailable" ? points.status === "ready"
          ? "No pudimos actualizar tus puntos. Conservamos la información anterior; podés volver a intentarlo."
          : "No pudimos cargar tus puntos. Tus saldos no se muestran como cero; podés volver a intentarlo."
          : currentView.phase === "ready" ? "Actualizamos la consulta de puntos por marca. El saldo de cada programa de beneficios puede ser distinto."
            : points.status === "unavailable" ? "No pudimos cargar tus puntos. Tus saldos no se muestran como cero." : null;
  return <section aria-labelledby="benefits-points-title" className={styles.pointsSection} aria-busy={busy}>
    <div className={styles.sectionHeading}>
      <div className={styles.headingIcon}><Coins aria-hidden="true" /><div><h2 id="benefits-points-title">Puntos por marca</h2><p>Cada marca tiene su propio saldo y condiciones.</p></div></div>
      <Link className={styles.textLink} href="/me/wallet">Ver mi billetera <ArrowUpRight aria-hidden="true" /></Link>
    </div>
    <p role="status" aria-atomic="true" className={message ? styles.notice : styles.srOnly}>{message || ""}</p>
    {points.status === "ready" ? points.data.length === 0 ? <p className={styles.notice}>{retained ? "En la última consulta no había puntos por marca registrados en esta cuenta." : "Todavía no tenés puntos por marca registrados en esta cuenta."}</p>
      : <div className={styles.brandGrid}>{points.data.map((brand, index) => <article key={`${brand.slug}-${index}`} className={styles.brandCard} data-benefit-points="brand">
        <Store aria-hidden="true" /><div><h3>{brand.name || brand.slug || "Marca no informada"}</h3><span>{retained ? "Última consulta" : "Saldo reportado"}</span></div>
        <strong>{brand.balance === null ? "No informado" : <>{brand.balance}<small> pts</small></>}</strong>
      </article>)}</div> : null}
    <button type="button" className={styles.copyButton} aria-disabled={busy} onClick={retry}>{busy ? "Consultando puntos…" : points.status === "ready" ? "Actualizar puntos" : "Reintentar puntos"}</button>
    {currentView.phase === "authentication-required" ? <Link className={styles.primaryLink} href={reentry}>Volver a ingresar</Link> : null}
  </section>;
}
