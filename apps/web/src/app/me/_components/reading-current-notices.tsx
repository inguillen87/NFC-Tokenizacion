"use client";
import {useId,useState} from 'react';
import {ShieldAlert} from 'lucide-react';
import {ProductNoticePanel} from '../../sun/product-notices';
import {publicProductScope} from '../products/product-library-model';
import styles from './reading-current-notices.module.css';
export function ProductReadingHelp(){
 return <details className={styles.help}><summary>¿Necesitás ayuda con este producto?</summary><p>Para avisar a la marca, abrí el pasaporte desde la etiqueta física del producto. Si se necesita una lectura NFC nueva, acercá el teléfono al chip: recargar una lectura guardada no la renueva.</p><p>En el pasaporte, usá «Avisar a la marca» cuando esa opción esté habilitada. Revisá el reporte antes de enviarlo.</p></details>;
}
export function ReadingCurrentNotices({tenant,bid}:{tenant:string|null;bid:string|null}){
 const [openedScope,setOpenedScope]=useState<string|null>(null),scope=publicProductScope({tenantSlug:tenant,batch:bid});
 const scopeKey=scope?JSON.stringify([scope.tenant,scope.bid]):null,open=scopeKey!==null&&openedScope===scopeKey;
 const titleId=useId(),panelId=useId();
 return <section className={styles.root} data-testid="reading-current-notices" aria-labelledby={titleId}><h3 id={titleId}>Avisos actuales del producto</h3><p>El resultado guardado es histórico. Los avisos del lote pueden haber cambiado desde esa lectura.</p>{scope?<><button type="button" onClick={()=>setOpenedScope(scopeKey)} disabled={open} aria-expanded={open} aria-controls={panelId}><ShieldAlert size={18} aria-hidden="true"/>{open?'Avisos actuales de la empresa':'Consultar avisos actuales del producto'}</button><div id={panelId}>{open&&<ProductNoticePanel tenant={scope.tenant} bid={scope.bid} enabled={true}/>}</div></>:<p className={styles.unknown} role="status">No se informó una empresa y un lote válidos para consultar avisos. No se presume que el producto esté libre de restricciones.</p>}<ProductReadingHelp/></section>;
}
