import {STUDIO_FIELDS,canStudioAction,documentChanged,documentDiff,getField,parseStudioSnapshot,reviewIssues,studioStateLabel,updateField,type StudioAction,type StudioCommand,type StudioDocument,type StudioSnapshot} from '../../lib/passport-studio-contract';
import {StudioRequestError,validateStudioReply,type StudioReply} from '../../lib/passport-studio-transport';
export type StudioPort={initial:StudioSnapshot;send:(command:StudioCommand,signal?:AbortSignal)=>Promise<StudioReply>;onDirtyChange?:(dirty:boolean)=>void;onSnapshot?:(snapshot:StudioSnapshot)=>void;onReload?:()=>void};
const icons:Record<string,string>={
 book:'M5 4h11l3 3v13H5z M15 4v5h4 M8 12h8 M8 16h5',
 leaf:'M19 4C8 3 3 8 5 15s12 6 14-11Z M5 19l10-10',
 files:'M6 4h10l3 3v13H6z M15 4v5h4 M3 7v14 M9 12h7 M9 16h6',
 changes:'M5 7h13 M14 3l4 4-4 4 M19 17H6 M10 13l-4 4 4 4',
 history:'M4 11a8 8 0 1 1 2 7 M4 4v7h7 M12 7v5l4 2',
 save:'M5 4h12l3 3v13H4V4z M8 4v6h8V4 M8 20v-6h8v6',
 check:'M5 12l4 4L19 6', eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
 arrow:'M5 12h14 M13 6l6 6-6 6', close:'M6 6l12 12 M18 6 6 18', lock:'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
 phone:'M7 2h10v20H7z M10 19h4', warning:'M12 3l10 18H2z M12 9v5 M12 17v1', spark:'M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z'
};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${icons[name]||icons.book}"/></svg>`;
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fieldId=(path:string)=>`ps-${path.replaceAll('.','-')}`;
const display=(v:unknown)=>Array.isArray(v)?v.join('\n'):v==null?'':String(v);
const actionText:Record<StudioAction,string>={save:'Guardar borrador',submit:'Enviar a revisión',request_changes:'Solicitar cambios',approve:'Aprobar contenido',publish:'Publicar esta versión'};
const sectionNames:Record<string,string>={identity:'Identidad del producto',agro:'Datos del producto agro',documents:'Documentos y soporte',changes:'Comparar cambios',history:'Historial disponible'};
function safeImage(raw:unknown){if(typeof raw!=='string')return null;try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}

