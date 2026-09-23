export const DASHBOARD_RELEASE='2026.09.23-dashboard.40';
export const DASHBOARD_RELEASE_DATE='2026-09-23';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'Solicitudes de etiquetas',title:'Tu empresa pide. NexID prepara.',
 summary:'Guardá una solicitud con el producto, tipo de etiqueta, cantidad y uso previsto. Cuando esté lista, enviala a NexID y seguí su estado. La preparación técnica queda a cargo de NexID; el envío a fábrica continúa siendo manual.',
 back:'Solicitar etiquetas',href:'/supplier-orders/requests',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Prepará la solicitud con los datos del producto o proyecto. Podés guardar un borrador incompleto y retomarlo.','Elegí el tipo de etiqueta, la cantidad y si será para pruebas o producción. Revisá y enviá la solicitud a NexID.','NexID recibe la solicitud en su bandeja y prepara el pedido técnico con los permisos correspondientes.','El equipo gestiona manualmente el envío al proveedor y las muestras. Solicitar o preparar un pedido no aprueba la fabricación ni activa etiquetas.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Solicitudes guardadas y seguimiento',text:'La empresa solicita sin gestionar chips, lotes ni claves. NexID recibe las solicitudes enviadas y prepara un único pedido por solicitud. Los cambios simultáneos se detectan y el mismo envío puede reintentarse sin duplicar el registro.',tag:'Etiquetas'},
  {title:'Del ticket a su expediente',text:'Abrí un ticket desde la bandeja o su señal sin copiar referencias. La consulta respeta la empresa y tus permisos. Si hay un cambio pendiente o sin confirmar, el expediente conserva ese envío antes de permitir abrir otro caso.',tag:'Atención'},
  {title:'Historial recuperable',text:'La actividad ya confirmada se conserva al cancelar o reintentar una página. Un historial parcial se identifica y permite consultar de nuevo desde el inicio, sin modificar datos.',tag:'Clientes'},
  {title:'Un lote, un contexto',text:'El expediente, pasaporte, etiquetas, enlaces, trazabilidad y retiros conservan la empresa y el lote seleccionados. Los accesos respetan los permisos existentes y no confirman operaciones.',tag:'Operación'},
  {title:'Fuentes y permisos visibles',text:'Cada bandeja distingue datos confirmados, fuente vacía, falta de permiso y error. El reintento conserva la empresa y la sesión; no cambia registros.',tag:'CRM'},
  {title:'Registros del asistente',text:'Las preguntas y notas conservan su significado. Un prospecto no se presenta como conversación respondida; la bandeja no inventa una respuesta de IA ni confirma su entrega.',tag:'Asistente'},
  {title:'Cambios con motivo',text:'Los tickets de soporte pueden pasar a abierto, pendiente o cerrado. Cada cambio conserva la cuenta que lo realizó, el momento y el motivo. Los casos vinculados a incidentes mantienen su gestión específica.',tag:'Seguimiento'},
  {title:'Trabajo compartido',text:'Si otra persona modificó el caso, podés revisar su estado actualizado antes de continuar. Un reintento del mismo envío recupera su confirmación sin duplicar el cambio.',tag:'Equipo'},
  {title:'Evidencia conservada',text:'El lector sigue exigiendo origen real: las importaciones no se convierten en lecturas físicas. Los resultados inválidos o repetidos conservan su clasificación.',tag:'Lecturas'},
  {title:'Conciliación conservada',text:'Se mantienen los acuses, cantidades, comprobantes y reintentos de la versión .28. Solicitar cierre y aprobarlo siguen siendo acciones independientes; otra cuenta autorizada revisa el cierre.',tag:'Retiros'}]
},
'en':{
 link:'What is new and version',eyebrow:'Label requests',title:'Your company requests. NexID prepares.',
 summary:'Save a request with the product, label type, quantity and intended use. Submit it to NexID when ready and follow its status. NexID handles technical preparation; sending the order to the factory remains manual.',
 back:'Request labels',href:'/supplier-orders/requests',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Prepare a request with your product or project details. Save an incomplete draft and return to it later.','Choose the label type, quantity and trial or production use. Review and submit the request to NexID.','NexID receives the submitted request in its inbox and prepares the technical order with the required permissions.','The team manually handles supplier dispatch and samples. Requesting or preparing an order does not approve manufacturing or activate tags.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Saved requests and tracking',text:'The company requests labels without managing chips, batches or keys. NexID receives submitted requests and prepares one order per request. Concurrent changes are detected; the same submission can be retried without creating another record.',tag:'Labels'},
  {title:'From ticket to case details',text:'Open a ticket from its inbox or signal without copying references. The lookup respects your company and permissions. A pending or unconfirmed change stays attached to the case before you can open another ticket.',tag:'Support'},
  {title:'Recoverable history',text:'Previously confirmed activity remains available when a page is canceled or retried. Partial history is identified and can be requested again from the start without changing records.',tag:'Customers'},
  {title:'One batch, one context',text:'The dossier, passport, labels, links, traceability and recalls retain the selected company and batch. Links respect existing permissions and do not confirm operations.',tag:'Operations'},
  {title:'Source and permission states',text:'Each inbox distinguishes confirmed records, empty sources, denied access and errors. Retry keeps the company and session without changing records.',tag:'CRM'},
  {title:'Assistant records',text:'Questions and notes keep their original meaning. A prospect is not shown as an answered conversation; this inbox does not invent an AI answer or confirm delivery.',tag:'Assistant'},
  {title:'Changes with a reason',text:'Support tickets can move to open, pending or closed. Every change retains the account, time and reason. Cases linked to incidents keep their dedicated workflow.',tag:'Follow-up'},
  {title:'Shared work',text:'If someone else changed the case, review its updated status before continuing. Retrying the same submission retrieves its confirmation without duplicating the change.',tag:'Team'},
  {title:'Evidence retained',text:'The reader still requires real-origin evidence: imports do not become physical readings. Results marked invalid or replayed retain their classification.',tag:'Readings'},
  {title:'Reconciliation retained',text:'Acknowledgements, quantities, references and retries from version .28 remain available. Requesting closure and approving it remain independent actions; another authorized account reviews closure.',tag:'Recalls'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'Solicitações de etiquetas',title:'Sua empresa solicita. A NexID prepara.',
 summary:'Salve uma solicitação com produto, tipo de etiqueta, quantidade e uso previsto. Quando estiver pronta, envie à NexID e acompanhe o estado. A NexID cuida da preparação técnica; o envio à fábrica continua manual.',
 back:'Solicitar etiquetas',href:'/supplier-orders/requests',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Prepare a solicitação com os dados do produto ou projeto. Salve um rascunho incompleto e continue depois.','Escolha o tipo de etiqueta, a quantidade e o uso para testes ou produção. Revise e envie à NexID.','A NexID recebe a solicitação na caixa de entrada e prepara o pedido técnico com as permissões necessárias.','A equipe cuida manualmente do envio ao fornecedor e das amostras. Solicitar ou preparar um pedido não aprova a fabricação nem ativa etiquetas.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Solicitações salvas e acompanhamento',text:'A empresa solicita sem gerenciar chips, lotes ou chaves. A NexID recebe as solicitações enviadas e prepara um pedido por solicitação. Alterações simultâneas são detectadas; repetir o mesmo envio não duplica o registro.',tag:'Etiquetas'},
  {title:'Do chamado ao detalhe do caso',text:'Abra um chamado pela caixa ou pelo sinal sem copiar referências. A consulta respeita a empresa e suas permissões. Uma alteração pendente ou não confirmada permanece no caso antes de permitir abrir outro chamado.',tag:'Atendimento'},
  {title:'Histórico recuperável',text:'A atividade confirmada é preservada ao cancelar ou repetir uma página. O histórico parcial é identificado e permite consultar novamente desde o início sem alterar registros.',tag:'Clientes'},
  {title:'Um lote, um contexto',text:'Dossiê, passaporte, etiquetas, links, rastreabilidade e recolhimentos preservam a empresa e o lote selecionados. Os acessos respeitam as permissões existentes e não confirmam operações.',tag:'Operação'},
  {title:'Fontes e permissões visíveis',text:'Cada caixa distingue registros confirmados, fonte vazia, falta de permissão e erro. A nova tentativa conserva a empresa e a sessão; não altera registros.',tag:'CRM'},
  {title:'Registros do assistente',text:'Perguntas e notas mantêm seu significado. Um prospecto não representa uma conversa respondida; a caixa não inventa uma resposta de IA nem confirma sua entrega.',tag:'Assistente'},
  {title:'Mudanças com motivo',text:'Chamados de suporte podem passar para aberto, pendente ou fechado. Cada mudança preserva a conta, o momento e o motivo. Casos vinculados a incidentes mantêm sua gestão específica.',tag:'Acompanhamento'},
  {title:'Trabalho compartilhado',text:'Se outra pessoa alterou o caso, consulte o estado atualizado antes de continuar. Repetir o mesmo envio recupera sua confirmação sem duplicar a mudança.',tag:'Equipe'},
  {title:'Evidência preservada',text:'O leitor continua exigindo origem real: importações não se tornam leituras físicas. Resultados inválidos ou repetidos mantêm sua classificação.',tag:'Leituras'},
  {title:'Conciliação preservada',text:'Confirmações, quantidades, comprovantes e novas tentativas da versão .28 continuam disponíveis. Solicitar encerramento e aprová-lo continuam sendo ações independentes; outra conta autorizada revisa o encerramento.',tag:'Recolhimentos'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
