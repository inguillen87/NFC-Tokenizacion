export const DASHBOARD_RELEASE='2026.09.19-dashboard.21';
export const DASHBOARD_RELEASE_DATE='2026-09-19';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S3 / S5 · expediente operativo",
    "title": "El recorrido del lote, con su evidencia.",
    "summary": "Consultá eventos, agrupaciones, transformaciones y envíos desde el lote. Cada fuente conserva su alcance y sus fechas; no se infiere ubicación física ni autenticidad adicional.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo usar esta entrega",
    "steps": [
      "Abrí un lote y elegí Recorrido del lote.",
      "Consultá un período de hasta 93 días completos en UTC.",
      "Revisá el evento y sus referencias de agrupador, contenido, entradas o salidas.",
      "Abrí el envío autorizado o descargá la misma consulta en HTML y JSON."
    ],
    "boundary": "Los eventos EPCIS son declaraciones persistidas; las relaciones son históricas, no un inventario actual del contenedor. No se crean movimientos, se simula un lector UHF ni se modifican etiquetas al consultar.",
    "cards": [
      {
        "title": "Una consulta del expediente",
        "text": "Eventos EPCIS y custodia vinculados al lote, sin duplicar tablas ni mezclar empresas.",
        "tag": "Trazabilidad"
      },
      {
        "title": "Relaciones comprensibles",
        "text": "Agrupar, observar, separar y transformar conservan su acción y momento. Una corrección se advierte, no se oculta.",
        "tag": "Operación"
      },
      {
        "title": "Permisos conservados",
        "text": "El acceso al lote no concede logística. Los envíos se muestran sólo a una cuenta autorizada.",
        "tag": "Acceso"
      },
      {
        "title": "Evidencia exportable",
        "text": "HTML autónomo y JSON del mismo resultado, con integridad verificable y sin consultar otra vez la base.",
        "tag": "Informe"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S3 / S5 · operational dossier",
    "title": "The batch journey, backed by records.",
    "summary": "Review events, grouping, transformations and linked shipments from the batch dossier. Source scope and timestamps remain explicit.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Use this release",
    "steps": [
      "Open a batch and choose its journey.",
      "Select up to 93 complete UTC days.",
      "Review event-specific parent, child, input and output references.",
      "Open an authorized shipment or export the query in HTML and JSON."
    ],
    "boundary": "Recorded EPCIS declarations do not establish current physical containment or NFC authenticity. This read-only view does not simulate UHF hardware or write movements.",
    "cards": [
      {
        "title": "One batch view",
        "text": "Linked EPCIS and custody records without a duplicate data store.",
        "tag": "Traceability"
      },
      {
        "title": "Clear relationships",
        "text": "ADD, OBSERVE, DELETE and transformations retain their historical context.",
        "tag": "Operations"
      },
      {
        "title": "Scoped access",
        "text": "Batch access does not grant logistics permission or reveal other tenants.",
        "tag": "Access"
      },
      {
        "title": "Exportable evidence",
        "text": "Self-contained HTML and JSON use the same retrieved snapshot.",
        "tag": "Report"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S3 / S5 · dossiê operacional",
    "title": "O percurso do lote, com evidências.",
    "summary": "Consulte eventos, agrupamentos, transformações e envios vinculados ao lote, mantendo o escopo e as datas de cada fonte.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Como usar",
    "steps": [
      "Abra o lote e seu percurso.",
      "Selecione até 93 dias completos em UTC.",
      "Consulte referências de agrupador, conteúdo, entradas e saídas por evento.",
      "Abra o envio autorizado ou exporte a consulta em HTML e JSON."
    ],
    "boundary": "Declarações EPCIS não comprovam a composição física atual nem a autenticidade NFC. A consulta não simula leitores UHF ou cria movimentações.",
    "cards": [
      {
        "title": "Consulta do lote",
        "text": "Eventos e custódia vinculados sem duplicar o armazenamento.",
        "tag": "Rastreabilidade"
      },
      {
        "title": "Relações claras",
        "text": "Agrupar, observar, separar e transformar mantêm seu contexto histórico.",
        "tag": "Operação"
      },
      {
        "title": "Acesso delimitado",
        "text": "Acesso ao lote não concede permissão logística nem acesso a outra empresa.",
        "tag": "Acesso"
      },
      {
        "title": "Evidência exportável",
        "text": "HTML e JSON autônomos usam o mesmo resultado consultado.",
        "tag": "Relatório"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
