export const DASHBOARD_RELEASE='2026.09.18-dashboard.17';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S7 · campañas con controles",
    "title": "Del borrador al ensayo aprobado.",
    "summary": "Conservá tu editor, definí presupuesto y destinatarios, pedí revisión independiente y simulá la audiencia consentida actual sin enviar mensajes.",
    "back": "Abrir revisión de campañas",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido operativo",
    "steps": [
      "Elegí un borrador guardado desde Revisar y simular.",
      "Definí moneda, costo de referencia, presupuesto y máximo de destinatarios.",
      "Solicitá revisión por otra cuenta autorizada con MFA.",
      "Simulá y descargá el resultado con motivos de exclusión y fuentes."
    ],
    "boundary": "La aprobación habilita sólo una simulación. No dispara entregas ni reserva fondos. El consentimiento se vuelve a consultar y los importes son referencias del operador, no precios del proveedor.",
    "cards": [
      {
        "title": "Aprobación con versión",
        "text": "Texto y límites quedan vinculados. Modificar el borrador invalida la aprobación para nuevos ensayos.",
        "tag": "Gobierno"
      },
      {
        "title": "Consentimiento actual",
        "text": "Membresía activa, permiso del canal, contacto utilizable y destinos no duplicados, sin exportar datos personales.",
        "tag": "Audiencia"
      },
      {
        "title": "Dos límites visibles",
        "text": "Máximo de destinatarios y presupuesto de referencia acotan los candidatos simulados.",
        "tag": "Control"
      },
      {
        "title": "Resultado trazable",
        "text": "Informe HTML con momento, versión, fuentes y exclusiones. Envíos y cargos de mensajería del ensayo: cero.",
        "tag": "Evidencia"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S7 · controlled campaign preparation",
    "title": "From saved draft to reviewed simulation.",
    "summary": "Keep the existing editor, configure reference limits, request independent review and simulate current consented audience without sending.",
    "back": "Open campaign review",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Choose a saved draft.",
      "Set reference costs, budget and recipient cap.",
      "Request another authorized reviewer with MFA.",
      "Run the dry run and export the evidence."
    ],
    "boundary": "Approval permits a simulation only, not dispatch or funds reservation. Contacts and consent are rechecked; reference costs are not provider prices.",
    "cards": [
      {
        "title": "Versioned review",
        "text": "Content changes invalidate the approval for new simulations.",
        "tag": "Control"
      },
      {
        "title": "Current consent",
        "text": "Active membership, channel permission, usable contact syntax and distinct destinations.",
        "tag": "Audience"
      },
      {
        "title": "Bounded simulation",
        "text": "Recipient and reference budget limits constrain candidate counts.",
        "tag": "Limits"
      },
      {
        "title": "Traceable result",
        "text": "Printable report with source, exclusions and timestamp; no paid delivery.",
        "tag": "Evidence"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S7 · preparação controlada",
    "title": "Do rascunho à simulação revisada.",
    "summary": "Mantenha o editor, configure limites, solicite revisão independente e simule a audiência com consentimento atual, sem envio.",
    "back": "Abrir revisão de campanhas",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo",
    "steps": [
      "Escolha um rascunho salvo.",
      "Defina custos de referência, orçamento e limite de destinatários.",
      "Solicite outra conta autorizada com MFA para revisar.",
      "Simule e baixe o relatório com evidências."
    ],
    "boundary": "A aprovação habilita apenas uma simulação. Não envia nem reserva valores. Consentimento é consultado novamente e os custos não são preços do provedor.",
    "cards": [
      {
        "title": "Revisão por versão",
        "text": "Alterar conteúdo invalida a aprovação para novas simulações.",
        "tag": "Controle"
      },
      {
        "title": "Consentimento atual",
        "text": "Membresia ativa, permissão do canal e destinos não duplicados.",
        "tag": "Audiência"
      },
      {
        "title": "Limites claros",
        "text": "Máximo de destinatários e orçamento de referência limitam candidatos.",
        "tag": "Orçamento"
      },
      {
        "title": "Resultado rastreável",
        "text": "HTML com fontes, exclusões e data, sem entrega paga.",
        "tag": "Evidência"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
