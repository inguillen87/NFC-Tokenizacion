import type { SommelierContext, SommelierLocale } from "./sommelier-contract";

export const SYNGENTA_GUIDE_SOURCES = {
  product: "https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-xtra",
  label: "https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2016/08/16/amistar20xtra_etiqueta_4541.pdf",
  safety: "https://www.syngenta.com.ar/sites/g/files/kgtney396/files/media/document/2024/02/28/AMISTAR%20XTRA_hoja_de_seguridad.pdf",
  comparison: "https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar-top",
  amistar: "https://www.syngenta.com.ar/product/crop-protection/fungicida/amistar",
  tag: "https://www.nxp.com/docs/en/application-note/AN12196.pdf",
} as const;

/** Fixed, reviewed public catalog facts, checked 2026-10-08. The label URL is
 * the manufacturer's linked document, not proof of regulatory currency.
 * No application rates, crop diagnoses, prices, stock, tenant or NFC facts.
 */
export function syngentaGuideFacts(locale: SommelierLocale): SommelierContext {
  const rows = {
    "es-AR": [
      ["product", "Producto", "AMISTAR XTRA · Syngenta Argentina · fungicida", "product"],
      ["formulation", "Formulación publicada", "Suspensión concentrada", "product"],
      ["xtra-ingredients", "AMISTAR XTRA · ingredientes publicados", "Azoxistrobina y Cyproconazole", "product"],
      ["registration", "Registro informado por el catálogo", "34011; esta demo no verifica la autorización ni el envase", "product"],
      ["container", "Presentación del documento", "Bidón de 5 L; la foto y el lote de la demo no identifican un envase real", "label"],
      ["label", "Etiqueta oficial enlazada", "Consultá el documento de Syngenta y a tu asesor técnico para sus indicaciones y restricciones", "label"],
      ["safety", "Hoja de seguridad", "Documento de seguridad publicado por Syngenta; consultalo antes de manipular el producto", "safety"],
      ["top-ingredients", "AMISTAR TOP · ingredientes publicados", "Azoxistrobina y Difenoconazole; un producto distinto, sin recomendar sustitución ni uso", "comparison"],
      ["amistar-ingredients", "AMISTAR · ingrediente publicado", "Azoxistrobina; un producto distinto, sin recomendar sustitución ni uso", "amistar"],
      ["tag", "Propuesta de etiqueta NFC", "NTAG 424 DNA TagTamper comprueba el circuito al activarse por NFC, sin monitoreo continuo. El montaje físico todavía requiere validación", "tag"],
      ["purchase-checks", "Antes de comprar", "Revisá etiqueta, presentación, lote y condiciones del envase con el vendedor; esta demo no informa precio, stock ni autoriza una compra", "product"],
      ["contact", "Consulta a la marca", "La ficha de Syngenta incluye un formulario de consulta técnica; abrirla no envía una solicitud desde NexID", "product"],
    ],
    en: [
      ["product", "Product", "AMISTAR XTRA · Syngenta Argentina · fungicide", "product"],
      ["formulation", "Published formulation", "Suspension concentrate", "product"],
      ["xtra-ingredients", "AMISTAR XTRA · published ingredients", "Azoxystrobin and Cyproconazole", "product"],
      ["registration", "Catalog-reported registration", "34011; this demo does not verify authorization or the container", "product"],
      ["container", "Document presentation", "5 L canister; the demo photo and sample lot identify no real container", "label"],
      ["label", "Linked official label", "Consult Syngenta's document and your technical adviser for its instructions and restrictions", "label"],
      ["safety", "Safety data sheet", "Safety document published by Syngenta; read it before handling the product", "safety"],
      ["top-ingredients", "AMISTAR TOP · published ingredients", "Azoxystrobin and Difenoconazole; a different product, without recommending substitution or use", "comparison"],
      ["amistar-ingredients", "AMISTAR · published ingredient", "Azoxystrobin; a different product, without recommending substitution or use", "amistar"],
      ["tag", "NFC label proposal", "NTAG 424 DNA TagTamper checks the loop when activated by NFC, without continuous monitoring. Physical mounting still requires validation", "tag"],
      ["purchase-checks", "Before buying", "Review the label, presentation, lot and container condition with the seller; this demo gives no price or stock and authorizes no purchase", "product"],
      ["contact", "Ask the brand", "Syngenta's product page includes a technical enquiry form; opening it sends no request from NexID", "product"],
    ],
    "pt-BR": [
      ["product", "Produto", "AMISTAR XTRA · Syngenta Argentina · fungicida", "product"],
      ["formulation", "Formulação publicada", "Suspensão concentrada", "product"],
      ["xtra-ingredients", "AMISTAR XTRA · ingredientes publicados", "Azoxistrobina e Cyproconazole", "product"],
      ["registration", "Registro informado no catálogo", "34011; esta demo não verifica a autorização nem a embalagem", "product"],
      ["container", "Apresentação do documento", "Galão de 5 L; a foto e o lote da demo não identificam uma embalagem real", "label"],
      ["label", "Rótulo oficial vinculado", "Consulte o documento da Syngenta e seu assessor técnico para as indicações e restrições", "label"],
      ["safety", "Ficha de segurança", "Documento de segurança publicado pela Syngenta; consulte antes de manusear o produto", "safety"],
      ["top-ingredients", "AMISTAR TOP · ingredientes publicados", "Azoxistrobina e Difenoconazole; outro produto, sem recomendar substituição ou uso", "comparison"],
      ["amistar-ingredients", "AMISTAR · ingrediente publicado", "Azoxistrobina; outro produto, sem recomendar substituição ou uso", "amistar"],
      ["tag", "Proposta de etiqueta NFC", "NTAG 424 DNA TagTamper verifica o circuito ao ser ativado por NFC, sem monitoramento contínuo. A montagem física ainda exige validação", "tag"],
      ["purchase-checks", "Antes de comprar", "Confira rótulo, apresentação, lote e estado da embalagem com o vendedor; a demo não informa preço ou estoque nem autoriza compra", "product"],
      ["contact", "Pergunte à marca", "A ficha da Syngenta contém um formulário de consulta técnica; abri-la não envia uma solicitação pela NexID", "product"],
    ],
  }[locale];
  return { source: "syngenta_demo", tenantId: "demo:syngenta", demo: true,
    facts: rows.map(([id, label, text, source]) => ({ id, label, text, url: SYNGENTA_GUIDE_SOURCES[source as keyof typeof SYNGENTA_GUIDE_SOURCES] })) };
}
