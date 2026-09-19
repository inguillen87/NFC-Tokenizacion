import type {HomeProduct} from '../_components/consumer-home-model';
export function publicProductScope(product:Pick<HomeProduct,'tenantSlug'|'batch'>):{tenant:string;bid:string}|null{
 const tenant=product.tenantSlug,bid=product.batch;
 return typeof tenant==='string'&&/^[a-z0-9][a-z0-9._-]{0,119}$/.test(tenant)&&typeof bid==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid)?{tenant,bid}:null;
}
const normalize=(v:string)=>v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export function filterProductLibrary(products:HomeProduct[],query:string,brand:string,order:string){
 const q=normalize(query).slice(0,160);
 return products.map((product,index)=>({product,index})).filter(({product:p})=>(!brand||p.tenantSlug===brand)&&(!q||normalize([p.name,p.brand,p.batch].filter(Boolean).join(' ')).includes(q))).sort((a,b)=>order==='name'?a.product.name.localeCompare(b.product.name,'es')||a.index-b.index:order==='recent'?(Date.parse(b.product.latestAt.dateTime||b.product.savedAt.dateTime||'')||0)-(Date.parse(a.product.latestAt.dateTime||a.product.savedAt.dateTime||'')||0)||a.index-b.index:a.index-b.index);
}
export function productFocus(products:HomeProduct[],eventId:unknown):number|null{
 if(typeof eventId!=='string'||!/^[1-9][0-9]{0,18}$/.test(eventId))return null;
 const matching=products.map((p,index)=>({p,index})).filter(({p})=>p.eventId===eventId);
 return matching.length===1?matching[0].index:null;
}
