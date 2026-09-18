// Synthetic fixtures for isolated tests only. Application code never imports this module.
import {mapFixture} from './map-roll-fixtures.mjs';
export function dossierFixture() {
  return {bid:'QA-ROLL-01',tenant_slug:'qa-company',status:'production_registered',created_at:'2026-09-18T03:00:00.000Z',product_name:'Producto de prueba local',sku:'QA-SKU',imported_tags:3,active_tags:2,inactive_tags:1,requested_quantity:5,has_meta_key:true,has_file_key:false,carrier_label:'NTAG 424 DNA TT',sdm_config:{public_lot_label:'Lote comercial QA',product_name:'Producto de prueba local',secret_field:'DO_NOT_TRANSMIT_THIS_CONFIG'},product_identity:{source:'batch',product_name:'Producto de prueba local',sku:'QA-SKU',winery:'Marca QA',region:'Mendoza'},unit_metadata:{unit_product_overrides:0,unit_metadata_rows:2,iot_metadata_rows:1,samples:[{uid_hex:'04000000000001',status:'active',serial:'SERIAL-QA-1',lot:'Lote QA',product_override:false,updated_at:'2026-09-18T03:00:00Z',unit_metadata:{pallet_id:'PALLET-QA-01',container_id:'CONTAINER-QA-01',encryption_key:'NEVER_SEND_METADATA'},iot:{temperature_c:18}},{uid_hex:'04000000000002',status:'inactive',serial:'SERIAL-QA-2',unit_metadata:{box_id:'BOX-QA-01'},iot:{}}]},manifests:[{manifest_type:'uid_csv',import_status:'imported',row_count:3,inserted_count:3,duplicate_count:0,rejected_count:0,created_at:'2026-09-18T03:00:00Z',raw_token:'NEVER_SEND_MANIFEST'}]};
}
export function dossierReadingFixture(range='24h') {
  const data=mapFixture().payload;
  return {...data,scope:{...data.scope,tenant:'qa-company',bid:'QA-ROLL-01',range,limit:20}};
}
