/** Public interface release notes; never tenant data or availability certification. */
export const DASHBOARD_RELEASE = "2026.09.17-dashboard.6";
export const DASHBOARD_RELEASE_DATE = "2026-09-17";
export const RELEASE_NOTES = {
  "es-AR": {
    link:"Novedades y versión", eyebrow:"Operación, geografía y evidencia", title:"Un centro de control. Cada dato, en su lugar.",
    summary:"Modo sala para monitores, mapas con procedencia explícita y Analítica histórica separada. Conservamos las herramientas del CRM y la configuración de rollos.",
    back:"Abrir Centro en Vivo", site:"Sitio de nexID", label:"Versión de esta interfaz", changes:"Qué cambió", guide:"Cómo probar esta entrega",
    steps:["Ingresá con tu cuenta y activá Modo sala en el Centro en Vivo.","En el mapa, alterná Teléfono y Red/IP: son evidencias diferentes.","Abrí Analítica para consultar tendencias sin cargar otra copia del mapa.","Hacé un TAP nuevo desde el celular. Compartir ubicación es opcional y requiere permiso."],
    boundary:"Esta página identifica cambios de interfaz, no certifica disponibilidad. Los mapas muestran ubicaciones reportadas de lecturas, no seguimiento GPS continuo de productos, pallets o contenedores.",
    cards:[
      {title:"Centro en Vivo · modo sala",text:"Indicadores compactos, mapa protagonista y últimos eventos en una misma vista. Conserva la fuente, la ventana y las advertencias; salir devuelve el CRM operativo.",tag:"Sala de control"},
      {title:"Teléfono no es Red/IP",text:"Filtrá las ubicaciones compartidas por el teléfono y las estimaciones de conexión. Una IP puede indicar otra ciudad. No se inventan coordenadas ni se reubican lecturas anteriores.",tag:"Verdad geográfica"},
      {title:"Analítica con una función propia",text:"Tendencias e indicadores históricos, sin otra copia del mapa ni solicitudes automáticas a IA. El centro geográfico conserva capas, filtros y evidencia.",tag:"Información ordenada"},
      {title:"TAP móvil con una elección clara",text:"La acción de compartir ubicación aparece antes de los detalles técnicos. Es voluntaria, no impide consultar el producto y solo confirma el guardado tras recibir respuesta del servidor.",tag:"Experiencia móvil"},
    ],
  },
  en: {
    link:"What's new and version",eyebrow:"Operations, geography and evidence",title:"One control center. Clearer evidence.",
    summary:"A display mode for monitors, explicit location sources and separate historical analytics. Existing CRM and roll configuration tools remain available.",
    back:"Open live control center",site:"nexID website",label:"This interface version",changes:"What's changed",guide:"Try this release",
    steps:["Sign in and enable control-room mode in the live center.","Switch between Phone and Network/IP; they represent different evidence.","Open Analytics for historical trends without another map.","Make a new physical tap. Sharing phone location remains optional and requires permission."],
    boundary:"These are interface release notes, not availability certification. Maps show reported reading locations, not continuous GPS tracking of products, pallets or containers.",
    cards:[
      {title:"A live control-room view",text:"Compact metrics, a prominent map and recent events. Source, time window and warnings remain visible. Exiting restores the operational CRM.",tag:"Control room"},
      {title:"Phone is not Network/IP",text:"Separate phone-shared locations from connection estimates. IP location may point to another city. Existing events are not relocated and coordinates are never invented.",tag:"Location evidence"},
      {title:"Historical analytics",text:"Trends and historical indicators without a duplicate map or automatic AI requests. The geographic workspace retains its layers and evidence.",tag:"Clear responsibilities"},
      {title:"An explicit mobile choice",text:"Sharing location appears before technical details. It is optional and does not block the product; saving is confirmed only after the server response.",tag:"Mobile experience"},
    ],
  },
  "pt-BR": {
    link:"Novidades e versão",eyebrow:"Operação, geografia e evidência",title:"Um centro de controle. Evidência clara.",
    summary:"Modo sala para monitores, fontes de localização explícitas e análises históricas separadas. O CRM e a configuração de rolos continuam disponíveis.",
    back:"Abrir centro ao vivo",site:"Site da nexID",label:"Versão desta interface",changes:"O que mudou",guide:"Como testar esta entrega",
    steps:["Entre com sua conta e ative o Modo sala.","Alterne Telefone e Rede/IP; são evidências diferentes.","Abra as análises históricas sem carregar outro mapa.","Faça um novo TAP físico. Compartilhar localização é opcional e requer permissão."],
    boundary:"Estas notas não certificam disponibilidade. Os mapas mostram locais reportados de leituras, não rastreamento GPS contínuo de produtos, pallets ou contêineres.",
    cards:[
      {title:"Centro ao vivo · modo sala",text:"Indicadores compactos, mapa em destaque e últimos eventos. Fonte, período e avisos continuam visíveis. Ao sair, o CRM operacional é restaurado.",tag:"Sala de controle"},
      {title:"Telefone não é Rede/IP",text:"Separe a localização compartilhada do telefone da estimativa de rede, que pode indicar outra cidade. As leituras anteriores não são reposicionadas.",tag:"Evidência geográfica"},
      {title:"Análises históricas separadas",text:"Tendências e indicadores sem duplicar o mapa ou fazer chamadas automáticas de IA. O centro geográfico mantém camadas e evidências.",tag:"Organização"},
      {title:"Uma escolha clara no celular",text:"O botão de localização aparece antes dos detalhes técnicos. É opcional e não bloqueia o produto; a confirmação exige resposta do servidor.",tag:"Experiência móvel"},
    ],
  },
} as const;
export function releaseCopy(locale:string) { return RELEASE_NOTES[locale==="en"||locale==="pt-BR"?locale:"es-AR"]; }
