export const DASHBOARD_RELEASE='2026.09.23-dashboard.39';
export const DASHBOARD_RELEASE_DATE='2026-09-23';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'Preparación de pedidos',title:'Del envase al pedido, con menos pasos técnicos.',
 summary:'Elegí un perfil para bolsas, bidones, precintos o UHF y revisá la configuración propuesta antes de guardar. La empresa se completa desde tu sesión; las notas y cantidades se conservan al cambiar de perfil. Los materiales y su desempeño siguen pendientes de validación física.',
 back:'Preparar un pedido',href:'/supplier-orders/create',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Elegí el perfil de envase y aplicalo. Cada construcción requiere su propio pedido.','Indicá nombre, referencia y cantidad; elegí explícitamente pruebas o producción.','Revisá la configuración y los lotes previstos. Crear un pedido NFC seguro genera claves en el servidor y requiere los permisos correspondientes.','Completá después la especificación, las muestras y la recepción del pedido. Crear no aprueba la fabricación ni activa etiquetas.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Configuración guiada por envase',text:'Siete perfiles proponen chip, tecnología y material sin borrar el resto del borrador. UHF exige confirmar el modelo con el proveedor. Los detalles técnicos se despliegan cuando hacen falta; una respuesta incierta pide revisar los pedidos antes de permitir otro envío.',tag:'Fábrica'},
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
 link:'What is new and version',eyebrow:'Order preparation',title:'From packaging to order, with fewer technical steps.',
 summary:'Choose a profile for bags, containers, seals or UHF and review the proposed configuration before saving. Your session supplies the company; notes and quantities survive profile changes. Materials and performance still require physical validation.',
 back:'Prepare an order',href:'/supplier-orders/create',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Choose and apply a packaging profile. Each construction needs its own order.','Enter a name, reference and quantity; explicitly choose trial or production.','Review the configuration and planned batches. Creating a secure NFC order generates keys on the server and requires the corresponding permissions.','Then complete the specification, samples and receiving process. Creation does not approve manufacturing or activate tags.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Guided packaging configuration',text:'Seven profiles propose a chip, technology and material without clearing the rest of the draft. UHF requires a supplier-confirmed chip model. Technical details expand when needed; uncertain responses require checking existing orders before another submission.',tag:'Factory'},
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
 link:'Novidades e versão',eyebrow:'Preparação de pedidos',title:'Da embalagem ao pedido, com menos etapas técnicas.',
 summary:'Escolha um perfil para sacos, recipientes, lacres ou UHF e revise a configuração proposta antes de salvar. A empresa vem da sessão; notas e quantidades são preservadas ao trocar o perfil. Materiais e desempenho ainda exigem validação física.',
 back:'Preparar um pedido',href:'/supplier-orders/create',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Escolha e aplique um perfil de embalagem. Cada construção precisa de um pedido separado.','Informe nome, referência e quantidade; escolha explicitamente testes ou produção.','Revise a configuração e os lotes previstos. Criar um pedido NFC seguro gera chaves no servidor e exige as permissões correspondentes.','Depois complete a especificação, as amostras e o recebimento. Criar não aprova a fabricação nem ativa etiquetas.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Configuração guiada por embalagem',text:'Sete perfis propõem chip, tecnologia e material sem apagar o restante do rascunho. UHF exige o modelo confirmado pelo fornecedor. Os detalhes técnicos aparecem quando necessários; respostas incertas exigem consultar os pedidos antes de outro envio.',tag:'Fábrica'},
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
