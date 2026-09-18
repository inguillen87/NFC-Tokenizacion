/** Public release notes; never a physical or infrastructure certification. */
export const DASHBOARD_RELEASE="2026.09.18-dashboard.9";
export const DASHBOARD_RELEASE_DATE="2026-09-18";
export const RELEASE_NOTES={
  "es-AR":{
    link:"Novedades y versión",eyebrow:"Operación que conserva evidencia",title:"Logística clara. Operaciones consistentes.",summary:"Envíos, precintos y recepción en un espacio más simple. El guardado transaccional y los intentos identificados evitan cambios parciales y duplicaciones de la misma solicitud.",back:"Abrir Logística",site:"Sitio de nexID",label:"Versión de esta interfaz",changes:"Qué cambió",guide:"Cómo probar esta entrega",
    steps:["Abrí Logística y revisá los envíos del alcance autorizado.","Usá Registrar operación para crear, aplicar un precinto, declarar un traspaso o recepción.","Revisá los datos y confirmá. El estado del precinto nunca se supone cerrado si falta información.","Si se pierde la respuesta, conservá el mismo intento identificado y revisá su comprobante antes de iniciar otro."],
    boundary:"Son declaraciones operativas, no prueba criptográfica de contenido o custodia. La deduplicación requiere el mismo identificador, empresa, actor y datos. No se activa seguimiento GPS ni una integración nueva de pago.",
    cards:[
      {title:"Un guardado completo",text:"Envío y partidas se guardan juntos. Las operaciones de precinto guardan estado, evento y recepción/revisión aplicable en una transacción.",tag:"Integridad"},
      {title:"Reintentos identificados",text:"Repetir el mismo intento devuelve el comprobante original. No se reenvía automáticamente ni se cambia la identidad de una operación incierta.",tag:"Consistencia"},
      {title:"Precintos sin supuestos",text:"La ausencia de evidencia no se transforma en cerrado. Un precinto reportado cerrado no oculta otro con apertura o revisión en el mismo envío.",tag:"Evidencia"},
      {title:"Un centro logístico más limpio",text:"Listado, filtros locales y operaciones con confirmación. Cantidades agregadas sin multiplicarlas por los eventos asociados; sin mapas o rutas inventados.",tag:"UX operativa"},
    ],
  },
  en:{
    link:"What's new and version",eyebrow:"Evidence-led operations",title:"Clear logistics. Consistent operations.",summary:"Shipments, seals and receipt declarations in a simpler workspace, backed by transactions and identified retries.",back:"Open Logistics",site:"nexID website",label:"This interface version",changes:"What's changed",guide:"Try this release",
    steps:["Open Logistics and review the authorized shipments.","Choose a shipment or seal operation.","Review and confirm; missing tamper evidence is never treated as closed.","When a response is lost, retain the same identified attempt and review its receipt before starting another."],
    boundary:"Operator declarations do not prove physical custody or contents. Deduplication requires the same operation identity, tenant, actor and data. No continuous GPS or new paid integration is enabled.",
    cards:[
      {title:"Atomic persistence",text:"Shipment items and their header commit together. Seal changes, handling evidence and applicable recipient records commit in one transaction.",tag:"Integrity"},
      {title:"Identified retries",text:"The same attempt returns its original receipt. Uncertain operations are not automatically resent under a new identity.",tag:"Consistency"},
      {title:"No assumed closed seals",text:"Missing evidence remains unknown. One closed seal cannot conceal a second seal reported opened or requiring review.",tag:"Evidence"},
      {title:"A focused workspace",text:"Local search, explicit confirmation and corrected quantities without join multiplication. No invented routes or shipment locations.",tag:"Operations UX"},
    ],
  },
  "pt-BR":{
    link:"Novidades e versão",eyebrow:"Operação com evidência",title:"Logística clara. Operações consistentes.",summary:"Envios, lacres e recebimentos em um espaço mais simples, com transações e tentativas identificadas.",back:"Abrir Logística",site:"Site da nexID",label:"Versão desta interface",changes:"O que mudou",guide:"Como testar esta entrega",
    steps:["Abra Logística e confira os envios autorizados.","Escolha criar, aplicar lacre, declarar transferência ou recebimento.","Revise e confirme. Sem evidência, o lacre não é considerado fechado.","Se perder a resposta, mantenha a mesma tentativa e confira o comprovante antes de iniciar outra."],
    boundary:"Declarações operacionais não comprovam conteúdo ou custódia física. A deduplicação exige o mesmo identificador, empresa, ator e dados. Não ativa GPS contínuo nem integrações pagas.",
    cards:[
      {title:"Gravação completa",text:"Envio e itens são gravados juntos. Alterações de lacres, eventos e registros de recebimento aplicáveis usam uma transação.",tag:"Integridade"},
      {title:"Tentativas identificadas",text:"Repetir a mesma tentativa devolve o comprovante original. Operações incertas não são reenviadas automaticamente com outra identidade.",tag:"Consistência"},
      {title:"Lacres sem suposições",text:"A falta de evidência continua desconhecida. Um lacre fechado não oculta outro aberto ou que exige revisão no mesmo envio.",tag:"Evidência"},
      {title:"Centro logístico organizado",text:"Pesquisa local, ações confirmadas e quantidades sem multiplicação por eventos. Sem inventar mapas ou rotas de envio.",tag:"UX operacional"},
    ],
  },
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==="en"||locale==="pt-BR"?locale:"es-AR"];}
