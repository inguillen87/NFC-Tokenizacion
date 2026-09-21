export const DASHBOARD_RELEASE='2026.09.21-dashboard.29';
export const DASHBOARD_RELEASE_DATE='2026-09-21';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'S7a · origen de los TAP en vivo',title:'El origen del evento, separado de su resultado.',
 summary:'El lector de TAP incorpora del canal de producción sólo eventos identificados con origen real. Las importaciones y los eventos sin ese origen explícito quedan fuera; los resultados inválidos o repetidos siguen disponibles para su revisión.',
 back:'Abrir lotes',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Abrí el lector de TAP en tu espacio de trabajo.','Consultá los eventos de origen real y separá su origen del resultado criptográfico.','Revisá también los resultados inválidos o repetidos; el origen real no los convierte en válidos.','Para cerrar un retiro, conciliá declaraciones y comprobantes; otra cuenta autorizada debe aprobarlo.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Origen real explícito',text:'El canal de producción también transporta importaciones. El lector sólo incorpora eventos cuyo origen está identificado como real.',tag:'Origen'},
  {title:'Sin importaciones ambiguas',text:'Los eventos importados o identificados únicamente como producción no se incorporan al lector de TAP.',tag:'Alcance'},
  {title:'Resultados para investigar',text:'Un evento real puede tener resultado inválido o repetido. Se conserva esa evidencia sin presentarla como autenticación válida.',tag:'Evidencia'},
  {title:'Conciliación conservada',text:'Se mantienen los acuses, cantidades, comprobantes y reintentos de la versión .28. Solicitar cierre y aprobarlo siguen siendo acciones independientes.',tag:'Retiros'}]
},
'en':{
 link:'What is new and version',eyebrow:'S7a · live TAP origin',title:'Event origin, separate from its result.',
 summary:'The TAP reader accepts events from the production stream only when their origin is explicitly real. Imports and events without that origin are excluded; invalid or replayed results remain available for review.',
 back:'Open batches',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Open the TAP reader in your workspace.','Review real-origin events separately from their cryptographic result.','Investigate invalid or replayed results too; real origin does not make them valid.','To close a recall, reconcile declarations and references; another authorized account must approve.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Explicit real origin',text:'The production stream also carries imports. The reader accepts only events whose origin is explicitly identified as real.',tag:'Origin'},
  {title:'Imports stay separate',text:'Imported events and events identified only as production do not enter the TAP reader.',tag:'Scope'},
  {title:'Results to investigate',text:'A real event can have an invalid or replayed result. That evidence is retained without presenting it as valid authentication.',tag:'Evidence'},
  {title:'Reconciliation retained',text:'Acknowledgements, quantities, references and retries from version .28 remain available. Requesting closure and approving it remain independent actions.',tag:'Recalls'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'S7a · origem dos TAP ao vivo',title:'A origem do evento, separada do resultado.',
 summary:'O leitor de TAP aceita eventos do canal de produção somente quando a origem é explicitamente real. Importações e eventos sem essa origem ficam de fora; resultados inválidos ou repetidos continuam disponíveis para análise.',
 back:'Abrir lotes',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Abra o leitor de TAP no seu espaço de trabalho.','Consulte eventos de origem real separadamente do resultado criptográfico.','Analise também resultados inválidos ou repetidos; a origem real não os torna válidos.','Para encerrar um recolhimento, concilie declarações e comprovantes; outra conta autorizada deve aprovar.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Origem real explícita',text:'O canal de produção também transporta importações. O leitor aceita somente eventos cuja origem está identificada como real.',tag:'Origem'},
  {title:'Importações separadas',text:'Eventos importados ou identificados apenas como produção não entram no leitor de TAP.',tag:'Alcance'},
  {title:'Resultados para investigar',text:'Um evento real pode ter resultado inválido ou repetido. Essa evidência é mantida sem apresentá-la como autenticação válida.',tag:'Evidência'},
  {title:'Conciliação preservada',text:'Confirmações, quantidades, comprovantes e novas tentativas da versão .28 continuam disponíveis. Solicitar encerramento e aprová-lo continuam sendo ações independentes.',tag:'Recolhimentos'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
