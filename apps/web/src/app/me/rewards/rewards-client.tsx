"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Gift, Search, Ticket } from "lucide-react";
import { REWARD_STATE_LABELS, rewardAvailabilityNotice, rewardDateLabel, rewardTenant, type ConsumerReward } from "../_components/consumer-rewards-model";
import { readConsumerRewardsSnapshot, readConsumerReservation, reserveConsumerReward, rewardReservationQuote, sameReservationQuote, type RewardReservationLookup, type RewardReservationQuote } from "../_components/consumer-reward-reservation";
import { rewardNextActions } from "../_components/consumer-reward-next-actions";
import { normalizeConsumerAuthReturnPath } from "../../login/consumer-login-continuation";
import { retainsRewardClaims, useRewardPresentationClock } from "../_components/consumer-reward-presentation-clock";
import styles from "./rewards.module.css";

function VoucherCode({ item, code, getCode }: { item: ConsumerReward; code: string; getCode: (item: ConsumerReward) => string | null }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const copySequence = useRef(0);
  useEffect(() => { copySequence.current += 1; setCopied(false); setError(false); return () => { copySequence.current += 1; }; }, [item, code]);
  async function copy() {
    const currentCode = getCode(item);
    if (currentCode === null || currentCode !== code) { setCopied(false); setError(false); return; }
    const token = ++copySequence.current;
    try {
      // No await between the live receipt/source check and the clipboard call.
      await navigator.clipboard.writeText(currentCode);
      if (copySequence.current === token && getCode(item) === currentCode) { setCopied(true); setError(false); }
    } catch {
      if (copySequence.current === token && getCode(item) === currentCode) { setCopied(false); setError(true); }
    }
  }
  return <div className={styles.voucherCode}>
    <span>Código del voucher</span><code>{code}</code>
    <button type="button" className={styles.copyButton} onClick={copy}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "Código copiado" : "Copiar código"}</button>
    <p role="status">{error ? "No se pudo copiar. Podés seleccionar el código y copiarlo manualmente." : copied ? "Listo. El código está en tu portapapeles." : "La empresa confirma el canje y sus condiciones."}</p>
  </div>;
}

type RewardSourceIdentity = { items: ConsumerReward[]; initialTenant: string; selectedVoucher: string | null };
type ReservationFlow = {
  source: RewardSourceIdentity; quote: RewardReservationQuote;
  phase: "confirm" | "pending" | "checking" | "uncertain" | "confirmed" | "authentication-required" | "denied";
  claimId: string | null; claimKey?: string; message: string;
};
type RefreshState = { source: RewardSourceIdentity; phase: "pending" | "ready" | "failed" | "authentication-required"; message: string };
const sameSource = (a: RewardSourceIdentity, b: RewardSourceIdentity) => a.items === b.items && a.initialTenant === b.initialTenant && a.selectedVoucher === b.selectedVoucher;

