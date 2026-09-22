export const DASHBOARD_RELEASE='2026.09.21-dashboard.31';
export const DASHBOARD_RELEASE_DATE='2026-09-21';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'Soporte por producto',title:'Del reporte a una referencia para atenderlo.',
 summary:'La persona puede describir un problema desde el pasaporte y revisar lo que enviará. La empresa ve la referencia del ticket, el lote, la lectura y el detalle informado. Registrar un reporte no significa que una persona ya lo haya revisado.',
 back:'Abrir atención al cliente',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['En el pasaporte, describí el problema y revisá el reporte antes de confirmar.','Conservá la referencia que aparece cuando el ticket queda registrado.','En Tickets o Señales, buscá esa referencia entre los últimos 300 tickets cargados y leé el detalle.','Si el caso implica cerrar un retiro, otra cuenta autorizada debe revisar y aprobar ese cierre.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Confirmación con referencia',text:'Abrir el formulario no envía nada. La confirmación muestra la referencia del ticket guardado; reintentar el mismo envío recupera esa referencia.',tag:'Reporte'},
  {title:'Problemas legibles',text:'La descripción aparece separada del lote y la lectura. La referencia se puede buscar entre los registros cargados y se conserva al exportar.',tag:'Atención'},
  {title:'Evidencia conservada',text:'El lector sigue exigiendo origen real: las importaciones no se convierten en lecturas físicas. Los resultados inválidos o repetidos conservan su clasificación.',tag:'Lecturas'},
  {title:'Conciliación conservada',text:'Se mantienen los acuses, cantidades, comprobantes y reintentos de la versión .28. Solicitar cierre y aprobarlo siguen siendo acciones independientes.',tag:'Retiros'}]
},
'en':{
 link:'What is new and version',eyebrow:'Product support',title:'A report with a reference for follow-up.',
 summary:'People can describe a problem from the passport and review what they will send. The company sees the ticket reference, batch, reading and reported details. Recording a report does not mean a person has reviewed it.',
 back:'Open customer support',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Describe the problem in the passport and review the report before confirming.','Keep the reference displayed when the ticket is recorded.','In Tickets or Signals, search that reference among the latest 300 loaded tickets and read the details.','If the case involves closing a recall, another authorized account must review and approve that closure.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Confirmation with a reference',text:'Opening the form sends nothing. Confirmation shows the saved ticket reference; retrying the same submission retrieves that reference.',tag:'Report'},
  {title:'Readable problems',text:'The description appears separately from the batch and reading. References can be searched among loaded records and are retained in exports.',tag:'Support'},
  {title:'Evidence retained',text:'The reader still requires real-origin evidence: imports do not become physical readings. Results marked invalid or replayed retain their classification.',tag:'Readings'},
  {title:'Reconciliation retained',text:'Acknowledgements, quantities, references and retries from version .28 remain available. Requesting closure and approving it remain independent actions.',tag:'Recalls'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'Suporte ao produto',title:'Um relato com referência para atendimento.',
 summary:'A pessoa pode descrever um problema no passaporte e revisar o que será enviado. A empresa vê a referência do chamado, o lote, a leitura e os detalhes informados. Registrar um relato não significa que alguém já o analisou.',
 back:'Abrir atendimento ao cliente',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Descreva o problema no passaporte e revise o relato antes de confirmar.','Guarde a referência exibida quando o chamado for registrado.','Em Chamados ou Sinais, busque essa referência entre os últimos 300 chamados carregados e leia os detalhes.','Se o caso envolver encerrar um recolhimento, outra conta autorizada deve revisar e aprovar esse encerramento.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Confirmação com referência',text:'Abrir o formulário não envia nada. A confirmação mostra a referência do chamado salvo; repetir o mesmo envio recupera essa referência.',tag:'Relato'},
  {title:'Problemas legíveis',text:'A descrição aparece separada do lote e da leitura. A referência pode ser buscada nos registros carregados e é preservada nas exportações.',tag:'Atendimento'},
  {title:'Evidência preservada',text:'O leitor continua exigindo origem real: importações não se tornam leituras físicas. Resultados inválidos ou repetidos mantêm sua classificação.',tag:'Leituras'},
  {title:'Conciliação preservada',text:'Confirmações, quantidades, comprovantes e novas tentativas da versão .28 continuam disponíveis. Solicitar encerramento e aprová-lo continuam sendo ações independentes.',tag:'Recolhimentos'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
