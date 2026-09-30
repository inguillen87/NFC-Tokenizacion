import {canStudioAction,documentChanged,documentDiff,reviewIssues,STUDIO_FIELDS,type StudioDocument,type StudioSnapshot,type StudioIssue} from './passport-studio-contract';
export type StudioEditingCondition={busy:boolean;uncertain:boolean;conflict:boolean};
export type StudioEditingGuidance={title:string;description:string;stage:'editing'|'review'|'publication';changedFields:number;errorFields:number;warningFields:number;issues:StudioIssue[];sectionErrors:Record<string,number>;independentReviewRequired:boolean};
/** Presentation from the current editorial snapshot and local document; never grants authority. */
export function studioEditingGuidance(snapshot:StudioSnapshot,document:StudioDocument,state:StudioEditingCondition):StudioEditingGuidance{
 const issues=reviewIssues(document),errors=issues.filter(i=>i.severity==='error'),warnings=issues.filter(i=>i.severity==='warning');
 const changedFields=documentDiff(snapshot.draft.document,document).length,dirty=documentChanged(snapshot.draft.document,document);
 const stage=snapshot.draft.state==='in_review'?'review':['approved','published'].includes(snapshot.draft.state)?'publication':'editing';
 const result:StudioEditingGuidance={title:'',description:'',stage,changedFields,errorFields:new Set(errors.map(i=>i.field)).size,warningFields:new Set(warnings.map(i=>i.field)).size,issues,sectionErrors:{},independentReviewRequired:false};
 for(const group of ['identity','agro','documents'])result.sectionErrors[group]=new Set(errors.filter(i=>STUDIO_FIELDS.find(f=>f.path===i.field)?.group===group).map(i=>i.field)).size;
 if(state.busy){result.title='Esperando confirmación del servidor';result.description='No cierres esta pestaña. Todavía no hay un nuevo recibo confirmado.';}
 else if(state.uncertain){result.title='Comprobá la misma operación';result.description='El resultado sigue sin confirmar. Conservamos el intento original; no se habilita otro guardado o publicación.';}
 else if(state.conflict){result.title='Revisá la versión guardada antes de continuar';result.description='La fuente informó un conflicto. Tus cambios siguen en esta pestaña; no se sobrescribió la revisión del servidor.';}
 else if(snapshot.draft.state==='published'){result.title='Esta revisión ya fue publicada';result.description=canStudioAction(snapshot,'reopen',dirty)?'Para modificar el contenido, prepará una nueva revisión. La versión publicada se conserva.':'La cuenta puede consultar esta revisión según sus permisos. No se habilita edición por abrirla.';}
 else if(snapshot.draft.state==='approved'){result.title='Contenido aprobado para publicación';result.description=canStudioAction(snapshot,'publish',dirty)?'Revisá la versión aprobada y confirmá su publicación. Aprobar no cambia por sí solo el contenido público.':'La publicación requiere una cuenta con el permiso correspondiente.';}
 else if(snapshot.draft.state==='in_review'){
  const canApprove=canStudioAction(snapshot,'approve',false);result.independentReviewRequired=!canApprove;
  result.title=canApprove?'Revisá el contenido y decidí':'Revisión independiente pendiente';
  result.description=canApprove?'Compará con lo publicado antes de aprobar o solicitar cambios. La decisión usa la revisión guardada.':'Otra persona autorizada debe aprobar. La creación, edición o envío de esta revisión no habilita la autoaprobación.';
 }
 else if(!snapshot.capabilities.edit){result.title='Contenido en modo consulta';result.description='La edición de este borrador no está habilitada para esta cuenta.';}
 else if(errors.length){result.title='Revisá los campos señalados';result.description='Los errores de formato impiden enviar a revisión. Cada aviso te lleva al campo correspondiente; no se completa contenido por suposición.';}
 else if(dirty){result.title='Guardá los cambios del borrador';result.description='El trabajo local todavía no está guardado. Guardar no publica el pasaporte ni envía la revisión.';}
 else if(snapshot.draft.state==='changes_requested'){result.title='Atendé los cambios solicitados';result.description='Revisá los comentarios del historial y corregí el borrador antes de enviarlo de nuevo.';}
 else{result.title='Borrador listo para solicitar revisión';result.description='No se detectaron errores de formato. Enviá la revisión guardada a otra persona autorizada; esto no certifica exactitud ni cumplimiento.';}
 return result;
}
