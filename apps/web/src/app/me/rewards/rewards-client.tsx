"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Gift, Search, Ticket } from "lucide-react";
import { REWARD_STATE_LABELS, rewardAvailabilityNotice, rewardDateLabel, rewardTenant, type ConsumerReward } from "../_components/consumer-rewards-model";
import { readConsumerReservation, reserveConsumerReward, rewardReservationQuote, sameReservationQuote, type RewardReservationLookup, type RewardReservationQuote } from "../_components/consumer-reward-reservation";
import { rewardNextActions } from "../_components/consumer-reward-next-actions";
import { normalizeConsumerAuthReturnPath } from "../../login/consumer-login-continuation";
import styles from "./rewards.module.css";

function VoucherCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setError(false); }
    catch { setCopied(false); setError(true); }
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
const sameSource = (a: RewardSourceIdentity, b: RewardSourceIdentity) => a.items === b.items && a.initialTenant === b.initialTenant && a.selectedVoucher === b.selectedVoucher;

export function ConsumerRewardsClient({ items, checkedAt, initialTenant, selectedVoucher }: RewardSourceIdentity & { checkedAt: string }) {
  const identity = { items, initialTenant, selectedVoucher };
  const [filters, setFilters] = useState({ source: identity, tenant: initialTenant, query: "", view: "all" as "all" | "vouchers" | "catalog" });
  const [flow, setFlow] = useState<ReservationFlow | null>(null);
  const [collection, setCollection] = useState<{ source: RewardSourceIdentity; items: ConsumerReward[]; checkedAt: string } | null>(null);
  const owner = useRef(identity);
  const sequence = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const attempted = useRef(new Set<string>());
  const confirmHeading = useRef<HTMLHeadingElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const active = flow && sameSource(flow.source, identity) ? flow : null;
  const reentryTenant = rewardTenant(active?.quote.tenant);
  const reentryPath = normalizeConsumerAuthReturnPath("/me/rewards" + (reentryTenant ? "?tenant=" + encodeURIComponent(reentryTenant) : ""));
  const currentFilters = sameSource(filters.source, identity) ? filters : { source: identity, tenant: initialTenant, query: "", view: "all" as const };
  const { tenant, query, view } = currentFilters;
  const displayedSnapshot = collection && sameSource(collection.source, identity) ? collection : { items, checkedAt };
  const displayedItems = displayedSnapshot.items;
  const selectedKey = active?.claimKey ?? selectedVoucher;
  const busy = active?.phase === "pending" || active?.phase === "checking";
  useEffect(() => {
    owner.current = { items, initialTenant, selectedVoucher };
    sequence.current += 1; controller.current?.abort(); controller.current = null;
    pending.current = false; attempted.current = new Set();
    setFlow(null); setCollection(null); setFilters({ source: owner.current, tenant: initialTenant, query: "", view: "all" });
    return () => { sequence.current += 1; controller.current?.abort(); controller.current = null; pending.current = false; };
  }, [items, initialTenant, selectedVoucher]);
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
    if (changed && !pending.current) setFlow(current => current?.phase === "confirm" ? null : current);
  }
  function reset() { changeFilters({ tenant: "", query: "", view: "all" }); searchInput.current?.focus(); }
  function openReservation(item: ConsumerReward, button: HTMLButtonElement) {
    const quote = rewardReservationQuote(item);
    if (!quote || pending.current || attempted.current.has(quote.rewardId.toLowerCase())) return;
    returnFocus.current = button;
    setFlow({ source: identity, quote, phase: "confirm", claimId: null,
      message: "Confirmá la marca, el programa y los puntos antes de reservar." });
  }
  function finishLookup(base: ReservationFlow, result: RewardReservationLookup, claimId: string | null) {
    if (result.status === "confirmed") {
      setCollection({ source: base.source, items: result.items, checkedAt: result.checkedAt });
      setFlow({ ...base, phase: "confirmed", claimId, claimKey: result.claimKey,
        message: "Tu reserva figura en tu cuenta. Revisá el estado y vencimiento del voucher." });
      setFilters({ source: base.source, tenant: base.quote.tenant, query: "", view: "vouchers" });
    } else if (result.status === "not-confirmed") {
      setCollection({ source: base.source, items: result.items, checkedAt: result.checkedAt });
      setFlow({ ...base, phase: "uncertain", claimId,
        message: "No encontramos una reserva confirmada en esta consulta. Podés comprobarla otra vez sin descontar puntos." });
    } else {
      setFlow({ ...base, phase: result.status, claimId,
        message: result.status === "authentication-required" ? "Tu sesión venció. Volvé a ingresar para consultar la reserva."
          : result.status === "denied" ? "No tenés acceso para confirmar esta reserva. Consultá con la marca."
          : "No pudimos confirmar el resultado. Comprobá tu reserva antes de hacer otra solicitud." });
    }
  }
  async function confirmReservation() {
    if (!active || active.phase !== "confirm" || pending.current) return;
    const item = displayedItems.find(row => row.id === active.quote.rewardId && row.tenant === active.quote.tenant && !row.hasClaim);
    const currentQuote = item ? rewardReservationQuote(item) : null;
    if (!currentQuote || !sameReservationQuote(active.quote, currentQuote) || attempted.current.has(active.quote.rewardId.toLowerCase())) return;
    const base = active, token = ++sequence.current, abort = new AbortController();
    pending.current = true; attempted.current.add(base.quote.rewardId.toLowerCase()); controller.current = abort;
    const current = () => sequence.current === token && sameSource(owner.current, base.source) && !abort.signal.aborted;
    setFlow({ ...base, phase: "pending", message: "Estamos preparando tu reserva. Esperá la confirmación." });
    try {
      const result = await reserveConsumerReward(base.quote, { signal: abort.signal });
      if (!current()) return;
      if (result.status !== "acknowledged") {
        finishLookup(base, { status: result.status }, null); return;
      }
      setFlow({ ...base, phase: "checking", claimId: result.claimId, message: "Recibimos la solicitud. Estamos comprobando tu voucher." });
      const lookup = await readConsumerReservation(base.quote, result.claimId, { signal: abort.signal });
      if (current()) finishLookup(base, lookup, result.claimId);
    } finally {
      if (sequence.current === token) { pending.current = false; controller.current = null; }
    }
  }
  async function checkReservation() {
    if (!active || active.phase !== "uncertain" || pending.current) return;
    const base = active, token = ++sequence.current, abort = new AbortController();
    pending.current = true; controller.current = abort;
    setFlow({ ...base, phase: "checking", message: "Estamos consultando tu reserva. Esta consulta no descuenta puntos." });
    try {
      const result = await readConsumerReservation(base.quote, base.claimId, { signal: abort.signal });
      if (sequence.current === token && sameSource(owner.current, base.source) && !abort.signal.aborted) finishLookup(base, result, base.claimId);
    } finally {
      if (sequence.current === token) { pending.current = false; controller.current = null; }
    }
  }
  return <section aria-labelledby="benefits-list-title" className={styles.catalog}>
    <div className={styles.sectionHeading}><div className={styles.headingIcon}><Gift aria-hidden="true" /><div><h2 id="benefits-list-title">Beneficios y vouchers</h2><p>El saldo de cada programa puede ser distinto al de la marca. Consultá los beneficios publicados y tus vouchers.</p></div></div>
      <Link className={styles.textLink} href={catalogHref}>{catalogTenant ? "Catálogo de esta marca" : "Explorar catálogo"} <ArrowUpRight aria-hidden="true" /></Link></div>
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
        const quote = rewardReservationQuote(item);
        const availability = !item.hasClaim && !quote ? rewardAvailabilityNotice(item) : null;
        const nextActions = availability ? rewardNextActions(item, { busy, hasQuote: Boolean(quote) }) : null;
        const confirming = active?.phase === "confirm" && active.quote.rewardId === item.id && active.quote.tenant === item.tenant;
        return <article key={item.key} id={item.hasClaim ? "voucher-" + item.key : undefined} className={styles.rewardCard} data-selected={selectedKey === item.key} data-reward-state={item.state}>
        <div className={styles.cardTop}><span className={styles.cardIcon}>{item.hasClaim ? <Ticket aria-hidden="true" /> : <Gift aria-hidden="true" />}</span><span className={styles.badge} data-state={item.state}>{REWARD_STATE_LABELS[item.state]}</span></div>
        <p className={styles.brandLabel}>{item.brand}</p><h3>{item.title}</h3>{item.program ? <p className={styles.program}>{item.program}</p> : null}
        <div className={styles.cost}><span>{item.hasClaim ? "Puntos del reclamo" : "Costo publicado"}</span><strong>{item.cost === null ? "No informado" : <>{item.cost} <small>pts</small></>}</strong></div>
        <div className={styles.cost} data-benefit-points="program"><span>Saldo actual del programa</span><strong>{item.programBalance == null ? "No informado" : <>{item.programBalance} <small>pts</small></>}</strong></div>
        {availability ? <div className={styles.availabilityNotice}>
          <p><strong>{availability.title}</strong></p><p>{availability.summary ?? availability.messages[0]}</p>
          {availability.messages.length > 1 ? <p className={styles.moreRequirements}>Consultá los {availability.messages.length} requisitos en el detalle.</p> : null}
          {item.reservationNeedsRefresh && !busy ? <a className={styles.copyButton} href={rewardTenant(item.tenant) ? "/me/rewards?tenant=" + encodeURIComponent(item.tenant) : "/me/rewards"}>Volver a cargar la información</a> : null}
        </div> : null}
        {quote ? <button type="button" className={styles.primaryLink} aria-expanded={confirming} disabled={busy || attempted.current.has(quote.rewardId.toLowerCase())}
          onClick={event => openReservation(item, event.currentTarget)}>Reservar beneficio</button> : null}
        {confirming ? <div className={styles.notice} role="group" aria-labelledby={"reservation-" + item.key}>
          <h4 id={"reservation-" + item.key} ref={confirmHeading} tabIndex={-1} className={styles.confirmationHeading}>Revisá tu reserva</h4>
          <p><strong>{active.quote.title}</strong><br />{active.quote.brand} · {active.quote.program}</p>
          <p>Al confirmar, se descuentan <strong>{active.quote.pointsCost} puntos</strong> de este programa. Tu saldo informado es de {active.quote.programBalance} puntos.</p>
          <button type="button" className={styles.primaryLink} onClick={confirmReservation}>Confirmar reserva por {active.quote.pointsCost} puntos</button>{" "}
          <button type="button" className={styles.copyButton} onClick={() => { if (!pending.current) { setFlow(null); returnFocus.current?.focus(); } }}>Todavía no</button>
        </div> : null}
        <details className={styles.details} open={selectedKey === item.key || undefined}><summary>{item.hasClaim ? "Ver detalle del voucher" : "Ver información"}<ChevronDown aria-hidden="true" /></summary><div className={styles.detailsBody}>
          {item.description ? <p>{item.description}</p> : null}
          {item.hasClaim ? <><dl><dt>Vencimiento</dt><dd>{rewardDateLabel(item.expiresAt)}</dd><dt>Estado registrado</dt><dd>{REWARD_STATE_LABELS[item.state]}</dd></dl>{item.code ? <VoucherCode code={item.code} /> : <p>{item.state === "redeemed" ? "Este voucher ya figura como canjeado. Se conserva en tu historial." : item.state === "cancelled" || item.state === "expired" ? "Este voucher ya no se presenta como válido para canjear." : "No hay un código vigente confirmado para mostrar. Consultá con la marca antes de usarlo."}</p>}</>
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
