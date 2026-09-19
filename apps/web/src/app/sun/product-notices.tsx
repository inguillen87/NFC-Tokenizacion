"use client";
import {ShieldAlert,RefreshCw} from 'lucide-react';
import {useSunLocale} from './sun-locale-provider';
import {ProductNoticeProvider,useProductNotices,type NoticeResource} from '../../lib/product-notice-resource';
import type {SunLocale} from './sun-locale';
import styles from './product-notices.module.css';
const resolutions={
 'es-AR':{lifted:'AVISO LEVANTADO',resolution:'Resolución de la empresa',previous:'Ver aviso anterior',boundary:'Se levantó este aviso mediante revisión. No constituye liberación del producto ni certificación de inocuidad.',version:'Versión',updated:'Actualizado'},
 en:{lifted:'NOTICE LIFTED',resolution:'Company resolution',previous:'View previous notice',boundary:'This notice was lifted after review. This does not release the product or certify its safety.',version:'Version',updated:'Updated'},
 'pt-BR':{lifted:'AVISO LEVANTADO',resolution:'Resolução da empresa',previous:'Ver aviso anterior',boundary:'Este aviso foi levantado após revisão. Não libera o produto nem certifica sua segurança.',version:'Versão',updated:'Atualizado'}
} as const;
const labels={
 'es-AR':{title:'Avisos del producto',loading:'Consultando avisos actuales del lote…',unknown:'No se pudieron consultar los avisos del lote. La verificación NFC no determina si el producto tiene restricciones.',empty:'Sin avisos de retiro publicados en esta consulta.',recall:'RETIRO DE LOTE',quarantine:'AVISO DE CUARENTENA',closed:'Seguimiento cerrado. El aviso se conserva; no implica que el producto esté liberado.',separate:'Aviso del producto, independiente de la autenticidad de la etiqueta.',contact:'Contacto de la empresa',issued:'Publicado',checked:'Consultado',refresh:'Actualizar avisos',more:'Hay más avisos registrados. Consultá al responsable antes de utilizar el producto.'},
 'en':{title:'Product notices',loading:'Checking current batch notices…',unknown:'Batch notices could not be checked. NFC verification does not determine whether the product is subject to restrictions.',empty:'No published recall notices in this check.',recall:'BATCH RECALL',quarantine:'QUARANTINE NOTICE',closed:'Follow-up closed. This notice remains; it does not mean the product has been released.',separate:'Product notice, independent of tag authenticity.',contact:'Company contact',issued:'Published',checked:'Checked',refresh:'Refresh notices',more:'More notices are registered. Contact the responsible team before using the product.'},
 'pt-BR':{title:'Avisos do produto',loading:'Consultando avisos atuais do lote…',unknown:'Não foi possível consultar os avisos. A verificação NFC não determina se o produto tem restrições.',empty:'Nenhum aviso de recolhimento publicado nesta consulta.',recall:'RECOLHIMENTO DO LOTE',quarantine:'AVISO DE QUARENTENA',closed:'Acompanhamento encerrado. O aviso permanece; isso não libera o produto.',separate:'Aviso do produto, independente da autenticidade da etiqueta.',contact:'Contato da empresa',issued:'Publicado',checked:'Consultado',refresh:'Atualizar avisos',more:'Há mais avisos registrados. Consulte o responsável antes de utilizar o produto.'}
} as const;
export function ProductNotices({tenant,bid,enabled}:{tenant:string;bid:string;enabled:boolean}){
 const {locale}=useSunLocale();
 return <ProductNoticePanel tenant={tenant} bid={bid} enabled={enabled} locale={locale}/>;
}
export function ProductNoticePanel({tenant,bid,enabled,locale='es-AR'}:{tenant:string;bid:string;enabled:boolean;locale?:SunLocale}){
 const shared=useProductNotices();
 if(!enabled)return null;
 if(shared?.tenant===tenant&&shared.bid===bid&&shared.enabled)return <NoticeContent state={shared} locale={locale}/>;
 return <ProductNoticeProvider key={tenant+':'+bid} tenant={tenant} bid={bid} enabled={enabled}><NoticeConsumer locale={locale}/></ProductNoticeProvider>;
}
function NoticeConsumer({locale}:{locale:SunLocale}){const state=useProductNotices();return state?<NoticeContent state={state} locale={locale}/>:null;}
function NoticeContent({state,locale}:{state:NoticeResource;locale:SunLocale}){
 const copy=labels[locale],resolution=resolutions[locale],value=state.value;
 const notices=value?.notices||[],format=(s:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(s));
 return <section id="product-notices" className={notices.length?styles.notice:styles.compact} aria-label={copy.title} data-testid="product-notices" data-sun-server-evidence="true" data-notice-state={state.loading?'loading':state.failed||!value?'unknown':notices.length?'published':'none'}>
  {state.loading&&<p role="status">{copy.loading}</p>}{!state.loading&&(state.failed||!value)&&<p role="status">{copy.unknown}</p>}{notices.length?<>{notices.map(n=><article key={n.id} className={n.noticeState==='lifted'?styles.lifted:undefined} data-notice-status={n.noticeState}><div className={styles.type}><ShieldAlert size={18} aria-hidden="true"/><strong>{n.noticeState==='lifted'?resolution.lifted:n.kind==='recall'?copy.recall:copy.quarantine}</strong></div><h2>{n.title}</h2>{n.noticeState==='lifted'?<><p className={styles.instructions}><strong>{resolution.resolution}:</strong> {n.resolutionMessage}</p><p>{resolution.boundary}</p><details><summary>{resolution.previous}</summary><p>{n.message}</p><p>{n.instructions}</p><small>{copy.issued}: {format(n.publishedAt)}</small></details></>:<><p>{n.message}</p><p className={styles.instructions}>{n.instructions}</p>{n.trackingState==='closed'&&<p className={styles.closed}>{copy.closed}</p>}</>}<p><strong>{copy.contact}:</strong> {n.contact}</p><small>{resolution.version} {n.noticeVersion} · {resolution.updated}: {format(n.effectiveAt)}</small></article>)}{value?.hasMore&&<p>{copy.more}</p>}<p className={styles.boundary}>{copy.separate}</p></>:!state.loading&&!state.failed&&value?<p>{copy.empty}</p>:null}
  <div className={styles.footer}>{value&&<small>{copy.checked}: {format(value.observedAt)}</small>}<button type="button" onClick={state.refresh} disabled={state.loading}><RefreshCw size={13} aria-hidden="true"/>{copy.refresh}</button></div>
 </section>;
}
