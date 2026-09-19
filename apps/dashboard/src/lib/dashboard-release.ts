export const DASHBOARD_RELEASE='2026.09.19-dashboard.26';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S3 / S4 · trabajo editorial por empresa",
    "title": "Lo que espera revisión, en un solo lugar.",
    "summary": "La bandeja editorial reúne los pasaportes que ya usan Studio, sus estados, comentarios de corrección y el siguiente paso para cada rol.",
    "back": "Abrir bandeja editorial",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo usarlo",
    "steps": [
      "Abrí Bandeja editorial desde Productos y pasaportes o Lotes.",
      "Consultá por estado, producto, lote o empresa; usá Para mi rol para orientar el trabajo.",
      "Leé el siguiente paso y el comentario de corrección antes de abrir Studio.",
      "Revisá y confirmá dentro de Studio; volver a la bandeja conserva la empresa elegida."
    ],
    "boundary": "La bandeja consulta, no aprueba ni publica. Los contadores incluyen sólo pasaportes incorporados a Studio. Para mi rol no es una asignación personal ni omite los controles de revisión y MFA.",
    "cards": [
      {
        "title": "Cola operativa",
        "text": "Estados guardados y 25 pasaportes por página, con conteos de todo el alcance autorizado.",
        "tag": "Operación"
      },
      {
        "title": "Siguiente paso",
        "text": "Editor, revisor independiente o publicador: cada estado indica dónde continuar. No se habilita autoaprobación.",
        "tag": "Roles"
      },
      {
        "title": "Corrección visible",
        "text": "El comentario de la revisión actual se muestra junto a su último movimiento, sin cargar el documento completo.",
        "tag": "Revisión"
      },
      {
        "title": "Empresa conservada",
        "text": "Los enlaces y solicitudes de Studio mantienen el alcance explícito incluso para administradores globales y lotes con el mismo identificador.",
        "tag": "Integridad"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S3 / S4 · tenant editorial work",
    "title": "Pending reviews, in one place.",
    "summary": "The editorial inbox brings together managed passports, saved states, correction comments and the next role-specific step.",
    "back": "Open editorial inbox",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Get started",
    "steps": [
      "Open the editorial inbox from Products and passports or Batches.",
      "Query by state, product, batch or company; select work for your role.",
      "Read the next step and correction before opening Studio.",
      "Confirm changes in Studio; returning retains the selected company."
    ],
    "boundary": "The inbox only reads; it never approves or publishes. Counts cover passports already enrolled in Studio. Role-based work is not a personal assignment or a substitute for permission and MFA checks.",
    "cards": [
      {
        "title": "Operational queue",
        "text": "Stored states and 25 passports per page with scoped counts.",
        "tag": "Operations"
      },
      {
        "title": "Next role",
        "text": "Editor, independent reviewer or publisher, without self-approval.",
        "tag": "Roles"
      },
      {
        "title": "Visible corrections",
        "text": "Current review comments appear with their recorded change.",
        "tag": "Review"
      },
      {
        "title": "Preserved tenant",
        "text": "Studio links and requests retain explicit tenant context, including duplicate batch identifiers.",
        "tag": "Integrity"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S3 / S4 · trabalho editorial por empresa",
    "title": "Revisões pendentes, em um só lugar.",
    "summary": "A fila editorial reúne passaportes gerenciados, estados salvos, comentários de correção e o próximo passo por função.",
    "back": "Abrir fila editorial",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Como começar",
    "steps": [
      "Abra a fila em Produtos e passaportes ou Lotes.",
      "Consulte estado, produto, lote ou empresa e o trabalho para sua função.",
      "Leia a correção e o próximo passo antes de abrir Studio.",
      "Confirme no Studio; a navegação preserva a empresa selecionada."
    ],
    "boundary": "A fila apenas consulta, não aprova nem publica. Contagens incluem passaportes já incorporados ao Studio. A função não substitui atribuição pessoal, permissões ou MFA.",
    "cards": [
      {
        "title": "Fila operacional",
        "text": "Estados salvos e 25 passaportes por página com contagens no alcance autorizado.",
        "tag": "Operação"
      },
      {
        "title": "Próxima função",
        "text": "Editor, revisor independente ou publicador, sem autoaprovação.",
        "tag": "Funções"
      },
      {
        "title": "Correções visíveis",
        "text": "O comentário da revisão atual aparece junto ao último movimento.",
        "tag": "Revisão"
      },
      {
        "title": "Empresa preservada",
        "text": "Links e solicitações do Studio mantêm o contexto da empresa, inclusive com IDs de lote repetidos.",
        "tag": "Integridade"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
