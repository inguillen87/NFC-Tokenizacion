"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Copy, Gift, Search, Ticket } from "lucide-react";
import { REWARD_STATE_LABELS, rewardDateLabel, type ConsumerReward } from "../_components/consumer-rewards-model";
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

export function ConsumerRewardsClient({ items, initialTenant, selectedVoucher }: { items: ConsumerReward[]; initialTenant: string; selectedVoucher: string | null }) {
  const [tenant, setTenant] = useState(initialTenant);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "vouchers" | "catalog">("all");
  const brands = [...new Map(items.map(item => [item.tenant, item.brand])).entries()];
  const visible = items.filter(item => (!tenant || item.tenant === tenant) && (view === "all" || (view === "vouchers" ? item.hasClaim : !item.hasClaim))
    && `${item.title} ${item.brand} ${item.program || ""}`.toLocaleLowerCase("es-AR").includes(query.trim().toLocaleLowerCase("es-AR")));
  const filtered = Boolean(tenant || query || view !== "all");
  function reset() { setTenant(""); setQuery(""); setView("all"); }
  return <section aria-labelledby="benefits-list-title" className={styles.catalog}>
    <div className={styles.sectionHeading}><div className={styles.headingIcon}><Gift aria-hidden="true" /><div><h2 id="benefits-list-title">Beneficios y vouchers</h2><p>Consultá lo que publicaron tus marcas y el historial de tus vouchers.</p></div></div>
      <Link className={styles.textLink} href="/me/marketplace">Explorar catálogo <ArrowUpRight aria-hidden="true" /></Link></div>
    <div className={styles.filters}>
      <div className={styles.views} role="group" aria-label="Tipo de beneficio">{([['all','Todos'],['vouchers','Mis vouchers'],['catalog','Publicados']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}</div>
      <label className={styles.search}><Search aria-hidden="true" /><span className={styles.srOnly}>Buscar beneficio</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar un beneficio…" /></label>
      <label className={styles.brandFilter}><span className={styles.srOnly}>Filtrar por marca</span><select value={tenant} onChange={event => setTenant(event.target.value)}><option value="">Todas las marcas</option>{initialTenant && !brands.some(([slug]) => slug === initialTenant) ? <option value={initialTenant}>Marca del enlace</option> : null}{brands.map(([slug,name]) => <option key={slug} value={slug}>{name}</option>)}</select></label>
    </div>
    <div className={styles.resultLine}><p role="status">{visible.length} {visible.length === 1 ? "registro" : "registros"}{filtered ? " con estos filtros" : " en esta consulta"}</p>{filtered ? <button type="button" onClick={reset}>Limpiar filtros</button> : null}</div>
    {visible.length === 0 ? <div className={styles.empty}><Ticket aria-hidden="true" /><h3>{items.length === 0 ? "Tus próximos beneficios, acá" : "No hay coincidencias"}</h3><p>{items.length === 0 ? "Cuando una de tus marcas publique un beneficio o emita un voucher para vos, vas a poder consultarlo en esta sección." : "Probá otra búsqueda o volvé a mostrar todas las marcas."}</p>{filtered ? <button type="button" className={styles.primaryLink} onClick={reset}>Mostrar todos</button> : <Link className={styles.primaryLink} href="/me/brands">Ver mis marcas <ArrowUpRight aria-hidden="true" /></Link>}</div>
      : <div className={styles.cards}>{visible.map(item => <article key={item.key} className={styles.rewardCard} data-selected={selectedVoucher === item.key} data-reward-state={item.state}>
        <div className={styles.cardTop}><span className={styles.cardIcon}>{item.hasClaim ? <Ticket aria-hidden="true" /> : <Gift aria-hidden="true" />}</span><span className={styles.badge} data-state={item.state}>{REWARD_STATE_LABELS[item.state]}</span></div>
        <p className={styles.brandLabel}>{item.brand}</p><h3>{item.title}</h3>{item.program ? <p className={styles.program}>{item.program}</p> : null}
        <div className={styles.cost}><span>{item.hasClaim ? "Puntos del reclamo" : "Costo publicado"}</span><strong>{item.cost === null ? "No informado" : <>{item.cost} <small>pts</small></>}</strong></div>
        <details className={styles.details} open={selectedVoucher === item.key || undefined}><summary>{item.hasClaim ? "Ver detalle del voucher" : "Ver información"}<ChevronDown aria-hidden="true" /></summary><div className={styles.detailsBody}>
          {item.description ? <p>{item.description}</p> : null}
          {item.hasClaim ? <><dl><dt>Vencimiento</dt><dd>{rewardDateLabel(item.expiresAt)}</dd><dt>Estado registrado</dt><dd>{REWARD_STATE_LABELS[item.state]}</dd></dl>{item.code ? <VoucherCode code={item.code} /> : <p>{item.state === "redeemed" ? "Este voucher ya figura como canjeado. Se conserva en tu historial." : item.state === "cancelled" || item.state === "expired" ? "Este voucher ya no se presenta como válido para canjear." : "No hay un código vigente confirmado para mostrar. Consultá con la marca antes de usarlo."}</p>}</>
            : <p>El reclamo desde el portal todavía no está habilitado. Publicado no significa reservado; no descontamos puntos al consultar esta información.</p>}
        </div></details>
      </article>)}</div>}
  </section>;
}
