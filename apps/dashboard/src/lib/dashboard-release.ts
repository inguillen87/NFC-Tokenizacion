export const DASHBOARD_RELEASE='2026.09.18-dashboard.19';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S6 · la respuesta llega desde su responsable",
    "title": "Tus tareas. Tu respuesta. Un solo expediente.",
    "summary": "La cuenta asignada recibe una tarea de seguimiento, registra su acuse y declara cantidades con evidencia. Gestión ve esos mismos movimientos en el caso original.",
    "back": "Abrir mis tareas de retiro",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido operativo",
    "steps": [
      "El responsable de la empresa publica el caso con destinos y cuentas asignadas.",
      "La cuenta autorizada abre Mis tareas de retiro o el enlace que comparte la gestión.",
      "Consulta el aviso vigente y confirma el acuse con una referencia.",
      "Informa totales acumulados y descarga su constancia. Gestión conserva la aprobación del cierre."
    ],
    "boundary": "Sólo cuentas activas de la empresa o administradores globales expresamente asignados. No hay acceso anónimo, invitaciones ni mensajes automáticos. La respuesta declara cantidades: no prueba devolución física ni libera productos.",
    "cards": [
      {
        "title": "Una bandeja propia",
        "text": "Cada cuenta consulta sólo sus destinos, sin exponer otras empresas, destinatarios o el motivo interno del retiro.",
        "tag": "Acceso acotado"
      },
      {
        "title": "Respuesta directa",
        "text": "Acuses y cantidades se guardan en el expediente existente, con actor y origen diferenciados de una carga administrativa.",
        "tag": "Operación real"
      },
      {
        "title": "Reintentos sin duplicación",
        "text": "El intento se conserva ante una respuesta incierta; las revisiones y la asignación se verifican antes de guardar.",
        "tag": "Consistencia"
      },
      {
        "title": "Constancia del destino",
        "text": "Informe HTML con aviso, cantidades e historial del destino, descargable sin otra consulta ni datos ajenos.",
        "tag": "Evidencia"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S6 · responses from the assignee",
    "title": "Your task. Your response. One case.",
    "summary": "Assigned accounts acknowledge notices and report cumulative quantities. The existing management case receives the same durable operations.",
    "back": "Open my recall tasks",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Management publishes a case with destinations and assigned accounts.",
      "The authorized account opens its task inbox or a shared authenticated link.",
      "Read the current notice and acknowledge with an evidence reference.",
      "Report cumulative quantities and download a destination record. Management controls closure."
    ],
    "boundary": "Requires an active authorized account and current assignment. No anonymous access or automatic invitations/messages. Declared quantities are not physical verification or product release.",
    "cards": [
      {
        "title": "Assigned inbox",
        "text": "Only the current account destinations are exposed, not other recipients or internal case reasons.",
        "tag": "Scope"
      },
      {
        "title": "Direct response",
        "text": "Acknowledgements and quantities update the existing case, with source and actor recorded.",
        "tag": "Operation"
      },
      {
        "title": "Durable retries",
        "text": "Uncertain attempts retain their identity and revisions are checked before changes.",
        "tag": "Integrity"
      },
      {
        "title": "Destination evidence",
        "text": "Download the confirmed notice, quantities and own destination history.",
        "tag": "Evidence"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S6 · resposta do responsável",
    "title": "Sua tarefa. Sua resposta. Um só dossiê.",
    "summary": "A conta designada acusa o recebimento e informa quantidades acumuladas. A gestão recebe os mesmos registros no caso existente.",
    "back": "Abrir minhas tarefas de retirada",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo operacional",
    "steps": [
      "A gestão publica o caso com destinos e contas responsáveis.",
      "A conta autorizada abre sua tarefa ou o link autenticado compartilhado.",
      "Consulta o aviso e confirma o recebimento com uma referência.",
      "Informa totais acumulados e baixa o registro do destino. O fechamento fica com a gestão."
    ],
    "boundary": "Exige conta ativa autorizada e atribuição atual. Sem acesso anônimo ou convites/mensagens automáticos. Quantidades declaradas não comprovam devolução física nem liberam produto.",
    "cards": [
      {
        "title": "Caixa própria",
        "text": "Mostra somente destinos atribuídos, sem outros destinatários ou motivos internos.",
        "tag": "Escopo"
      },
      {
        "title": "Resposta direta",
        "text": "Acuses e quantidades são guardados no dossiê existente com autor e origem.",
        "tag": "Operação"
      },
      {
        "title": "Repetição controlada",
        "text": "Tentativas incertas mantêm o identificador e as revisões são verificadas antes de gravar.",
        "tag": "Consistência"
      },
      {
        "title": "Evidência do destino",
        "text": "Baixe aviso, quantidades e histórico confirmado do destino.",
        "tag": "Evidência"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
