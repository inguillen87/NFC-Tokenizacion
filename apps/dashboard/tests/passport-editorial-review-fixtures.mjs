// Synthetic input used only by local tests; never import into an application route.
export const EXPECTED_SCOPE={tenantId:'10000000-0000-4000-8000-000000000001',batchId:'20000000-0000-4000-8000-000000000002',canRead:true,canExport:true};
export function editorialReviewFixture(){
 const published={schemaVersion:'nexid.passport-editorial.v1',template:'agro',locale:'es-AR',identity:{product_name:'Semilla Horizonte',public_lot_label:'LOTE DE PRUEBA 01',sku:'SEM-QA-01',winery:'Empresa de prueba',region:'Origen declarado',image_url:null},agro_product_profile:{schemaVersion:'agro-dpp-v1',productName:'Semilla Horizonte',brand:'Empresa de prueba',sku:'SEM-QA-01',batchLot:'LOTE DE PRUEBA 01',crop:'Maíz',seedVariety:'Variedad de prueba 01',expirationDate:'2027-04-30',technicalSheetUrl:'https://example.invalid/documentos/ficha-v1.pdf',safetySheetUrl:null,trainingUrl:'https://example.invalid/curso-anterior',ppe:{summary:'Indicaciones declaradas por la empresa.',items:['Revisar la documentación del fabricante.']},stewardship:{summary:'Consultar la documentación de este producto.',items:[]},support:{label:'Equipo de soporte',email:'soporte@example.invalid'}}};
 const candidate=structuredClone(published);
 candidate.identity.public_lot_label='LOTE DE PRUEBA 02';
 candidate.agro_product_profile.batchLot='LOTE DE PRUEBA 02';
 candidate.agro_product_profile.seedVariety='Variedad de prueba 02';
 candidate.agro_product_profile.expirationDate='2027-08-31';
 candidate.agro_product_profile.technicalSheetUrl='https://example.invalid/documentos/ficha-v2.pdf';
 candidate.agro_product_profile.safetySheetUrl='https://example.invalid/documentos/seguridad.pdf';
 candidate.agro_product_profile.trainingUrl=null;
 candidate.agro_product_profile.support.phone='+54 000 000 0000';
 return {schemaVersion:'nexid.passport-review.v1',tenantId:EXPECTED_SCOPE.tenantId,batchId:EXPECTED_SCOPE.batchId,batchLabel:'Lote agrícola · datos sintéticos',revision:4,status:'in_review',observedAt:'2026-09-18T10:00:00.000Z',published,candidate};
}