export function ConsumerRewardsClient({ items, checkedAt, initialTenant, selectedVoucher }: RewardSourceIdentity & { checkedAt: string }) {
  const identity = { items, initialTenant, selectedVoucher };
  const [filters, setFilters] = useState({ source: identity, tenant: initialTenant, query: "", view: "all" as "all" | "vouchers" | "catalog" });
  const [flow, setFlow] = useState<ReservationFlow | null>(null);
  const [collection, setCollection] = useState<{ source: RewardSourceIdentity; items: ConsumerReward[]; checkedAt: string } | null>(null);
  const [refreshState, setRefreshState] = useState<RefreshState | null>(null);
  const refreshSequence = useRef(0);
  const refreshPending = useRef(false);
  const refreshController = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const writerFlow = useRef<ReservationFlow | null>(null);
  const writerPhase = useRef<ReservationFlow["phase"] | null>(null);
  function replaceFlow(next: ReservationFlow | null) { if (!mounted.current) return; writerFlow.current = next; writerPhase.current = next?.phase ?? null; setFlow(next); }
  const owner = useRef(identity);
  const sequence = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const attempted = useRef(new Set<string>());
  const confirmHeading = useRef<HTMLHeadingElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const active = flow && sameSource(flow.source, identity) ? flow : null;
  const currentFilters = sameSource(filters.source, identity) ? filters : { source: identity, tenant: initialTenant, query: "", view: "all" as const };
  const { tenant, query, view } = currentFilters;
  const reentryTenant = rewardTenant(active?.quote.tenant) || rewardTenant(tenant);
  const reentryPath = normalizeConsumerAuthReturnPath("/me/rewards" + (reentryTenant ? "?tenant=" + encodeURIComponent(reentryTenant) : ""));
  const displayedSnapshot = collection && sameSource(collection.source, identity) ? collection : { items, checkedAt };
  const displayedItems = displayedSnapshot.items;
  const presentation = useRewardPresentationClock(displayedItems, displayedSnapshot.checkedAt);
  const readOwner = useRef({ source: identity, items: displayedItems, checkedAt: displayedSnapshot.checkedAt });
  readOwner.current = { source: identity, items: displayedItems, checkedAt: displayedSnapshot.checkedAt };
  const activeRefresh = refreshState && sameSource(refreshState.source, identity) ? refreshState : null;
  const refreshMessage = activeRefresh && (activeRefresh.phase !== "ready" || presentation.status === "fresh") ? activeRefresh.message : null;
  const refreshing = activeRefresh?.phase === "pending";
  const selectedKey = active?.claimKey ?? selectedVoucher;
  const busy = active?.phase === "pending" || active?.phase === "checking" || refreshing;
  useEffect(() => {
    mounted.current = true;
    owner.current = { items, initialTenant, selectedVoucher };
    sequence.current += 1; controller.current?.abort(); controller.current = null;
    pending.current = false; attempted.current = new Set();
    replaceFlow(null); setCollection(null); setFilters({ source: owner.current, tenant: initialTenant, query: "", view: "all" });
    return () => {
      mounted.current = false; writerFlow.current = null; writerPhase.current = null;
      sequence.current += 1; controller.current?.abort(); controller.current = null; pending.current = false;
    };
  }, [items, initialTenant, selectedVoucher]);
  useEffect(() => {
    refreshSequence.current += 1; refreshController.current?.abort(); refreshController.current = null; refreshPending.current = false;
    setRefreshState(null);
    return () => { refreshSequence.current += 1; refreshController.current?.abort(); refreshController.current = null; refreshPending.current = false; };
  }, [items, checkedAt, initialTenant, selectedVoucher]);
  useEffect(() => { if (active?.phase === "confirm") confirmHeading.current?.focus(); }, [active?.phase, active?.quote.rewardId]);
  const brands = [...new Map(displayedItems.map(item => [item.tenant, item.brand])).entries()];
  const catalogTenant = rewardTenant(tenant);
  const catalogHref = catalogTenant ? "/me/marketplace?tenant=" + encodeURIComponent(catalogTenant) : "/me/marketplace";
  const visible = displayedItems.filter(item => (!tenant || item.tenant === tenant) && (view === "all" || (view === "vouchers" ? item.hasClaim : !item.hasClaim))
    && (item.title + " " + item.brand + " " + (item.program || "")).toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")));
  const filtered = Boolean(tenant || query || view !== "all");
  function changeFilters(patch: Partial<Pick<typeof filters, "tenant" | "query" | "view">>) {
    const changed = (patch.tenant !== undefined && patch.tenant !== currentFilters.tenant)
      || (patch.query !== undefined && patch.query !== currentFilters.query)
      || (patch.view !== undefined && patch.view !== currentFilters.view);
    setFilters({ ...currentFilters, ...patch, source: identity });
    if (changed && !pending.current && active?.phase === "confirm") replaceFlow(null);
  }
  function reset() { changeFilters({ tenant: "", query: "", view: "all" }); searchInput.current?.focus(); }
  function openReservation(item: ConsumerReward, button: HTMLButtonElement) {
    if (!mounted.current || !sameSource(readOwner.current.source, identity)) return;
    const quote = rewardReservationQuote(item);
    if (!quote || pending.current || refreshPending.current || writerPhase.current === "uncertain" || attempted.current.has(quote.rewardId.toLowerCase())) return;
    returnFocus.current = button;
    replaceFlow({ source: identity, quote, phase: "confirm", claimId: null,
      message: "Confirmá la marca, el programa y los puntos antes de reservar." });
  }
  function finishLookup(base: ReservationFlow, result: RewardReservationLookup, claimId: string | null) {
    if (!mounted.current || !sameSource(readOwner.current.source, base.source)) return;
    if ((result.status === "confirmed" || result.status === "not-confirmed") && !retainsRewardClaims(displayedItems, result.items)) {
      presentation.invalidate();
      replaceFlow({ ...base, phase: "uncertain", claimId,
        message: "La consulta no incluyó todos tus vouchers. Conservamos tu historial; comprobá la reserva antes de continuar." });
      return;
    }
    if (result.status === "confirmed") {
      setCollection({ source: base.source, items: result.items, checkedAt: result.checkedAt });
      replaceFlow({ ...base, phase: "confirmed", claimId, claimKey: result.claimKey,
        message: "Tu reserva figura en tu cuenta. Revisá el estado y vencimiento del voucher." });
      setFilters({ source: base.source, tenant: base.quote.tenant, query: "", view: "vouchers" });
    } else if (result.status === "not-confirmed") {
      setCollection({ source: base.source, items: result.items, checkedAt: result.checkedAt });
      replaceFlow({ ...base, phase: "uncertain", claimId,
        message: "No encontramos una reserva confirmada en esta consulta. Podés comprobarla otra vez sin descontar puntos." });
    } else {
      replaceFlow({ ...base, phase: result.status, claimId,
        message: result.status === "authentication-required" ? "Tu sesión venció. Volvé a ingresar para consultar la reserva."
          : result.status === "denied" ? "No tenés acceso para confirmar esta reserva. Consultá con la marca."
          : "No pudimos confirmar el resultado. Comprobá tu reserva antes de hacer otra solicitud." });
    }
  }
  async function confirmReservation() {
    if (!mounted.current || !active || active.phase !== "confirm" || writerFlow.current !== active || !sameSource(readOwner.current.source, active.source)
      || writerPhase.current !== "confirm" || pending.current || refreshPending.current) return;
    const item = displayedItems.find(row => row.id === active.quote.rewardId && row.tenant === active.quote.tenant && !row.hasClaim);
    const currentQuote = item ? rewardReservationQuote(item) : null;
    if (!currentQuote || !sameReservationQuote(active.quote, currentQuote) || attempted.current.has(active.quote.rewardId.toLowerCase())) return;
    const base = active, token = ++sequence.current, abort = new AbortController();
    pending.current = true; attempted.current.add(base.quote.rewardId.toLowerCase()); controller.current = abort;
    const current = () => mounted.current && sequence.current === token && sameSource(owner.current, base.source) && !abort.signal.aborted;
    replaceFlow({ ...base, phase: "pending", message: "Estamos preparando tu reserva. Esperá la confirmación." });
    try {
      const result = await reserveConsumerReward(base.quote, { signal: abort.signal });
      if (!current()) return;
      if (result.status !== "acknowledged") {
        finishLookup(base, { status: result.status }, null); return;
      }
      replaceFlow({ ...base, phase: "checking", claimId: result.claimId, message: "Recibimos la solicitud. Estamos comprobando tu voucher." });
      const lookup = await readConsumerReservation(base.quote, result.claimId, { signal: abort.signal });
      if (current()) finishLookup(base, lookup, result.claimId);
    } finally {
      if (sequence.current === token) { pending.current = false; controller.current = null; }
    }
  }
  async function checkReservation() {
    if (!mounted.current || !active || active.phase !== "uncertain" || writerFlow.current !== active || !sameSource(readOwner.current.source, active.source)
      || pending.current || refreshPending.current) return;
    const base = active, token = ++sequence.current, abort = new AbortController();
    pending.current = true; controller.current = abort;
    replaceFlow({ ...base, phase: "checking", message: "Estamos consultando tu reserva. Esta consulta no descuenta puntos." });
    try {
      const result = await readConsumerReservation(base.quote, base.claimId, { signal: abort.signal });
      if (mounted.current && sequence.current === token && sameSource(owner.current, base.source) && !abort.signal.aborted) finishLookup(base, result, base.claimId);
    } finally {
      if (sequence.current === token) { pending.current = false; controller.current = null; }
    }
  }
  async function refreshVouchers() {
    if (!mounted.current || !sameSource(readOwner.current.source, identity) || refreshPending.current || pending.current
      || writerPhase.current === "pending" || writerPhase.current === "checking" || writerPhase.current === "uncertain") return;
    const base = readOwner.current, token = ++refreshSequence.current, abort = new AbortController();
    refreshPending.current = true; refreshController.current = abort; presentation.invalidate();
    setRefreshState({ source: base.source, phase: "pending", message: "Estamos actualizando tus vouchers. Tu historial se conserva." });
    const current = () => mounted.current && refreshSequence.current === token && !abort.signal.aborted
      && sameSource(readOwner.current.source, base.source) && readOwner.current.items === base.items && readOwner.current.checkedAt === base.checkedAt;
    try {
      const result = await readConsumerRewardsSnapshot({ signal: abort.signal });
      if (!current()) return;
      if (result.status === "ready" && retainsRewardClaims(base.items, result.items)) {
        if (active?.phase === "confirm" && writerFlow.current === active && writerPhase.current === "confirm") {
          const refreshedItem = result.items.find(item => item.id === active.quote.rewardId && item.tenant === active.quote.tenant && !item.hasClaim);
          const refreshedQuote = refreshedItem ? rewardReservationQuote(refreshedItem) : null;
          if (!refreshedQuote || !sameReservationQuote(active.quote, refreshedQuote)) replaceFlow({ ...active, phase: "denied",
            message: "La información de este beneficio cambió. Revisá el costo y volvé a preparar la reserva." });
        }
        setCollection({ source: base.source, items: result.items, checkedAt: result.checkedAt });
        setRefreshState({ source: base.source, phase: "ready", message: "Actualizamos la consulta de tus vouchers." });
      } else {
        setRefreshState({ source: base.source, phase: result.status === "authentication-required" ? "authentication-required" : "failed",
          message: result.status === "authentication-required" ? "Tu sesión venció. Volvé a ingresar para actualizar tus vouchers."
            : result.status === "denied" ? "No tenés acceso para actualizar estos vouchers. Tu historial se conserva; consultá con la marca."
              : result.status === "ready" ? "La consulta no incluyó todos tus vouchers. Conservamos el historial anterior; volvé a actualizar antes de usar un código."
                : "No pudimos actualizar tus vouchers. Tu historial se conserva; volvé a intentarlo antes de usar un código." });
      }
    } finally {
      if (refreshSequence.current === token) { refreshPending.current = false; refreshController.current = null; }
    }
  }
  return <section aria-labelledby="benefits-list-title" className={styles.catalog}>
    <div className={styles.sectionHeading}><div className={styles.headingIcon}><Gift aria-hidden="true" /><div><h2 id="benefits-list-title">Beneficios y vouchers</h2><p>El saldo de cada programa puede ser distinto al de la marca. Consultá los beneficios publicados y tus vouchers.</p></div></div>
      <Link className={styles.textLink} href={catalogHref}>{catalogTenant ? "Catálogo de esta marca" : "Explorar catálogo"} <ArrowUpRight aria-hidden="true" /></Link></div>
    {displayedItems.some(item => item.hasClaim) ? <div className={styles.freshnessNotice} data-testid="voucher-freshness" aria-busy={refreshing}>
      <p><strong>Última consulta</strong><br /><time dateTime={displayedSnapshot.checkedAt}>{rewardDateLabel(displayedSnapshot.checkedAt)}</time></p>
      <p role="status" aria-atomic="true">{refreshMessage ?? (presentation.status === "preparing" ? "Preparando tus vouchers. El código aparece al completar la consulta en esta pantalla."
        : presentation.status === "stale" ? "Tus vouchers siguen registrados. Actualizá la consulta antes de usar un código."
          : "Consultá el estado y vencimiento antes de usar un voucher.")}</p>
      {presentation.status === "stale" && activeRefresh && activeRefresh.phase !== "ready" ? <p>Tus vouchers siguen registrados. Actualizá la consulta antes de usar un código.</p> : null}
      <button type="button" className={styles.copyButton} disabled={busy || active?.phase === "uncertain"} onClick={refreshVouchers}>Actualizar mis vouchers</button>
      {activeRefresh?.phase === "authentication-required" && active?.phase !== "authentication-required" ? <Link className={styles.primaryLink} href={"/login?consumer=1&next=" + encodeURIComponent(reentryPath)}>Volver a ingresar</Link> : null}
    </div> : null}
    {active ? <div className={styles.notice} aria-busy={busy}><p role="status" aria-atomic="true">{active.message}</p>
      {active.phase === "uncertain" ? <button type="button" className={styles.primaryLink} onClick={checkReservation}>Comprobar mi reserva</button> : null}
      {active.phase === "authentication-required" ? <Link className={styles.primaryLink} href={"/login?consumer=1&next=" + encodeURIComponent(reentryPath)}>Volver a ingresar</Link> : null}
      {active.phase === "confirmed" && active.claimKey ? <a className={styles.primaryLink} href={"#voucher-" + active.claimKey}>Ver mi voucher</a> : null}
    </div> : null}
    <div className={styles.filters}>
      <div className={styles.views} role="group" aria-label="Tipo de beneficio">{([['all','Todos'],['vouchers','Mis vouchers'],['catalog','Publicados']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => changeFilters({ view: value })}>{label}</button>)}</div>
      <label className={styles.search}><Search aria-hidden="true" /><span className={styles.srOnly}>Buscar beneficio</span><input ref={searchInput} type="search" value={query} onChange={event => changeFilters({ query: event.target.value })} placeholder="Buscar un beneficio…" /></label>
      <label className={styles.brandFilter}><span className={styles.srOnly}>Filtrar por marca</span><select value={tenant} onChange={event => changeFilters({ tenant: event.target.value })}><option value="">Todas las marcas</option>{initialTenant && !brands.some(([slug]) => slug === initialTenant) ? <option value={initialTenant}>Marca del enlace</option> : null}{brands.map(([slug,name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
    </div>
    <div className={styles.resultLine}><p role="status">{visible.length} {visible.length === 1 ? "registro" : "registros"}{filtered ? " con estos filtros" : " en esta consulta"}</p>{filtered ? <button type="button" onClick={reset}>Limpiar filtros</button> : null}</div>
    {visible.length === 0 ? <div className={styles.empty}><Ticket aria-hidden="true" /><h3>{displayedItems.length === 0 ? "Tus próximos beneficios, acá" : "No hay coincidencias"}</h3><p>{displayedItems.length === 0 ? "Cuando una de tus marcas publique un beneficio o emita un voucher para vos, vas a poder consultarlo en esta sección." : "Probá otra búsqueda o volvé a mostrar todas las marcas."}</p>{filtered ? <button type="button" className={styles.primaryLink} onClick={reset}>Mostrar todos</button> : <Link className={styles.primaryLink} href="/me/brands">Ver mis marcas <ArrowUpRight aria-hidden="true" /></Link>}</div>
      : <div className={styles.cards}>{visible.map(item => {
        const itemPresentation = presentation.inspect(item);
        const presentedState = itemPresentation.expired ? "expired" : item.state;
        const quote = rewardReservationQuote(item);
        const availability = !item.hasClaim && !quote ? rewardAvailabilityNotice(item) : null;
        const nextActions = availability ? rewardNextActions(item, { busy, hasQuote: Boolean(quote) }) : null;
        const confirming = active?.phase === "confirm" && active.quote.rewardId === item.id && active.quote.tenant === item.tenant;
        return <article key={item.key} id={item.hasClaim ? "voucher-" + item.key : undefined} className={styles.rewardCard} data-selected={selectedKey === item.key} data-reward-state={presentedState}>
        <div className={styles.cardTop}><span className={styles.cardIcon}>{item.hasClaim ? <Ticket aria-hidden="true" /> : <Gift aria-hidden="true" />}</span><span className={styles.badge} data-state={presentedState}>{REWARD_STATE_LABELS[presentedState]}</span></div>
        <p className={styles.brandLabel}>{item.brand}</p><h3>{item.title}</h3>{item.program ? <p className={styles.program}>{item.program}</p> : null}
        <div className={styles.cost}><span>{item.hasClaim ? "Puntos del reclamo" : "Costo publicado"}</span><strong>{item.cost === null ? "No informado" : <>{item.cost} <small>pts</small></>}</strong></div>
        <div className={styles.cost} data-benefit-points="program"><span>Saldo actual del programa</span><strong>{item.programBalance == null ? "No informado" : <>{item.programBalance} <small>pts</small></>}</strong></div>
        {availability ? <div className={styles.availabilityNotice}>
          <p><strong>{availability.title}</strong></p><p>{availability.summary ?? availability.messages[0]}</p>
          {availability.messages.length > 1 ? <p className={styles.moreRequirements}>Consultá los {availability.messages.length} requisitos en el detalle.</p> : null}
          {item.reservationNeedsRefresh && !busy ? <a className={styles.copyButton} href={rewardTenant(item.tenant) ? "/me/rewards?tenant=" + encodeURIComponent(item.tenant) : "/me/rewards"}>Volver a cargar la información</a> : null}
        </div> : null}
        {quote ? <button type="button" className={styles.primaryLink} aria-expanded={confirming} disabled={busy || active?.phase === "uncertain" || attempted.current.has(quote.rewardId.toLowerCase())}
          onClick={event => openReservation(item, event.currentTarget)}>Reservar beneficio</button> : null}
        {confirming ? <div className={styles.notice} role="group" aria-labelledby={"reservation-" + item.key}>
          <h4 id={"reservation-" + item.key} ref={confirmHeading} tabIndex={-1} className={styles.confirmationHeading}>Revisá tu reserva</h4>
          <p><strong>{active.quote.title}</strong><br />{active.quote.brand} · {active.quote.program}</p>
          <p>Al confirmar, se descuentan <strong>{active.quote.pointsCost} puntos</strong> de este programa. Tu saldo informado es de {active.quote.programBalance} puntos.</p>
          <button type="button" className={styles.primaryLink} disabled={busy} onClick={confirmReservation}>Confirmar reserva por {active.quote.pointsCost} puntos</button>{" "}
          <button type="button" className={styles.copyButton} onClick={() => { if (!pending.current && !refreshPending.current) { replaceFlow(null); returnFocus.current?.focus(); } }}>Todavía no</button>
        </div> : null}
        <details className={styles.details} open={selectedKey === item.key || undefined}><summary>{item.hasClaim ? "Ver detalle del voucher" : "Ver información"}<ChevronDown aria-hidden="true" /></summary><div className={styles.detailsBody}>
          {item.description ? <p>{item.description}</p> : null}
          {item.hasClaim ? <><dl><dt>Vencimiento</dt><dd>{rewardDateLabel(item.expiresAt)}</dd><dt>Estado registrado</dt><dd>{REWARD_STATE_LABELS[item.state]}</dd></dl>{itemPresentation.code ? <VoucherCode item={item} code={itemPresentation.code} getCode={presentation.getCode} /> : <p>{itemPresentation.status === "preparing" && item.code ? "Preparando el código de tu voucher…" : itemPresentation.status === "stale" && item.code ? "Actualizá la consulta antes de usar el código de este voucher." : item.state === "redeemed" ? "Este voucher ya figura como canjeado. Se conserva en tu historial." : item.state === "cancelled" || presentedState === "expired" ? "Este voucher ya no se presenta como válido para canjear." : "No hay un código vigente confirmado para mostrar. Consultá con la marca antes de usarlo."}</p>}</>
            : quote ? <p>Podés solicitar la reserva con puntos de este programa. Revisá el costo y confirmá antes de continuar.</p>
              : availability ? <><p><strong>{availability.title}</strong></p><ul className={styles.requirements}>{availability.messages.map(message => <li key={message}>{message}</li>)}</ul>
                {nextActions ? <div className={styles.nextSteps} data-testid="reward-next-steps"><h4>Cómo continuar</h4>
                  {nextActions.guidance.map(message => <p key={message}>{message}</p>)}
                  <Link className={styles.copyButton} href={nextActions.href} prefetch={false} aria-label={`${nextActions.label} para ${item.title}`}>{nextActions.label}<ArrowUpRight aria-hidden="true" /></Link>
                </div> : null}</> : null}
        </div></details>
      </article>; })}</div>}
  </section>;
}
