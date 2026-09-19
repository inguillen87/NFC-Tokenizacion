export const DASHBOARD_RELEASE='2026.09.18-dashboard.18';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S6 · avisos del producto con revisión",
    "title": "Corregir un aviso sin perder su historia.",
    "summary": "Rectificaciones y levantamientos conectados al retiro existente: comparación, otra persona autorizada, comprobante y resolución visible en el pasaporte.",
    "back": "Abrir lotes y seguimientos",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido de trabajo",
    "steps": [
      "Abrí un retiro publicado y elegí Revisar aviso publicado.",
      "Prepará una rectificación; para un levantamiento primero se requiere el seguimiento cerrado.",
      "Guardá y compará los cambios. Otra persona autorizada con MFA revisa su aplicación.",
      "Consultá la versión pública, la resolución y el historial con sus referencias."
    ],
    "boundary": "Levantar un aviso no libera existencias ni certifica calidad o autenticidad física. No se modifica el documento original, las cantidades ni el estado NFC de las etiquetas.",
    "cards": [
      {
        "title": "Antes y después",
        "text": "Texto vigente y propuesta comparados por campo, sin cambiar el pasaporte mientras se escribe.",
        "tag": "Revisión visual"
      },
      {
        "title": "Aprobación independiente",
        "text": "Todos los contribuyentes quedan fuera de la autoaprobación; se mantienen los permisos y MFA.",
        "tag": "Responsabilidad"
      },
      {
        "title": "Un solo cambio confirmado",
        "text": "Expediente, versión pública, propuesta y comprobantes se guardan juntos. Los reintentos recuperan el resultado.",
        "tag": "Integridad"
      },
      {
        "title": "Resolución visible",
        "text": "El consumidor ve el levantamiento revisado y puede abrir el aviso anterior; no una desaparición silenciosa.",
        "tag": "Pasaporte"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S6 · reviewed product notices",
    "title": "Correct a notice without losing its history.",
    "summary": "Amendments and notice lifting connected to the existing recall: compare, review independently, commit and show the resolution on the passport.",
    "back": "Open batches and follow-up",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Open a published recall and choose notice review.",
      "Prepare an amendment; lifting first requires closed follow-up.",
      "Save and compare. A different authorized person with MFA approves.",
      "Check the effective notice, resolution and referenced history."
    ],
    "boundary": "Lifting a notice does not release stock, certify quality or verify NFC authenticity. Original documents, quantities and tag states are retained.",
    "cards": [
      {
        "title": "Before and after",
        "text": "Compare public text field by field while the current notice remains in effect.",
        "tag": "Review"
      },
      {
        "title": "Independent approval",
        "text": "Contributors cannot self-approve; permissions and MFA remain required.",
        "tag": "Authority"
      },
      {
        "title": "One confirmed change",
        "text": "Case version, public notice, proposal and receipts commit together with safe replay.",
        "tag": "Integrity"
      },
      {
        "title": "Visible resolution",
        "text": "Consumers see the reviewed resolution and the previous notice, not a silent disappearance.",
        "tag": "Passport"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S6 · avisos revisados",
    "title": "Corrigir um aviso sem perder seu histórico.",
    "summary": "Retificações e levantamento de avisos conectados ao recolhimento: comparação, revisão independente e resolução visível no passaporte.",
    "back": "Abrir lotes e acompanhamentos",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo de trabalho",
    "steps": [
      "Abra um recolhimento publicado e escolha a revisão do aviso.",
      "Prepare a retificação; o levantamento exige acompanhamento encerrado.",
      "Salve e compare. Outra pessoa autorizada com MFA aprova.",
      "Consulte a versão pública, a resolução e as referências do histórico."
    ],
    "boundary": "Levantar o aviso não libera estoque, certifica qualidade ou autentica NFC. Documento original, quantidades e etiquetas são preservados.",
    "cards": [
      {
        "title": "Antes e depois",
        "text": "Compare os campos públicos enquanto o aviso atual permanece vigente.",
        "tag": "Revisão"
      },
      {
        "title": "Aprovação independente",
        "text": "Participantes não podem autoaprovar; permissões e MFA continuam obrigatórios.",
        "tag": "Responsabilidade"
      },
      {
        "title": "Mudança confirmada",
        "text": "Expediente, aviso, proposta e comprovantes são gravados juntos, com repetição segura.",
        "tag": "Integridade"
      },
      {
        "title": "Resolução visível",
        "text": "O consumidor vê a resolução revisada e o aviso anterior, sem remoção silenciosa.",
        "tag": "Passaporte"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
