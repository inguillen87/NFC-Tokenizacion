export const DASHBOARD_RELEASE='2026.09.21-dashboard.32';
export const DASHBOARD_RELEASE_DATE='2026-09-21';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'Soporte por producto',title:'Encontrá un reporte por su referencia.',
 summary:'La referencia permite recuperar un ticket aunque ya no aparezca entre los registros recientes. Consultá su estado, lote, lectura y descripción dentro de las empresas que tu cuenta puede atender. Encontrar un reporte no significa que alguien ya lo haya revisado.',
 back:'Abrir atención al cliente',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Conservá la referencia que recibiste al confirmar el reporte en el pasaporte.','En Atención al cliente, abrí Tickets y pegá la referencia completa en Buscar por referencia.','Consultá el estado y el detalle del caso. Si la consulta falla, podés reintentarlo con la misma referencia.','Si el caso implica cerrar un retiro, otra cuenta autorizada debe revisar y aprobar ese cierre.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Casos antiguos a mano',text:'La búsqueda por referencia consulta el ticket guardado, incluso cuando quedó fuera de los registros recientes. Los permisos de tu cuenta se aplican también a esta consulta.',tag:'Búsqueda'},
  {title:'Una respuesta clara',text:'El resultado muestra el estado, lote, lectura y descripción. La interfaz distingue un caso no encontrado de una consulta que falló y conserva la referencia para reintentar.',tag:'Atención'},
  {title:'Evidencia conservada',text:'El lector sigue exigiendo origen real: las importaciones no se convierten en lecturas físicas. Los resultados inválidos o repetidos conservan su clasificación.',tag:'Lecturas'},
  {title:'Conciliación conservada',text:'Se mantienen los acuses, cantidades, comprobantes y reintentos de la versión .28. Solicitar cierre y aprobarlo siguen siendo acciones independientes.',tag:'Retiros'}]
},
'en':{
 link:'What is new and version',eyebrow:'Product support',title:'Find a report by its reference.',
 summary:'A reference can retrieve a ticket even after it leaves the recent records. Read its status, batch, reading and description within the companies your account can support. Finding a report does not mean someone has reviewed it.',
 back:'Open customer support',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Keep the reference you received after confirming the report in the passport.','In Customer support, open Tickets and paste the full reference into Find by reference.','Read the status and case details. If the lookup fails, retry with the same reference.','If the case involves closing a recall, another authorized account must review and approve that closure.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Older cases within reach',text:'Reference lookup retrieves the stored ticket, even when it is outside the recent records. Your account permissions also apply to this lookup.',tag:'Lookup'},
  {title:'A clear response',text:'The result shows status, batch, reading and description. The interface distinguishes a missing case from a failed lookup and preserves the reference for retry.',tag:'Support'},
  {title:'Evidence retained',text:'The reader still requires real-origin evidence: imports do not become physical readings. Results marked invalid or replayed retain their classification.',tag:'Readings'},
  {title:'Reconciliation retained',text:'Acknowledgements, quantities, references and retries from version .28 remain available. Requesting closure and approving it remain independent actions.',tag:'Recalls'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'Suporte ao produto',title:'Encontre um relato pela referência.',
 summary:'A referência permite recuperar um chamado mesmo depois de sair dos registros recentes. Consulte seu estado, lote, leitura e descrição nas empresas que sua conta pode atender. Encontrar um relato não significa que alguém já o analisou.',
 back:'Abrir atendimento ao cliente',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Guarde a referência recebida ao confirmar o relato no passaporte.','Em Atendimento ao cliente, abra Chamados e cole a referência completa em Buscar por referência.','Consulte o estado e os detalhes do caso. Se a consulta falhar, tente novamente com a mesma referência.','Se o caso envolver encerrar um recolhimento, outra conta autorizada deve revisar e aprovar esse encerramento.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Casos antigos acessíveis',text:'A busca por referência consulta o chamado salvo, mesmo fora dos registros recentes. As permissões da sua conta também se aplicam à consulta.',tag:'Busca'},
  {title:'Uma resposta clara',text:'O resultado mostra estado, lote, leitura e descrição. A interface distingue um caso não encontrado de uma consulta que falhou e preserva a referência para tentar novamente.',tag:'Atendimento'},
  {title:'Evidência preservada',text:'O leitor continua exigindo origem real: importações não se tornam leituras físicas. Resultados inválidos ou repetidos mantêm sua classificação.',tag:'Leituras'},
  {title:'Conciliação preservada',text:'Confirmações, quantidades, comprovantes e novas tentativas da versão .28 continuam disponíveis. Solicitar encerramento e aprová-lo continuam sendo ações independentes.',tag:'Recolhimentos'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
