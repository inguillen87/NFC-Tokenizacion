export const DASHBOARD_RELEASE='2026.09.18-dashboard.15';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S6 · evidencia útil para el cliente",
    "title": "El piloto, con datos que se pueden compartir.",
    "summary": "Generá un informe por empresa, lote y período: lecturas verificadas, visitas de identidad, estado de incidentes e inventario actual. Compartí el mismo corte como HTML, CSV o JSON.",
    "back": "Abrir informe del piloto",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Cómo usarlo",
    "steps": [
      "Elegí empresa, lote opcional y fechas UTC.",
      "Generá el informe: una consulta consistente, sin refresco constante.",
      "Revisá fuentes, bases y límites de cada indicador.",
      "Descargá HTML para compartir o imprimir, CSV de indicadores y JSON con integridad."
    ],
    "boundary": "Inventario y estado de incidentes se observan al generar. Una lectura no es una venta, un incidente descartado no es una solución y el informe no certifica un retiro completo.",
    "cards": [
      {
        "title": "Una instantánea coherente",
        "text": "Datos agregados de las tablas existentes, con fechas y vínculo real al tenant y lote.",
        "tag": "Datos reales"
      },
      {
        "title": "Métricas sin confusiones",
        "text": "NFC verificado separado de visitas de identidad, señales de replay y estado del precinto.",
        "tag": "Evidencia"
      },
      {
        "title": "Tres formatos utilizables",
        "text": "HTML autónomo imprimible, CSV con denominadores y JSON con checksum. Las descargas no vuelven a consultar la base.",
        "tag": "Exportación"
      },
      {
        "title": "Acceso y costo acotados",
        "text": "Permisos existentes, límites de período/volumen y ninguna consulta periódica o servicio de pago nuevo.",
        "tag": "Operación"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S6 · useful pilot evidence",
    "title": "A pilot report backed by scoped data.",
    "summary": "Generate a company or batch report for a UTC date range. Compare verified reads, identity visits, incident status and current inventory, then export one consistent snapshot.",
    "back": "Open pilot report",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Select a company, optional batch and UTC dates.",
      "Generate one consistent query without continuous polling.",
      "Review every metric source and denominator.",
      "Download standalone HTML, CSV or integrity-checked JSON."
    ],
    "boundary": "Inventory and incident states are current snapshots. A read is not a sale, dismissal is not remediation and this report does not certify a complete recall.",
    "cards": [
      {
        "title": "Consistent snapshot",
        "text": "Scoped aggregates over existing tables with explicit source and timeframe.",
        "tag": "Evidence"
      },
      {
        "title": "Separate dimensions",
        "text": "Verified NFC, identity visits, replay signals and reported seal state remain distinct.",
        "tag": "Metrics"
      },
      {
        "title": "Usable exports",
        "text": "Standalone printable HTML, CSV with denominators and JSON with checksum. No extra database calls on export.",
        "tag": "Export"
      },
      {
        "title": "Bounded operation",
        "text": "Existing permissions and query limits, without polling or new paid services.",
        "tag": "Operations"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S6 · evidência útil do piloto",
    "title": "O piloto, com dados para compartilhar.",
    "summary": "Gere um relatório por empresa, lote e período UTC. Separe leituras verificadas, visitas de identidade, incidentes e inventário atual.",
    "back": "Abrir relatório do piloto",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Como usar",
    "steps": [
      "Selecione empresa, lote opcional e datas UTC.",
      "Gere uma consulta consistente, sem atualização contínua.",
      "Confira fontes e denominadores de cada indicador.",
      "Baixe HTML, CSV e JSON com integridade do mesmo corte."
    ],
    "boundary": "Inventário e incidentes refletem o momento da consulta. Leitura não é venda, descarte não é solução e o relatório não certifica um recall completo.",
    "cards": [
      {
        "title": "Dados consistentes",
        "text": "Agregações por empresa e lote com período e fonte definidos.",
        "tag": "Evidência"
      },
      {
        "title": "Dimensões distintas",
        "text": "NFC verificado, identidade e estado relatado do lacre não se confundem.",
        "tag": "Métricas"
      },
      {
        "title": "Exportações utilizáveis",
        "text": "HTML imprimível, CSV com denominadores e JSON com checksum sem novas consultas.",
        "tag": "Exportação"
      },
      {
        "title": "Operação limitada",
        "text": "Permissões existentes e limites, sem polling ou serviço pago adicional.",
        "tag": "Operação"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