/** DOM presenter with no storage, timers or permission requests. React bridge mounts this exact tested view. */
export function mountPassportStudio(host:HTMLElement,port:StudioPort){
 let snapshot=parseStudioSnapshot(port.initial,port.initial.scope),form=structuredClone(snapshot.draft.document);
 let group='identity',preview='draft',phoneOnly=false,busy=false,uncertain=false,conflict=false,disposed=false;
 let pending:StudioCommand|null=null,request:AbortController|null=null,restoreId:string|null=null,confirmAction:StudioAction|null=null;
 let status='Sin cambios pendientes.',loadedImage='';let announcedDirty=false;
 const controller=new AbortController();const {signal}=controller;const root=document.createElement('section');root.className='ps-root';host.replaceChildren(root);
 const dirty=()=>documentChanged(form,snapshot.draft.document);
 const editable=()=>snapshot.capabilities.edit&&['draft','changes_requested'].includes(snapshot.draft.state)&&!busy&&!uncertain&&!conflict;
 const buttons=()=>{
  const d=dirty();return `<button type="button" class="ps-btn ps-save" data-action="save" ${!canStudioAction(snapshot,'save',d)||busy||uncertain||conflict?'disabled':''}>${icon('save')}<span>${busy?'Procesando…':'Guardar borrador'}</span></button>`;
 };
 function chrome(){root.innerHTML=`
  <header class="ps-head"><div class="ps-brand">${icon('book')}<div><span class="ps-kicker">PASAPORTES DIGITALES · EDITOR</span><h1>Passport <b>Studio</b></h1></div></div><div class="ps-head-right"><span class="ps-version">${esc(snapshot.scope.tenantLabel)}</span><button type="button" class="ps-btn ps-mobile-view" data-do="mobile">${icon('phone')}Vista previa</button><div data-slot="save"></div></div></header>
  <div class="ps-context"><div><span class="ps-dot"></span><strong>${esc(snapshot.scope.bid)}</strong><span class="ps-separator">/</span><span data-slot="context-name"></span></div><div><span class="ps-chip">${form.template==='agro'?'Agro':'General'}</span><span class="ps-chip">${esc(form.locale)}</span><span class="ps-chip ps-stage" data-slot="stage"></span></div></div>
  <div class="ps-layout"><aside class="ps-rail"><div class="ps-rail-heading">CONTENIDO</div><nav aria-label="Secciones del editor">${[['identity','book','Identidad'],...(form.template==='agro'?[['agro','leaf','Producto agro'],['documents','files','Documentos']]:[]),['changes','changes','Cambios'],['history','history','Historial']].map(([id,ico,label])=>`<button type="button" data-group="${id}" aria-pressed="${group===id}" class="ps-nav">${icon(ico)}<span>${label}</span><span class="ps-nav-count" data-count="${id}"></span></button>`).join('')}</nav><div class="ps-rail-note">${icon('lock')}<strong>Solo contenido editorial</strong><p>No modifica el chip, la autenticidad ni el estado del precinto.</p></div></aside>
  <div class="ps-editor"><div class="ps-editor-top"><div><span class="ps-kicker" data-slot="step"></span><h2 data-slot="section-title"></h2><p data-slot="section-subtitle"></p></div><span class="ps-revision" data-slot="revision"></span></div><div data-slot="validation"></div><div data-slot="fields"></div><div class="ps-editor-foot"><p data-slot="status" role="status" aria-live="polite"></p><div class="ps-actions" data-slot="actions"></div></div></div>
  <aside class="ps-preview-area" aria-label="Vista previa del contenido"><div class="ps-preview-heading"><span>${icon('eye')}Vista móvil</span><span class="ps-chip ps-preview-badge">VISTA PREVIA</span></div><div class="ps-preview-switch" role="group" aria-label="Contenido a previsualizar"><button type="button" data-preview="draft" aria-pressed="true">Borrador</button><button type="button" data-preview="published" aria-pressed="false" ${snapshot.published?'':'disabled'}>${snapshot.published?.version===0?'Referencia inicial':'Publicado'}${snapshot.published&&snapshot.published.version>0?` · v${snapshot.published.version}`:''}</button></div><div class="ps-phone" data-slot="phone" tabindex="0" role="region" aria-label="Contenido de la vista móvil"></div><p class="ps-preview-foot">La vista previa no verifica una etiqueta NFC. No representa una lectura real ni una certificación.</p></aside></div>
  <footer class="ps-footer"><span>${icon('lock')}El pasaporte publicado no cambia al escribir.</span><span data-slot="footer-revision"></span></footer>
  <dialog class="ps-dialog" aria-labelledby="ps-confirm-title"><form method="dialog"><button class="ps-dialog-close" aria-label="Cerrar confirmación" value="cancel">${icon('close')}</button><span class="ps-dialog-icon">${icon('files')}</span><h2 id="ps-confirm-title"></h2><p data-slot="confirm-detail"></p><label class="ps-note-label" hidden>Comentario de revisión<textarea data-review-note maxlength="800" rows="3"></textarea></label><div class="ps-dialog-actions"><button class="ps-btn" value="cancel">Cancelar</button><button class="ps-btn ps-primary" value="confirm">Confirmar</button></div></form></dialog>`;renderSection();refresh();}
 const el=(name:string)=>root.querySelector<HTMLElement>(`[data-slot="${name}"]`)!;
 function refresh(){
  const changed=dirty();if(changed!==announcedDirty){announcedDirty=changed;port.onDirtyChange?.(changed);}
  el('save').innerHTML=buttons();el('stage').textContent=studioStateLabel[snapshot.draft.state];el('revision').textContent=`Revisión ${snapshot.draft.revision}`;
  el('context-name').textContent=form.identity.product_name||'Producto sin nombre';el('footer-revision').textContent=`${changed?'Cambios sin guardar · ':''}${snapshot.published?snapshot.published.version===0?'Referencia inicial · sin publicación Studio':`Publicado v${snapshot.published.version}`:'Aún sin versión publicada'}`;
  el('status').textContent=status;
  const issues=reviewIssues(form),errors=issues.filter(i=>i.severity==='error');
  el('validation').innerHTML=(uncertain?`<div class="ps-notice ps-alert">${icon('warning')}<div><strong>No se confirmó la operación.</strong><p>Conservamos los datos y el mismo identificador. No crees otro intento hasta reconciliar la respuesta.</p><button type="button" class="ps-link" data-do="retry" ${busy?'disabled':''}>Reintentar el mismo intento</button></div></div>`:conflict?`<div class="ps-notice ps-alert">${icon('warning')}<div><strong>Existe una revisión más reciente.</strong><p>Tus cambios siguen en esta pestaña. No se sobrescribió la versión guardada. Actualizá la revisión antes de continuar. Recargar descarta los cambios locales; podés copiarlos primero.</p><button type="button" class="ps-link" data-do="reload">Actualizar revisión</button></div></div>`:!editable()?`<div class="ps-notice">${icon('lock')}<div><strong>${snapshot.draft.state==='published'?'Versión publicada · solo consulta':snapshot.draft.state==='in_review'?'Contenido en revisión':'Edición no disponible'}</strong><p>${snapshot.draft.state==='in_review'?'La revisión usa el contenido guardado. Solo un revisor autorizado e independiente puede aprobarlo.':'El estado y los permisos se confirman en el servidor.'}</p></div></div>`:'');
  const actions=(['submit','request_changes','approve','publish'] as StudioAction[]).filter(a=>canStudioAction(snapshot,a,changed));
  el('actions').innerHTML=actions.map(a=>`<button type="button" class="ps-btn ${a==='request_changes'?'':'ps-primary'}" data-action="${a}" ${busy||uncertain||conflict||((a==='submit'||a==='approve'||a==='publish')&&errors.length)?'disabled':''}>${a==='approve'?icon('check'):icon('arrow')}${actionText[a]}</button>`).join('');
  const diff=documentDiff(snapshot.published?.document||null,form);const count=root.querySelector('[data-count="changes"]');if(count)count.textContent=String(diff.length);
  for(const input of root.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('[data-field]'))input.disabled=!editable();
  renderPreview();
 }
 function renderSection(){
  for(const b of root.querySelectorAll<HTMLElement>('[data-group]'))b.setAttribute('aria-pressed',String(b.dataset.group===group));
  el('step').textContent=group==='changes'?'CONTROL EDITORIAL':group==='history'?'TRAZABILIDAD EDITORIAL':'CONTENIDO DEL PASAPORTE';
  el('section-title').textContent=sectionNames[group];
  el('section-subtitle').textContent=group==='identity'?'Una identidad clara para todas las unidades del lote.':group==='agro'?'Datos declarados por tu empresa, sin completar información técnica por suposición.':group==='documents'?'Vinculá los documentos y canales oficiales. No se descargan ni verifican automáticamente.':group==='changes'?'Antes y después respecto de la versión publicada. Es contenido, no evidencia física.':'Últimos 10 movimientos recibidos de la fuente. Cargar una versión no la publica.';
  if(['identity','agro','documents'].includes(group)){
   const fields=STUDIO_FIELDS.filter(f=>f.group===group);
   el('fields').innerHTML=`<div class="ps-form-grid">${fields.map(f=>{const value=display(getField(form,f.path)),wide=['multiline','list','url'].includes(f.kind||'');return `<label class="ps-field ${wide?'ps-field-wide':''}" for="${fieldId(f.path)}"><span>${esc(f.label)}${f.path==='identity.product_name'?'<b aria-label="obligatorio"> *</b>':''}</span>${['multiline','list'].includes(f.kind||'')?`<textarea id="${fieldId(f.path)}" data-field="${f.path}" aria-describedby="${fieldId(f.path)}-help" rows="3" maxlength="${f.max}" ${!editable()?'disabled':''}>${esc(value)}</textarea>`:`<input id="${fieldId(f.path)}" data-field="${f.path}" aria-describedby="${fieldId(f.path)}-help" type="${f.kind==='date'?'date':f.kind==='url'?'url':'text'}" value="${esc(value)}" maxlength="${f.max}" ${!editable()?'disabled':''} autocomplete="off"/>`}<small id="${fieldId(f.path)}-help" aria-hidden="true">${f.kind==='url'?'HTTPS · enlace externo, no verificado':f.kind==='list'?'Hasta 12 líneas · 180 caracteres por indicación':f.path==='identity.image_url'?'La imagen solo se carga por una acción explícita.':`${value.length} / ${f.max}`}</small></label>`;}).join('')}</div><div class="ps-helper">${icon('spark')}<p>${group==='identity'?'Guardar borrador conserva el trabajo sin modificar lo publicado. El nombre, marca, SKU y lote se mantienen coherentes con el perfil agro.':'Conservamos el texto de tu empresa. NexID no completa instrucciones técnicas ni garantiza la vigencia de un documento por estar enlazado.'}</p></div>`;
  }else if(group==='changes'){
   const diffs=documentDiff(snapshot.published?.document||null,form);const issues=reviewIssues(form);
   el('fields').innerHTML=`<div class="ps-change-summary"><strong>${diffs.length}</strong><span>campos diferentes</span><small>${snapshot.published?snapshot.published.version===0?'Respecto del contenido de referencia inicial':`Respecto de la versión ${snapshot.published.version}`:'Todavía no hay una versión publicada'}</small></div>${issues.length?`<div class="ps-issue-list">${issues.map(i=>`<button type="button" data-error-field="${i.field}" class="ps-issue ${i.severity==='error'?'is-error':''}">${icon('warning')}<span><b>${esc(i.label)}</b>${esc(i.message)}</span></button>`).join('')}</div>`:''}<div class="ps-diff-list">${diffs.map(d=>`<article class="ps-diff"><h3>${esc(d.label)}</h3><div><section><span>${snapshot.published?.version===0?'REFERENCIA INICIAL':'PUBLICADO'}</span><p>${esc(d.before||'Sin contenido')}</p></section><section><span>BORRADOR</span><p>${esc(d.after||'Se elimina el contenido')}</p></section></div></article>`).join('')||'<p class="ps-empty">No hay diferencias con lo publicado.</p>'}</div>`;
  }else{
   el('fields').innerHTML=`<ol class="ps-history">${snapshot.history.map(h=>`<li><span class="ps-history-dot"></span><div><span class="ps-chip">v${h.version} · ${esc(actionText[h.action as StudioAction]||'Versión anterior')}</span><h3>${esc(h.actorLabel)}</h3><time>${esc(new Date(h.at).toLocaleString('es-AR',{timeZone:'UTC'}))} UTC</time><p>${esc(h.document.identity.product_name||'Producto sin nombre')}</p>${h.note?`<p>${esc(h.note)}</p>`:''}<button type="button" class="ps-link" data-restore="${h.id}" ${!editable()?'disabled':''}>Usar contenido en el borrador</button></div></li>`).join('')||'<li class="ps-empty">La fuente no entregó versiones anteriores.</li>'}</ol>`;
  }
 }
 function renderPreview(){
  const doc=preview==='published'?snapshot.published?.document:form;
  for(const b of root.querySelectorAll<HTMLElement>('[data-preview]'))b.setAttribute('aria-pressed',String(b.dataset.preview===preview));
  if(!doc){el('phone').innerHTML='<p class="ps-empty">No hay versión publicada.</p>';return;}
  const i=doc.identity,a=doc.agro_product_profile;
  const published=preview==='published';const image=safeImage(i.image_url),imageEnabled=image&&loadedImage===image;
  el('phone').innerHTML=`<div class="ps-phone-speaker"></div><div class="ps-phone-bar"><strong>nex<span>ID</span></strong><span>${esc(doc.locale)}</span></div><div class="ps-phone-preview-tag">CONTENIDO ${published?(snapshot.published?.version===0?'DE REFERENCIA':'PUBLICADO'):'EN BORRADOR'} · VISTA PREVIA</div><div class="ps-product-art">${imageEnabled?`<img src="${esc(image)}" alt="Imagen declarada del producto" referrerpolicy="no-referrer"/>`:`<div class="ps-package">${icon(doc.template==='agro'?'leaf':'book')}<span>${esc(i.winery||'TU MARCA')}</span><b>${esc(i.product_name||'Tu producto')}</b><i></i></div>`}${image&&!imageEnabled?'<button type="button" data-do="load-image" class="ps-image-button">Cargar imagen externa</button>':''}</div><div class="ps-phone-body"><p class="ps-phone-brand">${esc(i.winery||'Marca pendiente')}</p><h2>${esc(i.product_name||'Nombre del producto')}</h2><div class="ps-phone-specs"><span>LOTE<b>${esc(i.public_lot_label||'No informado')}</b></span><span>REFERENCIA<b>${esc(i.sku||'No informada')}</b></span></div>${a?`<section class="ps-phone-section"><h3>Información del producto</h3>${[['Cultivo',a.crop],['Variedad',a.seedVariety],['Familia',a.productFamily],['Registro declarado',a.registrationNumber],['Vencimiento',a.expirationDate]].filter(([,v])=>Boolean(v)).map(([label,value])=>`<p><span>${esc(label)}</span><b>${esc(value)}</b></p>`).join('')||'<p>Completá los datos del producto.</p>'}</section><section class="ps-phone-section"><h3>Documentación y soporte</h3>${[['Ficha técnica',a.technicalSheetUrl],['Ficha de seguridad',a.safetySheetUrl],['Capacitación',a.trainingUrl]].map(([label,url])=>`<div class="ps-phone-doc">${icon('files')}<div><b>${esc(label)}</b><small>${url?'Enlace declarado · sin verificar':'No vinculado'}</small></div>${icon('arrow')}</div>`).join('')}</section>`:''}<p class="ps-phone-warning">Esta es una vista de contenido. Autenticidad y precinto se muestran únicamente con evidencia de una lectura real.</p></div>`;
 }
 async function run(command:StudioCommand){
  if(busy||disposed)return;busy=true;pending=structuredClone(command);request=new AbortController();status='Esperando confirmación del servidor…';refresh();
  try{
   const reply=await port.send(structuredClone(command),request.signal);if(disposed)return;
   // Transport and presenter independently require a matching, committed response.
   const next=validateStudioReply({ok:true,snapshot:reply.snapshot,receipt:reply.receipt},command,snapshot.actorId).snapshot;
   if(!reply.receipt.committed||reply.receipt.operationId!==command.operationId||reply.receipt.action!==command.action||next.draft.revision!==command.expectedRevision+1||next.draft.id!==command.draftId||next.actorId!==snapshot.actorId)throw new StudioRequestError('studio_receipt_invalid',true);
   snapshot=next;form=structuredClone(snapshot.draft.document);uncertain=false;conflict=false;pending=null;port.onSnapshot?.(structuredClone(snapshot));
   status=command.action==='publish'?'Publicación confirmada por el servidor.':reply.receipt.replayed?'El servidor confirmó el intento anterior; no se duplicó.':command.action==='save'?'Borrador guardado. El pasaporte publicado no cambió.':`${actionText[command.action]}: operación confirmada.`;
  }catch(e){if(disposed)return;uncertain=!(e instanceof StudioRequestError)||e.uncertain;conflict=e instanceof StudioRequestError&&e.code==='studio_revision_conflict';status=conflict?'Conflicto de revisión. Conservamos tus cambios.':e instanceof StudioRequestError&&e.code==='studio_permission_denied'?'La sesión no tiene permiso. No se confirmó ningún cambio.':uncertain?'Resultado incierto. No mostramos un guardado que no fue confirmado.':'La fuente rechazó la operación. Revisá los datos.';}
  finally{busy=false;request=null;if(!disposed){renderSection();refresh();}}
 }
 function openConfirm(action:StudioAction){
  if(busy||uncertain||conflict||!canStudioAction(snapshot,action,dirty()))return;
  const errors=reviewIssues(form).filter(i=>i.severity==='error');if(errors.length&&['submit','approve','publish'].includes(action)){group='changes';renderSection();refresh();return;}
  if(action==='save'){try{parseStudioSnapshot({...snapshot,draft:{...snapshot.draft,document:form}},snapshot.scope);}catch{status='El borrador contiene campos fuera del contrato. Revisá el contenido.';refresh();return;}}
  confirmAction=action;restoreId=null;const dialog=root.querySelector<HTMLDialogElement>('dialog')!;
  root.querySelector('#ps-confirm-title')!.textContent=actionText[action];el('confirm-detail').textContent=action==='publish'?'Esta acción cambia el contenido visible del lote. El servidor debe verificar revisión, aprobación independiente y versión publicada antes de guardar.':action==='save'?'Se guardará una revisión del borrador. No modifica el pasaporte publicado ni las etiquetas.':action==='submit'?'Se enviará el contenido guardado a revisión. Mientras se revisa, el editor queda en modo de consulta.':action==='approve'?'La aprobación corresponde al contenido guardado de esta revisión. No certifica autenticidad NFC ni condiciones físicas.':'La revisión vuelve al editor. Indicá qué necesita corregirse.';
  const note=root.querySelector<HTMLElement>('.ps-note-label')!;note.hidden=action!=='request_changes';root.querySelector<HTMLTextAreaElement>('[data-review-note]')!.value='';dialog.showModal();
 }
 root.addEventListener('input',event=>{
  const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)||!target.dataset.field||!editable())return;
  form=updateField(form,target.dataset.field,target.value);status='Cambios sin guardar. Se conservan en esta pestaña.';refresh();
 },{signal});
 root.addEventListener('click',event=>{
  const target=(event.target as Element).closest<HTMLButtonElement>('button');if(!target||target.disabled)return;
  if(target.dataset.group){group=target.dataset.group;renderSection();refresh();return;}
  if(target.dataset.preview){preview=target.dataset.preview;renderPreview();return;}
  if(target.dataset.action){openConfirm(target.dataset.action as StudioAction);return;}
  if(target.dataset.errorField){const f=STUDIO_FIELDS.find(f=>f.path===target.dataset.errorField);if(f){group=f.group;renderSection();refresh();root.querySelector<HTMLElement>(`#${fieldId(f.path)}`)?.focus();}return;}
  if(target.dataset.restore&&editable()){
   restoreId=target.dataset.restore;confirmAction=null;root.querySelector('#ps-confirm-title')!.textContent='Recuperar contenido en el borrador';el('confirm-detail').textContent='Reemplaza los cambios locales de esta pestaña por la versión elegida. No guarda, aprueba ni publica: después revisá y guardá el borrador.';root.querySelector<HTMLElement>('.ps-note-label')!.hidden=true;root.querySelector<HTMLDialogElement>('dialog')!.showModal();return;
  }
  if(target.dataset.do==='mobile'){phoneOnly=!phoneOnly;root.classList.toggle('ps-phone-only',phoneOnly);target.innerHTML=icon('phone')+(phoneOnly?'Volver al editor':'Vista previa');}
  if(target.dataset.do==='load-image'){loadedImage=String((preview==='published'?snapshot.published?.document:form)?.identity.image_url||'');renderPreview();}
  if(target.dataset.do==='reload')port.onReload?.();
  if(target.dataset.do==='retry'&&pending&&!busy)void run(structuredClone(pending));
 },{signal});
 chrome();
 root.querySelector('dialog')!.addEventListener('close',()=>{
  const dialog=root.querySelector<HTMLDialogElement>('dialog')!;if(dialog.returnValue!=='confirm'){confirmAction=null;restoreId=null;return;}
  if(restoreId){const selected=snapshot.history.find(h=>h.id===restoreId);if(selected&&editable()&&selected.document.template===form.template&&selected.document.locale===form.locale){form=structuredClone(selected.document);status='Versión recuperada localmente. Revisá las diferencias antes de guardar.';group='changes';renderSection();refresh();}else{status='No se puede recuperar una versión de otra plantilla o idioma en este borrador.';refresh();}restoreId=null;return;}
  if(!confirmAction)return;const action=confirmAction;confirmAction=null;
  if(!canStudioAction(snapshot,action,dirty()))return;
  const command:StudioCommand={action,operationId:crypto.randomUUID(),draftId:snapshot.draft.id,expectedRevision:snapshot.draft.revision,expectedContentDigest:snapshot.draft.contentDigest,scope:{tenantId:snapshot.scope.tenantId,batchId:snapshot.scope.batchId}};
  if(action==='save')command.document=structuredClone(form);if(action==='request_changes')command.note=root.querySelector<HTMLTextAreaElement>('[data-review-note]')!.value.trim();void run(command);
 },{signal});
 window.addEventListener('beforeunload',event=>{if(dirty()||busy||uncertain){event.preventDefault();event.returnValue='';}},{signal});
 return {destroy(){disposed=true;controller.abort();request?.abort();root.remove();},getState(){return {snapshot:structuredClone(snapshot),document:structuredClone(form),dirty:dirty(),busy,uncertain,conflict};}};
}
