export const DASHBOARD_RELEASE='2026.09.18-dashboard.15';
export const DASHBOARD_RELEASE_DATE='2026-09-18';
export const RELEASE_NOTES={
  "es-AR": {
    "link": "Novedades y versión",
    "eyebrow": "S6 · seguimiento de seguridad del producto",
    "title": "Del aviso al cierre con evidencia.",
    "summary": "Retiros y avisos de cuarentena por lote: borrador, revisión independiente, publicación en el pasaporte, acuses y cantidades documentadas.",
    "back": "Abrir lotes",
    "site": "Sitio de nexID",
    "label": "Versión de esta interfaz",
    "changes": "Qué cambió",
    "guide": "Recorrido operativo",
    "steps": [
      "Abrí Retiro / cuarentena en el lote y prepará el aviso con responsables y cantidades declaradas.",
      "Guardá el borrador y solicitá revisión. Otra cuenta autorizada debe publicar el aviso.",
      "Registrá acuses, unidades devueltas o inmovilizadas y sus comprobantes.",
      "Solicitá el cierre, hacé revisar su evidencia y descargá el informe del caso."
    ],
    "boundary": "No se crean retiros ni envían mensajes automáticamente. El aviso no revoca etiquetas ni cambia su autenticidad. Cerrar el seguimiento conserva la advertencia; no libera el producto ni certifica físicamente las cantidades.",
    "cards": [
      {
        "title": "Aviso público separado del NFC",
        "text": "La autenticidad de la etiqueta y las restricciones del lote son dimensiones distintas, visibles en el pasaporte.",
        "tag": "Producto"
      },
      {
        "title": "Responsables y acuses",
        "text": "Destinos, objetivos declarados y comprobantes sin confundirlos con un inventario físico o recepción automática.",
        "tag": "Seguimiento"
      },
      {
        "title": "Revisión y cierre controlados",
        "text": "Publicación y cierre requieren otra cuenta autorizada. Los cambios quedan versionados y los reintentos no duplican operaciones.",
        "tag": "Integridad"
      },
      {
        "title": "Informe del retiro",
        "text": "Archivo HTML imprimible con cantidades, fuentes, revisión e historial. No es todavía el informe agregado de todo el piloto.",
        "tag": "Evidencia"
      }
    ]
  },
  "en": {
    "link": "What is new and version",
    "eyebrow": "S6 · product-safety follow-up",
    "title": "From notice to evidence-based follow-up.",
    "summary": "Batch recalls and quarantine notices with drafts, independent review, public passport warnings, acknowledgements and declared quantities.",
    "back": "Open batches",
    "site": "nexID website",
    "label": "Interface version",
    "changes": "Changes",
    "guide": "Workflow",
    "steps": [
      "Prepare the batch notice, destinations and declared quantities.",
      "Save and request independent review before publishing.",
      "Record acknowledgements, returned or held units and evidence references.",
      "Request independent closure and download the case report."
    ],
    "boundary": "No automatic recall or outbound messages. Closing follow-up does not remove the warning, release products or change NFC evidence.",
    "cards": [
      {
        "title": "Separate product warning",
        "text": "Tag authenticity and product restrictions remain separate visible facts.",
        "tag": "Product"
      },
      {
        "title": "Assigned follow-up",
        "text": "Declared targets and referenced acknowledgement evidence, not certified physical inventory.",
        "tag": "Operations"
      },
      {
        "title": "Controlled publication",
        "text": "Another authorized identity reviews publication and closure; versioned commands reconcile retries.",
        "tag": "Integrity"
      },
      {
        "title": "Case report",
        "text": "Printable HTML with quantities and history, not yet the aggregated pilot report.",
        "tag": "Evidence"
      }
    ]
  },
  "pt-BR": {
    "link": "Novidades e versão",
    "eyebrow": "S6 · acompanhamento do produto",
    "title": "Do aviso ao acompanhamento com evidência.",
    "summary": "Recolhimentos e avisos de quarentena por lote, com revisão independente, aviso no passaporte, acuses e quantidades declaradas.",
    "back": "Abrir lotes",
    "site": "Site da nexID",
    "label": "Versão da interface",
    "changes": "Mudanças",
    "guide": "Fluxo operacional",
    "steps": [
      "Prepare o aviso e os destinos com responsáveis e quantidades declaradas.",
      "Salve e solicite revisão independente para publicar.",
      "Registre acuses, unidades devolvidas ou imobilizadas e comprovantes.",
      "Solicite revisão do encerramento e baixe o relatório do caso."
    ],
    "boundary": "Sem recolhimentos ou mensagens automáticas. Encerrar o acompanhamento mantém o aviso e não libera o produto nem altera a evidência NFC.",
    "cards": [
      {
        "title": "Aviso separado do NFC",
        "text": "Autenticidade da etiqueta e restrições do lote são fatos distintos.",
        "tag": "Produto"
      },
      {
        "title": "Responsáveis e comprovantes",
        "text": "Objetivos declarados e evidência referenciada, não inventário físico certificado.",
        "tag": "Operação"
      },
      {
        "title": "Revisão independente",
        "text": "Outra conta autorizada revisa publicação e encerramento. Repetições não duplicam a operação.",
        "tag": "Integridade"
      },
      {
        "title": "Relatório do caso",
        "text": "HTML imprimível com quantidades e histórico, sem prometer o relatório agregado do piloto.",
        "tag": "Evidência"
      }
    ]
  }
} as const;
export function releaseCopy(locale:string){return RELEASE_NOTES[locale==='en'||locale==='pt-BR'?locale:'es-AR'];}
