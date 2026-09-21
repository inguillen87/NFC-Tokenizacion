export const DASHBOARD_RELEASE='2026.09.21-dashboard.30';
export const DASHBOARD_RELEASE_DATE='2026-09-21';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'S7b · lecturas y ubicación',title:'Un mismo criterio para las lecturas reales.',
 summary:'El lector y el CRM comparten evidencia de empresa, lote y etiqueta para identificar las lecturas de origen real. Ese criterio se mantiene al recibir actualizaciones en vivo. Las importaciones, simulaciones e históricos sin evidencia suficiente quedan fuera del panel físico; los resultados inválidos o repetidos siguen disponibles para su revisión.',
 back:'Abrir lotes',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Recorrido de trabajo',
 steps:['Abrí el lector de TAP en tu espacio de trabajo.','Consultá los eventos de origen real y separá su origen del resultado criptográfico.','Revisá también los resultados inválidos o repetidos; el origen real no los convierte en válidos.','Para cerrar un retiro, conciliá declaraciones y comprobantes; otra cuenta autorizada debe aprobarlo.'],
 boundary:'El origen real no certifica el soporte físico, el estado TT ni la autenticidad criptográfica. Cerrar el seguimiento no levanta el aviso, libera producto ni certifica una devolución física. La conciliación usa declaraciones y comprobantes, no el número de TAP.',
 cards:[
  {title:'Lecturas con evidencia',text:'El lector exige origen real y evidencia de registro vinculada a la empresa, lote y etiqueta. Recargar o recibir una actualización aplica el mismo criterio.',tag:'Lecturas'},
  {title:'Ubicación compartida',text:'Analítica incorpora la ubicación aproximada compartida con consentimiento. Conserva la evidencia original y distingue esta ubicación de la aproximación por IP.',tag:'Mapa'},
  {title:'Resultados para investigar',text:'Un evento real puede tener resultado inválido o repetido. Se conserva esa evidencia sin presentarla como autenticación válida.',tag:'Evidencia'},
  {title:'Conciliación conservada',text:'Se mantienen los acuses, cantidades, comprobantes y reintentos de la versión .28. Solicitar cierre y aprobarlo siguen siendo acciones independientes.',tag:'Retiros'}]
},
'en':{
 link:'What is new and version',eyebrow:'S7b · readings and location',title:'One consistent rule for real readings.',
 summary:'The reader and CRM share tenant, batch and tag evidence for events whose origin is explicitly real. Live updates keep that rule. Imports, simulations and historical records without sufficient evidence stay outside the physical panel; invalid or replayed results remain available for review.',
 back:'Open batches',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Workflow',
 steps:['Open the TAP reader in your workspace.','Review real-origin events separately from their cryptographic result.','Investigate invalid or replayed results too; real origin does not make them valid.','To close a recall, reconcile declarations and references; another authorized account must approve.'],
 boundary:'Real origin does not certify the physical carrier, TT state or cryptographic authenticity. Closing tracking does not lift the product notice, release stock or certify physical returns. Reconciliation uses declarations and references, not TAP counts.',
 cards:[
  {title:'Evidence-backed readings',text:'The reader requires real origin and recorded evidence bound to the tenant, batch and tag. Reloads and live updates apply the same rule.',tag:'Readings'},
  {title:'Shared location',text:'Analytics uses approximate location shared with consent. Original evidence is preserved and browser location stays distinct from the IP approximation.',tag:'Map'},
  {title:'Results to investigate',text:'A real event can have an invalid or replayed result. That evidence is retained without presenting it as valid authentication.',tag:'Evidence'},
  {title:'Reconciliation retained',text:'Acknowledgements, quantities, references and retries from version .28 remain available. Requesting closure and approving it remain independent actions.',tag:'Recalls'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'S7b · leituras e localização',title:'Um mesmo critério para as leituras reais.',
 summary:'O leitor e o CRM compartilham evidências de empresa, lote e etiqueta para eventos cuja origem é explicitamente real. As atualizações ao vivo mantêm esse critério. Importações, simulações e históricos sem evidência suficiente ficam fora do painel físico; resultados inválidos ou repetidos continuam disponíveis para análise.',
 back:'Abrir lotes',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Fluxo de trabalho',
 steps:['Abra o leitor de TAP no seu espaço de trabalho.','Consulte eventos de origem real separadamente do resultado criptográfico.','Analise também resultados inválidos ou repetidos; a origem real não os torna válidos.','Para encerrar um recolhimento, concilie declarações e comprovantes; outra conta autorizada deve aprovar.'],
 boundary:'A origem real não certifica o suporte físico, o estado TT nem a autenticidade criptográfica. Encerrar o acompanhamento não retira o aviso, libera produtos nem certifica devoluções físicas. A conciliação usa declarações e comprovantes, não a contagem de TAP.',
 cards:[
  {title:'Leituras com evidência',text:'O leitor exige origem real e evidência de registro vinculada à empresa, lote e etiqueta. Recarregar e receber atualizações aplica o mesmo critério.',tag:'Leituras'},
  {title:'Localização compartilhada',text:'A análise incorpora a localização aproximada compartilhada com consentimento. Preserva a evidência original e distingue essa localização da aproximação por IP.',tag:'Mapa'},
  {title:'Resultados para investigar',text:'Um evento real pode ter resultado inválido ou repetido. Essa evidência é mantida sem apresentá-la como autenticação válida.',tag:'Evidência'},
  {title:'Conciliação preservada',text:'Confirmações, quantidades, comprovantes e novas tentativas da versão .28 continuam disponíveis. Solicitar encerramento e aprová-lo continuam sendo ações independentes.',tag:'Recolhimentos'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
