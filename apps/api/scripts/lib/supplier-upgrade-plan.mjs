// A fixed local acceptance scenario, not a deployment/migration authorization.
export const SUPPLIER_UPGRADE_DELTA=Object.freeze([
 '20260924010000_0117_supplier_request_cancellation.sql',
 '20260924050000_0118_supplier_request_quotes.sql',
 '20260924110000_0119_supplier_request_binding.sql',
 '20260924150000_0120_supplier_delivery_ack.sql',
 '20260924163000_0121_support_ticket_status_type_compatibility.sql',
]);
const prerequisites=Object.freeze([
 '20260922100000_0112_support_ticket_workflow.sql',
 '20260923120000_0113_supplier_requests.sql',
 '20260923150000_0114_supplier_request_reviews.sql',
 '20260923180000_0115_supplier_operator_role_enum.sql',
 '20260923180100_0116_supplier_request_assignments.sql',
]);
const pattern=/^(?:\d{14}_)?\d{4}[a-z]?_[a-z0-9_]+\.sql$/;
function names(value){if(!Array.isArray(value)||!value.length||value.length>512||value.some(x=>typeof x!=='string'||!pattern.test(x))||new Set(value).size!==value.length)throw Error('supplier_upgrade_manifest_invalid');return [...value].sort();}
export function planSupplierUpgrade(files,recorded){
 const repository=names(files),ledger=names(recorded);
 if(ledger.some(id=>!repository.includes(id)))throw Error('supplier_upgrade_unknown_ledger_entry');
 if(prerequisites.some(id=>!ledger.includes(id)))throw Error('supplier_upgrade_prerequisite_not_recorded');
 const boundary=repository.indexOf(SUPPLIER_UPGRADE_DELTA[0]);
 if(boundary<0||JSON.stringify(repository.slice(boundary))!==JSON.stringify(SUPPLIER_UPGRADE_DELTA))throw Error('supplier_upgrade_candidate_changed');
 const recordedDelta=SUPPLIER_UPGRADE_DELTA.filter(id=>ledger.includes(id));
 if(recordedDelta.some((id,i)=>id!==SUPPLIER_UPGRADE_DELTA[i]))throw Error('supplier_upgrade_delta_out_of_order');
 return Object.freeze({baselineFiles:Object.freeze(repository.slice(0,boundary)),historicalGaps:Object.freeze(repository.slice(0,boundary).filter(id=>!ledger.includes(id))),alreadyRecorded:Object.freeze(recordedDelta),pending:Object.freeze(SUPPLIER_UPGRADE_DELTA.filter(id=>!ledger.includes(id))),productionExecutionAllowed:false,liveBaselineVerified:false});
}
