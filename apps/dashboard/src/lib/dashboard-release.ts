export const DASHBOARD_RELEASE='2026.09.19-dashboard.23';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'S3/S5 · registro operativo',title:'Del movimiento al recorrido, sin copiar una API key.',
 summary:'Prepará una recepción, despacho o almacenamiento con datos del lote. También podés revisar un archivo EPCIS del ERP/WMS y registrarlo en el motor existente, con comprobante recuperable.',
 back:'Abrir lotes',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Cómo empezar',
 steps:['Abrí el recorrido de un lote y elegí Registrar movimiento.','Elegí una identidad registrada o cargá un documento EPCIS de hasta 50 eventos.','Validá formato, referencias y alcance antes de confirmar.','Con escritura logística y MFA, confirmá el registro y conservá su comprobante.'],
 boundary:'Son movimientos declarados: no cambian la custodia, el estado del envío, la autenticidad NFC ni el precinto. No se inventan identidades y no se registran eventos por abrir la pantalla.',
 cards:[{title:'Carga guiada',text:'Recepción, despacho o almacenamiento con referencia estable, identidad del lote y fecha explícita. Sin editar JSON en el recorrido básico.',tag:'Operación'},{title:'Archivos con revisión',text:'El archivo se valida completo; los eventos ajenos, repetidos o no admitidos se identifican antes de la confirmación.',tag:'ERP / WMS'},{title:'Registro atómico',text:'Captura, eventos, proyecciones y comprobante comparten el motor existente. Un error intermedio no deja medio archivo guardado.',tag:'Integridad'},{title:'Recuperación del intento',text:'Ante una respuesta perdida se conserva el mismo intento. Los comprobantes propios sobreviven a la recarga y permiten ir al recorrido.',tag:'Evidencia'}]
},
en:{
 link:'What is new and version',eyebrow:'S3/S5 · operational intake',title:'From declared movement to batch journey.',
 summary:'Prepare a receipt, shipment observation or storage event, or review an EPCIS file. Record it through the existing capture engine without copying an API key into the browser.',
 back:'Open batches',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Get started',steps:['Open a batch journey and choose Record movement.','Select a registered identity or upload up to 50 EPCIS events.','Validate references and scope before confirmation.','Confirm with logistics-write authority and MFA, then keep the receipt.'],
 boundary:'These are external declarations, not NFC authentication or custody transitions. Opening the screen creates no identities or business events.',
 cards:[{title:'Guided preparation',text:'Receipt, dispatch or storage with stable reference and explicit time.',tag:'Operations'},{title:'Reviewed files',text:'The whole file is checked for unsupported, duplicate or out-of-scope references.',tag:'ERP / WMS'},{title:'Atomic capture',text:'Events and projections reuse the existing transaction, without a second ledger.',tag:'Integrity'},{title:'Recoverable receipts',text:'Uncertain responses retain the same attempt; confirmed receipts survive reload.',tag:'Evidence'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'S3/S5 · registro operacional',title:'Do movimento declarado ao percurso do lote.',
 summary:'Prepare recebimento, despacho ou armazenamento, ou revise um arquivo EPCIS. Use o motor existente sem copiar uma API key para o navegador.',
 back:'Abrir lotes',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Primeiros passos',steps:['Abra o percurso do lote e selecione Registrar movimentos.','Escolha uma identidade registrada ou um arquivo com até 50 eventos.','Valide referências e escopo antes de confirmar.','Confirme com permissão de escrita logística e MFA; guarde o comprovante.'],
 boundary:'São declarações externas, não autenticação NFC ou mudança de custódia. A tela não cria identidades ou eventos automaticamente.',
 cards:[{title:'Preparação guiada',text:'Recebimento, despacho ou armazenamento com referência estável e data explícita.',tag:'Operação'},{title:'Arquivos revisados',text:'Validação integral de referências, duplicações e escopo da empresa.',tag:'ERP / WMS'},{title:'Captura atômica',text:'Eventos e projeções usam a transação existente, sem outro registro paralelo.',tag:'Integridade'},{title:'Comprovantes recuperáveis',text:'Respostas incertas preservam a tentativa; comprovantes persistem após recarregar.',tag:'Evidência'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
