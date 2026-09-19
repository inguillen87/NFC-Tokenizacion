import {STUDIO_FIELDS,getField,readStudioDocument,documentChanged,studioStateLabel,type StudioDocument,type StudioSnapshot} from './passport-studio-contract';
export type ComparisonGroup='identity'|'agro'|'documents'|'metadata'|'consistency';
export type ComparisonKind='added'|'changed'|'removed';
export type EditorialDifference={field:string;label:string;group:ComparisonGroup;kind:ComparisonKind;before:string;after:string;link:boolean};
export type ComparisonSource={key:string;label:string;detail:string;document:StudioDocument|null;local:boolean};
export const COMPARISON_GROUPS:Record<ComparisonGroup,string>={identity:'Identidad',agro:'Producto agro',documents:'Documentos y soporte',metadata:'Plantilla e idioma',consistency:'Datos compartidos agro'};
export const COMPARISON_KINDS:Record<ComparisonKind,string>={added:'Añadido',changed:'Modificado',removed:'Retirado'};
const render=(v:unknown)=>Array.isArray(v)?v.join('\n'):v==null?'':String(v);
const actions:Record<string,string>={save:'guardado',submit:'envío a revisión',approve:'aprobación',request_changes:'cambios solicitados',publish:'publicación',restore:'nueva revisión'};
export function comparisonSources(snapshot:StudioSnapshot,working:StudioDocument):ComparisonSource[]{
 const local=documentChanged(working,snapshot.draft.document),published=snapshot.published;
 const sources:ComparisonSource[]=[
  {key:'published',label:published?published.version===0?'Contenido inicial · sin revisión':`Publicado · v${published.version}`:'Sin versión publicada en esta consulta',detail:'Contenido público recibido de la fuente. No se consulta nuevamente al comparar.',document:published?.document||null,local:false},
  {key:'working',label:local?'Trabajo local · sin guardar':`${studioStateLabel[snapshot.draft.state]} · r${snapshot.draft.revision}`,detail:local?'Incluye cambios sólo de esta pestaña. No están guardados ni aprobados.':'Documento de trabajo recibido de la fuente, con su estado actual.',document:working,local},
  {key:'saved',label:`Guardado en servidor · r${snapshot.draft.revision}`,detail:`Estado: ${studioStateLabel[snapshot.draft.state]}. No incluye cambios locales.`,document:snapshot.draft.document,local:false},
 ];
 const seen=new Set<string>();
 for(const h of snapshot.history){if(seen.has(h.id))throw Error('studio_comparison_history_duplicate');seen.add(h.id);sources.push({key:'history:'+h.id,label:`Historial r${h.version} · ${actions[h.action]||h.action}`,detail:`${h.actorLabel} · ${new Date(h.at).toISOString()}${h.note?' · '+h.note:''}`,document:h.document,local:false});}
 return sources;
}
export function comparisonSource(sources:ComparisonSource[],key:string):ComparisonSource{
 const found=sources.find(s=>s.key===key);if(!found)throw Error('studio_comparison_source_missing');return found;
}
/** Compare the actual allowlisted editorial fields. Never retrieve linked files or infer their contents. */
export function compareEditorialDocuments(before:StudioDocument|null,after:StudioDocument|null,local:{before?:boolean;after?:boolean}={}):EditorialDifference[]{
 const a=before?(local.before?before:readStudioDocument(before)):null,b=after?(local.after?after:readStudioDocument(after)):null,rows:EditorialDifference[]=[];
 function add(field:string,label:string,group:ComparisonGroup,first:unknown,second:unknown,link=false){
  const old=render(first),next=render(second);if(old===next)return;
  rows.push({field,label,group,kind:old===''?'added':next===''?'removed':'changed',before:old,after:next,link});
 }
 for(const f of STUDIO_FIELDS){if(f.group!=='identity'&&!a?.agro_product_profile&&!b?.agro_product_profile)continue;add(f.path,f.label,f.group,a?getField(a,f.path):null,b?getField(b,f.path):null,f.kind==='url');}
 add('template','Plantilla editorial','metadata',a?.template,b?.template);
 add('locale','Idioma del documento','metadata',a?.locale,b?.locale);
 // Mirrored aliases normally change with identity; show them separately only when inconsistent.
 for(const [key,alias,label] of [['product_name','productName','Nombre agro compartido'],['winery','brand','Marca agro compartida'],['sku','sku','SKU agro compartido'],['public_lot_label','batchLot','Lote agro compartido']] as const){
  const inconsistent=(d:StudioDocument|null)=>Boolean(d?.agro_product_profile&&render(d.agro_product_profile[alias])!==render(d.identity[key]));
  if(inconsistent(a)||inconsistent(b))add('agro_product_profile.'+alias,label,'consistency',a?.agro_product_profile?.[alias],b?.agro_product_profile?.[alias]);
 }
 return rows;
}
export function filterEditorialDifferences(rows:EditorialDifference[],group:string,kind:string,query:string){
 if(group!=='all'&&!Object.hasOwn(COMPARISON_GROUPS,group)||kind!=='all'&&!Object.hasOwn(COMPARISON_KINDS,kind))throw Error('studio_comparison_filter_invalid');
 if(typeof query!=='string'||query.length>160)throw Error('studio_comparison_filter_invalid');
 const term=query.trim().toLocaleLowerCase('es');return rows.filter(r=>(group==='all'||r.group===group)&&(kind==='all'||r.kind===kind)&&(!term||[r.label,r.before,r.after].some(s=>s.toLocaleLowerCase('es').includes(term))));
}
