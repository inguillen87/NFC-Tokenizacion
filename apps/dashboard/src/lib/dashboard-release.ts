/** Public release metadata, without tenant data or operational guarantees. */
export const DASHBOARD_RELEASE="2026.09.18-dashboard.8";
export const DASHBOARD_RELEASE_DATE="2026-09-18";
export const RELEASE_NOTES={
  "es-AR":{
    link:"Novedades y versión",eyebrow:"Del dato a la operación",title:"Un lote. Un expediente. Un recorrido claro.",
    summary:"Producto, unidades, recepciones y lecturas reunidos en el detalle del lote. Menos desplazamiento, acciones según tu rol y consultas solo cuando las necesitás.",
    back:"Abrir rollos y productos",site:"Sitio de nexID",label:"Versión de esta interfaz",changes:"Qué cambió",guide:"Cómo probar esta entrega",
    steps:["Abrí Rollos y productos y seleccioná un lote existente.","Recorré Resumen, Producto, Unidades y recepción, Lecturas y Operación y calidad.","Editá la ficha y cambiá de pestaña: el formulario se conserva en esta página. Guardar requiere confirmación.","En Lecturas, solicitá la muestra del lote. Revisá la fuente y abrí su mapa sin perder el alcance."],
    boundary:"Esta entrega reorganiza herramientas existentes y agrega consultas acotadas. No certifica aceptación industrial, custodia ni un historial completo de cambios. El estado activo no demuestra aprobación de calidad.",
    cards:[
      {title:"Expediente del lote",text:"Identidad, estado, conteos informados y próximos pasos en una vista compacta. Cada pestaña tiene una tarea y conserva los controles autorizados.",tag:"Operación clara"},
      {title:"Formularios que no se pierden al cambiar de pestaña",text:"Las secciones conservan su estado mientras permanecés en la página. No hay guardado silencioso: recargar o salir requiere haber confirmado los cambios.",tag:"Edición controlada"},
      {title:"Unidades y recepciones con contexto",text:"Muestra de hasta 12 unidades e importaciones recientes. Referencias de caja, pallet o contenedor solo cuando están declaradas; sin inventar custodia ni sensores activos.",tag:"Evidencia"},
      {title:"Lecturas del lote, a demanda",text:"Hasta 20 lecturas por consulta, con ventana explícita y permisos verificados. Mensaje, precinto y procedencia de ubicación se presentan por separado.",tag:"Uso responsable"},
    ],
  },
  en:{
    link:"What's new and version",eyebrow:"From data to operations",title:"One batch. One dossier. A clear workflow.",
    summary:"Product details, units, receipts and readings in the existing batch page. Less scrolling, role-based actions and on-demand queries.",
    back:"Open rolls and products",site:"nexID website",label:"This interface version",changes:"What's changed",guide:"Try this release",
    steps:["Open Rolls and products and choose an existing batch.","Explore Summary, Product, Units and intake, Readings, and Operations and quality.","Edit product details and switch tabs; the form stays in this page. Saving still requires confirmation.","Request a reading sample and inspect its location source or open the batch map."],
    boundary:"This release organizes existing tools and adds bounded reads. It does not certify industrial acceptance, custody or a complete revision history. Active status does not prove quality approval.",
    cards:[
      {title:"Batch dossier",text:"Identity, status, reported counts and next steps in a compact view. Each tab has a task and retains authorized controls.",tag:"Clear workflow"},
      {title:"Forms survive tab switches",text:"Sections keep their state while you remain on the page. There is no silent save; confirm changes before reloading or leaving.",tag:"Controlled editing"},
      {title:"Unit and intake evidence",text:"Up to 12 sampled units and recent import records. Box, pallet and container references appear only when declared; no invented custody or live sensors.",tag:"Evidence"},
      {title:"Readings on demand",text:"Up to 20 readings per request with an explicit window and permissions. Message validation, seal state and location provenance remain distinct.",tag:"Responsible usage"},
    ],
  },
  "pt-BR":{
    link:"Novidades e versão",eyebrow:"Do dado à operação",title:"Um lote. Um dossiê. Um fluxo claro.",
    summary:"Produto, unidades, recebimentos e leituras no detalhe do lote. Menos rolagem, ações por perfil e consultas sob demanda.",
    back:"Abrir rolos e produtos",site:"Site da nexID",label:"Versão desta interface",changes:"O que mudou",guide:"Como testar esta entrega",
    steps:["Abra Rolos e produtos e selecione um lote existente.","Navegue por Resumo, Produto, Unidades e recebimento, Leituras e Operação e qualidade.","Edite o produto e troque de aba; o formulário permanece nesta página. Salvar exige confirmação.","Solicite a amostra de leituras e confira sua fonte de localização ou abra o mapa do lote."],
    boundary:"Esta entrega organiza ferramentas existentes e adiciona consultas limitadas. Não certifica aceitação industrial, custódia ou histórico completo de alterações. Um estado ativo não comprova aprovação de qualidade.",
    cards:[
      {title:"Dossiê do lote",text:"Identidade, estado, contagens informadas e próximos passos em uma visão compacta, com ações autorizadas por perfil.",tag:"Operação clara"},
      {title:"Formulários preservados entre abas",text:"As seções mantêm seu estado enquanto você permanece na página. Não há salvamento automático; confirme antes de recarregar ou sair.",tag:"Edição controlada"},
      {title:"Unidades e recebimentos",text:"Até 12 unidades de amostra e importações recentes. Referências logísticas aparecem apenas quando declaradas, sem inventar custódia ou sensores ativos.",tag:"Evidência"},
      {title:"Leituras sob demanda",text:"Até 20 leituras por consulta, com período explícito e permissões. Validação da mensagem, lacre e fonte da localização são apresentados separadamente.",tag:"Uso responsável"},
    ],
  },
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==="en"||locale==="pt-BR"?locale:"es-AR"];}
