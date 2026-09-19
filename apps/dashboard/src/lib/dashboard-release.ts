export const DASHBOARD_RELEASE='2026.09.19-dashboard.21';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
'es-AR':{
 link:'Novedades y versión',eyebrow:'S3/S5 · expediente de trazabilidad',title:'Del lote a sus relaciones, con evidencia.',
 summary:'Consultá los eventos EPCIS del lote, abrí una agrupación o transformación y seguí los identificadores registrados. Los envíos se vinculan mediante los precintos del lote, no por suposiciones.',
 back:'Abrir lotes',site:'Sitio de nexID',label:'Versión de esta interfaz',changes:'Qué cambió',guide:'Cómo probar esta entrega',
 steps:['Elegí un lote y abrí Trazabilidad con permisos de lectura de lotes y logística.','Consultá un período y, si corresponde, una identidad o tipo de evento.','Abrí un evento para ver objetos, relaciones, cantidades declaradas y referencias.','Seguí otro lote registrado, abrí un envío vinculado o descargá la evidencia.'],
 boundary:'Las relaciones pertenecen al evento elegido: no reconstruyen contenido actual, ubicación GPS ni autenticidad NFC. No se crean movimientos o datos de muestra en producción.',
 cards:[
 {title:'Cronología consultable',text:'Período explícito, momento declarado y momento de registro separados. Los eventos declarados en error conservan su advertencia.',tag:'Evidencia'},
 {title:'Relaciones comprensibles',text:'Padres e hijos, entradas y salidas, alta o desvinculación. El detalle conserva el alcance de la empresa y permite seguir otro lote registrado.',tag:'Trazabilidad'},
 {title:'Envíos realmente vinculados',text:'Acceso al expediente logístico cuando existe un precinto de este lote asociado al envío. No equivale a identificar su contenido.',tag:'Logística'},
 {title:'Exportación de la consulta',text:'HTML, CSV y JSON del mismo resultado. El detalle de un evento tiene su propia evidencia descargable, sin repetir la consulta.',tag:'Operación'}]
},
en:{
 link:'What is new and version',eyebrow:'S3/S5 · traceability dossier',title:'From batches to recorded relationships.',summary:'Read batch EPCIS events, open aggregation or transformation evidence and follow registered identifiers. Shipments are linked by actual seal references.',back:'Open batches',site:'nexID website',label:'Interface version',changes:'Changes',guide:'Get started',
 steps:['Select a batch and open Traceability with batch and logistics read permissions.','Choose a period, event type or registered identity.','Open an event to inspect declared relationships and references.','Follow the related batch, open its linked shipment or export evidence.'],
 boundary:'Relationships describe the selected event, not current contents, GPS location or NFC authenticity. This release creates no production business events.',
 cards:[{title:'Queryable timeline',text:'Declared time and recorded time stay distinct, including source error declarations.',tag:'Evidence'},{title:'Readable relationships',text:'Parent/child and input/output roles with tenant-bound navigation to registered batches.',tag:'Traceability'},{title:'Linked shipments',text:'Only direct shipment-to-batch seal references are shown. This does not identify cargo contents.',tag:'Logistics'},{title:'Snapshot export',text:'HTML, CSV and JSON use the loaded query. Individual event evidence is downloadable without another read.',tag:'Operations'}]
},
'pt-BR':{
 link:'Novidades e versão',eyebrow:'S3/S5 · dossiê de rastreabilidade',title:'Do lote às relações registradas.',summary:'Consulte eventos EPCIS do lote, abra agrupamentos ou transformações e siga identificadores registrados. Envios se vinculam por referências reais de lacres.',back:'Abrir lotes',site:'Site da nexID',label:'Versão da interface',changes:'Mudanças',guide:'Como começar',
 steps:['Selecione o lote e abra Rastreabilidade com permissões de leitura de lotes e logística.','Escolha período, tipo de evento ou identidade registrada.','Abra um evento para consultar relações declaradas e referências.','Siga outro lote, abra o envio vinculado ou exporte a evidência.'],
 boundary:'As relações descrevem o evento selecionado, não conteúdo atual, localização GPS ou autenticidade NFC. A entrega não cria eventos de negócio em produção.',
 cards:[{title:'Cronologia consultável',text:'Horário declarado e registrado separados, mantendo avisos de erro da origem.',tag:'Evidência'},{title:'Relações compreensíveis',text:'Papéis pai/filho e entrada/saída com navegação limitada aos lotes da empresa.',tag:'Rastreabilidade'},{title:'Envios vinculados',text:'Somente referências diretas de lacres do lote ao envio; não identifica a carga.',tag:'Logística'},{title:'Exportação da consulta',text:'HTML, CSV e JSON do resultado carregado. Evidência individual sem outra consulta.',tag:'Operação'}]
}
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
