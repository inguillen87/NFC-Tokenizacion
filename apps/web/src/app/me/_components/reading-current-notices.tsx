"use client";
import styles from './reading-current-notices.module.css';
import {useState} from 'react';
import {ShieldAlert} from 'lucide-react';
import {ProductNoticePanel} from '../../sun/product-notices';
import {publicProductScope} from '../products/product-library-model';
export function ReadingCurrentNotices({tenant,bid}:{tenant:string|null;bid:string|null}){
 const [open,setOpen]=useState(false),scope=publicProductScope({tenantSlug:tenant,batch:bid});
 if(!scope)return null;
 return <section className={styles.root} data-testid="reading-current-notices"><button type="button" onClick={()=>setOpen(true)} disabled={open}><ShieldAlert size={18} aria-hidden="true"/>{open?'Avisos actuales de la empresa':'Consultar avisos actuales del producto'}</button><p>El resultado guardado es histórico. Los avisos del lote pueden haber cambiado desde esa lectura.</p>{open&&<ProductNoticePanel tenant={scope.tenant} bid={scope.bid} enabled={true}/>}</section>;
}
