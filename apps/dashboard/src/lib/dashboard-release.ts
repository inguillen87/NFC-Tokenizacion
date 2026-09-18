/** Public interface release notes. */
export const DASHBOARD_RELEASE = "2026.09.18-dashboard.7";
export const DASHBOARD_RELEASE_DATE = "2026-09-18";
export const RELEASE_NOTES = {
  "es-AR": {
    link:"Novedades y versión",eyebrow:"Operación con evidencia",title:"Más control. Menos incertidumbre.",
    summary:"Uso y estado reúne fuentes operativas, revisión por servicio y consumo SDK bajo demanda. El mapa, el Modo sala y la configuración de rollos se conservan.",
    back:"Abrir Centro en Vivo",site:"Sitio de nexID",label:"Versión de esta interfaz",changes:"Qué cambió",guide:"Cómo probar esta entrega",
    steps:["Desde tu perfil o el menú lateral, abrí Uso y estado.","Elegí empresa y ventana. Una fuente no disponible no se muestra como cero actividad.","Abrí un servicio para revisar su muestra, definición y guía de respuesta.","Consultá el uso SDK cuando lo necesites o descargá un resumen para soporte si tu rol lo permite."],
    boundary:"Estas notas no certifican disponibilidad ni costos. El módulo usa agregados guardados: no mide todos los fallos anteriores a la base ni conecta facturas o límites monetarios del proveedor.",
    cards:[
      {title:"Uso y estado por servicio",text:"Lecturas guardadas, integridad de eventos, webhooks, incidentes y colas. Cada resultado muestra su alcance; los datos desconocidos permanecen desconocidos.",tag:"Supervisión"},
      {title:"Consultas deliberadas",text:"Los filtros locales no vuelven a consultar la base. El uso mensual SDK es opcional y se comprueba el permiso antes de cargarlo. No se añade actualización periódica.",tag:"Uso responsable"},
      {title:"De la señal a la acción",text:"Filtros de prioridad, guías conservadas y accesos autorizados al módulo correspondiente. Los candidatos de alerta no se presentan como tickets o avisos enviados.",tag:"Respuesta"},
      {title:"Evidencia para soporte",text:"Resumen descargable con ventana, métricas y limitaciones. No incluye credenciales, datos personales ni contenido de eventos; requiere permiso de exportación.",tag:"Trazabilidad"},
    ],
  },
  en:{
    link:"What's new and version",eyebrow:"Evidence-led operations",title:"More control. Less uncertainty.",
    summary:"Usage and service health brings together operational sources, service review and on-demand SDK usage. The map, control-room mode and roll configuration remain available.",
    back:"Open live center",site:"nexID website",label:"This interface version",changes:"What's changed",guide:"Try this release",
    steps:["Open Usage and service health from your profile or navigation.","Choose a company and time window. An unavailable source does not mean zero activity.","Open a service to review its sample, definition and response guide.","Request SDK usage when needed or export the support summary if your role allows it."],
    boundary:"These notes do not certify availability or costs. Persisted aggregates do not cover all pre-database failures or connect provider invoices and monetary caps.",
    cards:[
      {title:"Per-service operational state",text:"Recorded reads, event integrity, webhooks, incidents and queues. Every result retains its scope and unknown values remain unknown.",tag:"Supervision"},
      {title:"Deliberate queries",text:"Local filters do not query the database again. Monthly SDK usage is optional and permission-checked. No periodic refresh is added.",tag:"Responsible usage"},
      {title:"From signal to action",text:"Review filters, preserved runbooks and authorized module links. Alert candidates are not presented as delivered notifications or created tickets.",tag:"Response"},
      {title:"Support evidence",text:"Export the time window, metrics and limitations without credentials, personal details or event contents. Export permission is required.",tag:"Traceability"},
    ],
  },
  "pt-BR":{
    link:"Novidades e versão",eyebrow:"Operação com evidência",title:"Mais controle. Menos incerteza.",
    summary:"Uso e estado reúne fontes operacionais, revisão por serviço e consumo SDK sob demanda. O mapa, o Modo sala e a configuração de rolos continuam disponíveis.",
    back:"Abrir centro ao vivo",site:"Site da nexID",label:"Versão desta interface",changes:"O que mudou",guide:"Como testar esta entrega",
    steps:["Abra Uso e estado pelo perfil ou menu lateral.","Escolha empresa e período. Uma fonte indisponível não significa atividade zero.","Abra um serviço para revisar amostra, definição e guia de resposta.","Consulte o uso SDK quando necessário ou exporte o resumo se seu perfil permitir."],
    boundary:"Estas notas não certificam disponibilidade ou custos. Os agregados persistidos não abrangem todas as falhas anteriores ao banco nem conectam faturas ou limites monetários do provedor.",
    cards:[
      {title:"Estado por serviço",text:"Leituras registradas, integridade dos eventos, webhooks, incidentes e filas. Cada resultado mantém seu escopo e dados desconhecidos não viram zero.",tag:"Supervisão"},
      {title:"Consultas deliberadas",text:"Filtros locais não consultam novamente o banco. Uso mensal SDK é opcional, com permissão verificada. Sem atualização periódica adicional.",tag:"Uso responsável"},
      {title:"Do sinal à ação",text:"Filtros de revisão, guias preservados e acessos autorizados. Candidatos de alerta não são apresentados como avisos enviados ou tickets criados.",tag:"Resposta"},
      {title:"Evidência para suporte",text:"Exporte período, métricas e limitações sem credenciais, dados pessoais ou conteúdo de eventos. Requer permissão de exportação.",tag:"Rastreabilidade"},
    ],
  },
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==="en"||locale==="pt-BR"?locale:"es-AR"];}
