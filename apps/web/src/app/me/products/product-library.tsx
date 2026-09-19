"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight,ArrowUpRight,History,Search,ShieldAlert,X,Package,MessageSquareText,ShoppingBag,Clock3,ChevronDown} from 'lucide-react';
import {homeOwnershipLabel,homeProductExperienceHref,homeVerdictLabel,type HomeProduct} from '../_components/consumer-home-model';
import {ConsumerProductImage} from '../_components/me-portal-interactive-client';
import {ProductNoticePanel} from '../../sun/product-notices';
import {filterProductLibrary,productFocus,publicProductScope} from './product-library-model';
import styles from './product-library.module.css';
export function ConsumerProductLibrary({products,focusEvent=null}:{products:HomeProduct[];focusEvent?:string|null}){
 const [search,setSearch]=useState(''),[brand,setBrand]=useState(''),[order,setOrder]=useState('original'),[limit,setLimit]=useState(12),[selected,setSelected]=useState<{index:number;item:HomeProduct}|null>(null);
 const initial=useRef(false);
 useEffect(()=>{if(initial.current)return;initial.current=true;const index=productFocus(products,focusEvent);setSelected(index===null?null:{index,item:products[index]});},[products,focusEvent]);
 const choices=useMemo(()=>Array.from(new Map(products.filter(p=>publicProductScope(p)).map(p=>[p.tenantSlug!,p.brand||p.tenantSlug!])).entries()).sort((a,b)=>a[1].localeCompare(b[1],'es')),[products]);
 const filtered=useMemo(()=>filterProductLibrary(products,search,brand,order),[products,search,brand,order]);
 const resetLimit=()=>setLimit(12);
 return <section className={styles.library} data-testid="consumer-product-library">
  <div className={styles.intro}><div><p className={styles.eyebrow}>TU COLECCIÓN DIGITAL</p><h2>En tu cuenta</h2><p>Encontrá el producto y consultá su lectura, los avisos actuales y la marca.</p></div><span className={styles.count}>{products.length} {products.length===1?'producto en esta lista':'productos en esta lista'}</span></div>
  <div className={styles.filters}><label className={styles.search}><Search size={18} aria-hidden="true"/><span className={styles.srOnly}>Buscar producto, marca o lote</span><input type="search" maxLength={160} value={search} placeholder="Producto, marca o lote" onChange={e=>{setSearch(e.target.value);resetLimit();}}/></label><label>Marca<select value={brand} onChange={e=>{setBrand(e.target.value);resetLimit();}}><option value="">Todas mis marcas</option>{choices.map(([slug,label])=><option value={slug} key={slug}>{label}</option>)}</select></label><label>Orden<select value={order} onChange={e=>{setOrder(e.target.value);resetLimit();}}><option value="original">Orden recibido</option><option value="recent">Lectura más reciente</option><option value="name">Nombre del producto</option></select></label></div>
  <p role="status" className={styles.results}>Mostrando {Math.min(limit,filtered.length)} de {filtered.length} {filtered.length===1?'producto':'productos'} de la lista cargada.</p>
  <div className={styles.grid}>{filtered.slice(0,limit).map(({product:p,index})=><article className={styles.card} key={`${p.eventId||p.batch||'product'}:${index}`}>
   <div className={styles.identity}><ConsumerProductImage product={p}/><div><span className={styles.eyebrow}>{p.brand||'Marca no informada'}</span><h3>{p.name}</h3><p>{p.batch?`Lote ${p.batch}`:'Lote no informado'}</p><span className={styles.badge}>{homeOwnershipLabel(p.ownershipStatus)}</span></div></div>
   <div className={styles.record}><Clock3 size={17} aria-hidden="true"/><div><span>Última lectura reportada</span><strong>{homeVerdictLabel(p.latestVerdict)}</strong><small>{p.latestLocation||'Zona no reportada'}</small></div></div>
   <button type="button" className={styles.primary} onClick={()=>setSelected({index,item:p})} aria-label={`Abrir ficha y avisos de ${p.name}`}><ShieldAlert size={17} aria-hidden="true"/>Abrir ficha y avisos<ArrowRight size={17} aria-hidden="true"/></button>
   <nav className={styles.links} aria-label={`Acciones de ${p.name}`}>
    {p.readingHref?<Link prefetch={false} href={p.readingHref}>Abrir lectura<ArrowUpRight size={15} aria-hidden="true"/></Link>:<Link prefetch={false} href="/me/taps">Consultar historial<History size={15} aria-hidden="true"/></Link>}
    {homeProductExperienceHref(p)&&<Link prefetch={false} href={homeProductExperienceHref(p)!}><MessageSquareText size={15} aria-hidden="true"/>Compartir experiencia</Link>}
    {p.tenantSlug&&<Link prefetch={false} href={`/me/marketplace?tenant=${encodeURIComponent(p.tenantSlug)}`}><ShoppingBag size={15} aria-hidden="true"/>Ver catálogo de la marca</Link>}
   </nav>
   <details className={styles.details}><summary>Datos del registro</summary><dl><div><dt>Guardado en tu cuenta</dt><dd>{p.savedAt.dateTime?<time dateTime={p.savedAt.dateTime}>{p.savedAt.date} UTC</time>:p.savedAt.date}</dd></div><div><dt>Última lectura</dt><dd>{p.latestAt.dateTime?<time dateTime={p.latestAt.dateTime}>{p.latestAt.date} UTC</time>:p.latestAt.date}</dd></div><div><dt>Referencia</dt><dd>{p.eventId?`#${p.eventId}`:'No informada'}</dd></div></dl><p>Un registro guardado no acredita automáticamente titularidad, contenido o custodia física.</p></details>
  </article>)}</div>
  {!filtered.length&&<div className={styles.empty}><Package size={28} aria-hidden="true"/><h3>No hay coincidencias con estos filtros.</h3><button type="button" onClick={()=>{setSearch('');setBrand('');setLimit(12);}}>Restablecer filtros</button></div>}
  {filtered.length>limit&&<button type="button" className={styles.more} onClick={()=>setLimit(n=>n+12)}>Mostrar más productos<ChevronDown size={16} aria-hidden="true"/></button>}
  {selected!==null&&products[selected.index]===selected.item&&<ProductPassportDialog key={selected.index} product={selected.item} onClose={()=>setSelected(null)}/>}
 </section>;
}
export function ProductPassportDialog({product:p,onClose}:{product:HomeProduct;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);const scope=publicProductScope(p);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null,dialog=ref.current;dialog?.showModal();return()=>{dialog?.close();requestAnimationFrame(()=>{if(previous?.isConnected)previous.focus({preventScroll:true});});};},[]);
 return <dialog ref={ref} className={styles.dialog} aria-labelledby="saved-passport-title" onCancel={e=>{e.preventDefault();onClose();}}>
  <header className={styles.dialogHeading}><span className={styles.eyebrow}>PASAPORTE GUARDADO</span><button type="button" aria-label="Cerrar ficha del producto" onClick={onClose}><X size={20} aria-hidden="true"/></button></header>
  <div className={styles.dialogBody}><div className={styles.identity}><ConsumerProductImage product={p}/><div><span className={styles.eyebrow}>{p.brand||'Marca no informada'}</span><h2 id="saved-passport-title">{p.name}</h2><p>{p.batch?`Lote ${p.batch}`:'Lote no informado'}</p></div></div>
   <section className={styles.historyCard} aria-label="Lectura guardada, no actual"><Clock3 size={19} aria-hidden="true"/><div><span>LECTURA GUARDADA · NO ES UN TAP NUEVO</span><strong>{homeVerdictLabel(p.latestVerdict)}</strong><p>{p.latestAt.dateTime?`${p.latestAt.date} UTC`:p.latestAt.date}</p>{p.readingHref&&<Link prefetch={false} href={p.readingHref}>Abrir evidencia de esa lectura<ArrowUpRight size={16} aria-hidden="true"/></Link>}</div></section>
   <section className={styles.liveNotices} aria-labelledby="saved-notices-title"><h3 id="saved-notices-title"><ShieldAlert size={19} aria-hidden="true"/>Avisos actuales de la empresa</h3><p>Esta consulta es independiente del resultado histórico de tu etiqueta.</p>{scope?<ProductNoticePanel tenant={scope.tenant} bid={scope.bid} enabled={true}/>:<p role="status">No se informó una empresa y un lote válidos para consultar avisos. No se presume que el producto esté libre de restricciones.</p>}</section>
   <nav className={styles.dialogActions} aria-label="Acciones de mi pasaporte">{p.tenantSlug&&<Link prefetch={false} className={styles.secondary} href={`/me/marketplace?tenant=${encodeURIComponent(p.tenantSlug)}`}><ShoppingBag size={17} aria-hidden="true"/>Catálogo de la marca</Link>}{homeProductExperienceHref(p)&&<Link prefetch={false} className={styles.secondary} href={homeProductExperienceHref(p)!}><MessageSquareText size={17} aria-hidden="true"/>Compartir experiencia</Link>}<Link prefetch={false} className={styles.secondary} href="/me/privacy">Privacidad y permisos</Link></nav>
   <p className={styles.boundary}>Abrir esta ficha no reclama propiedad ni activa beneficios. La lectura guardada no describe por sí sola el estado actual del envase.</p>
  </div><footer className={styles.dialogFooter}><button type="button" className={styles.primary} onClick={onClose}>Volver a mis productos</button></footer>
 </dialog>;
}
