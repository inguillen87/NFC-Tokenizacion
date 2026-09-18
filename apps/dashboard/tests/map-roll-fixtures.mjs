// Synthetic data for local tests only. Never imported by application code.
export function mapRow(id='qa-1', overrides={}) {
  return { eventId:id, tenantSlug:'qa-company', bid:'QA-ROLL-01', productName:'Producto QA sintético', uidMasked:'0400****01',
    sealState:'closed',reportedState:'VALID_CLOSED', messageValid:true,result:'VALID_CLOSED',verdict:'valid',source:'real',dataMode:'physical_real',readCounter:1,
    occurredAt:{utc:'2026-09-17T18:00:00.000Z',local:'17/09/2026 15:00',timezone:'America/Argentina/Buenos_Aires',label:'Argentina'},
    location:{city:'Mendoza',region:'Mendoza',country:'AR',lat:-32.89,lng:-68.84,source:'edge_ip_approx',precision:'approximate',accuracyM:20000,evidence:'persisted_event'},
    evidence:{kind:'real_tap_event_carrier_unconfirmed',messageAuthentication:'validated',ttStatusReported:false,ttState:null,ttRaw:null,ttBindingStatus:'unknown',ttBindingReason:null,ttStatusSource:null,ttStatusOffset:null,ttStatusLength:null,ttEvidenceAuthority:'not_reported',physicalPackagingMeaning:'integration_dependent'},...overrides };
}
export function mapFixture() {
  const rows=[mapRow(),mapRow('qa-2',{sealState:'opened',location:{...mapRow().location,city:'Madrid',country:'ES',lat:40.42,lng:-3.7}}),mapRow('qa-3',{location:{city:'Sin ubicación',region:'',country:'',lat:null,lng:null,source:'',precision:'none',accuracyM:null,evidence:'none'}})];
  return {availability:'ready',checkedAt:'2026-09-17T19:00:00.000Z',detail:'local_synthetic_fixture',payload:{ok:true,availability:"available",scope:{tenant:'qa-company',bid:'QA-ROLL-01',source:'real',limit:100,range:'24h'},summary:{total:3,closed:2,opened:1,other:0,distinctUnits:1,latestAt:rows[0].occurredAt.utc,comparisonAvailable:true,comparisonMeaning:'independent_physical_taps_not_a_product_journey'},rows}};
}
