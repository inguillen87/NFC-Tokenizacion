export const DASHBOARD_RELEASE='2026.09.21-dashboard.28';
export const DASHBOARD_RELEASE_DATE='2026-09-21';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'S6 · conciliación de retiros',title:'Qué falta para cerrar, con evidencia.',
 summary:'El seguimiento del retiro reúne acuses, cantidades, responsables y referencias por destino. Revisá las diferencias antes de guardar y la revisión actual antes de solicitar el cierre.',
 back:'Abrir lotes',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Abrí el retiro del lote y entrá a Acuses y cantidades.','Filtrá destinos pendientes o buscá su responsable o comprobante.','Revisá los totales acumulados y la variación antes de registrar cantidades.','Consultá la revisión vigente para solicitar cierre; otra cuenta autorizada debe aprobarlo.'],
 boundary:'Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa las declaraciones y comprobantes del caso, no el número de TAP.',
 cards:[
  {title:'Pendientes por destino',text:'Acuses, devoluciones e inmovilizaciones separados, con filtros locales que no cambian el objetivo del caso.',tag:'Operación'},
  {title:'Correcciones visibles',text:'Antes de guardar ves los totales acumulados, el saldo y cualquier disminución de una cantidad ya declarada.',tag:'Control'},
  {title:'Intentos recuperables',text:'Una respuesta incierta conserva la misma operación. Actualizar o cambiar de caso no descarta su reconciliación.',tag:'Integridad'},
  {title:'Cierre con revisión actual',text:'Se consulta de nuevo el caso antes de confirmar. Un cambio concurrente exige revisar; solicitar y aprobar son acciones distintas.',tag:'Evidencia'}]
},
'en':{
 link:'What is new and version',eyebrow:'S6 · recall reconciliation',title:'Know what remains before closing.',
 summary:'Review acknowledgements, quantities, assignees and references by destination. Check cumulative corrections and the current case revision before requesting closure.',
 back:'Open batches',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Open the batch recall and select Acknowledgements and quantities.','Filter pending destinations or search by assignee or reference.','Review cumulative totals and changes before recording quantities.','Recheck the latest revision before requesting closure; another authorized account must approve.'],
 boundary:'Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses recorded declarations, not TAP counts.',
 cards:[
  {title:'Destination blockers',text:'Acknowledgements, returned and held quantities remain distinct. Local filters never change the case target.',tag:'Operations'},
  {title:'Visible corrections',text:'Review cumulative totals, remaining quantity and any decrease in an earlier declaration before saving.',tag:'Control'},
  {title:'Recoverable attempts',text:'An uncertain response retains the same operation. Refresh and case switching cannot discard its recovery.',tag:'Integrity'},
  {title:'Current closure review',text:'The case is read again before confirmation. Concurrent changes require review and closure approval remains independent.',tag:'Evidence'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'S6 · conciliação de recolhimentos',title:'O que falta para encerrar, com evidência.',
 summary:'Acompanhe confirmações, quantidades, responsáveis e comprovantes por destino. Revise totais acumulados e a versão atual do caso antes de solicitar o encerramento.',
 back:'Abrir lotes',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Abra o recolhimento do lote e entre em Confirmações e quantidades.','Filtre destinos pendentes ou busque responsável ou comprovante.','Revise totais acumulados e diferenças antes de registrar quantidades.','Consulte a revisão atual para solicitar encerramento; outra conta autorizada deve aprovar.'],
 boundary:'Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações registradas, não a contagem de TAP.',
 cards:[
  {title:'Pendências por destino',text:'Confirmações, devoluções e quantidades retidas separadas. Filtros locais não alteram o objetivo do caso.',tag:'Operação'},
  {title:'Correções visíveis',text:'Antes de salvar, veja totais acumulados, saldo e qualquer redução de uma quantidade já declarada.',tag:'Controle'},
  {title:'Tentativas recuperáveis',text:'Uma resposta incerta mantém a mesma operação. Atualizar ou trocar de caso não descarta sua recuperação.',tag:'Integridade'},
  {title:'Revisão atual do encerramento',text:'O caso é consultado novamente antes de confirmar. Mudanças concorrentes exigem revisão e a aprovação é independente.',tag:'Evidência'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
