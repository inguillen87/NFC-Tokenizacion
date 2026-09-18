import {createHash} from 'node:crypto';
export const API_ORIGIN = 'https://api.nexid.lat';
export const EVENT_TYPE = 'shipment.received';
export const MAX_ROWS = 500;
export const hash = value => createHash('sha256').update(value).digest('hex');
export class ConnectorError extends Error {
  constructor(code) { super(code); this.name = 'ConnectorError'; this.code = code; }
}
export function tenantName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,126}[a-z0-9]$/.test(value)) throw new ConnectorError('tenant_required');
  return value;
}
export function connectorName(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) throw new ConnectorError('connector_id_required');
  return value;
}
export function parseReceiptCsv(input) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > 524288) throw new ConnectorError('csv_size_limit');
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  function endField() { row.push(field); field = ''; closed = false; }
  function endRow() { endField(); if (row.some(x => x !== '')) rows.push(row); row = []; if (rows.length > MAX_ROWS + 1) throw new ConnectorError('csv_row_limit'); }
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if (quoted) { if (ch==='"' && text[i+1]==='"') { field+='"'; i++; } else if (ch==='"') { quoted=false; closed=true; } else field+=ch; continue; }
    if (ch===',') endField();
    else if (ch==='\n') endRow();
    else if (ch==='"' && field==='' && !closed) quoted=true;
    else { if (closed || ch==='"' || ch==='\r') throw new ConnectorError('csv_invalid_quotes'); field+=ch; }
  }
  if (quoted) throw new ConnectorError('csv_unclosed_quote');
  if (field!=='' || row.length || closed) endRow();
  if (JSON.stringify(rows.shift()) !== JSON.stringify(['external_id','bid','occurred_at','facility'])) throw new ConnectorError('csv_header_mismatch');
  if (!rows.length) throw new ConnectorError('csv_empty');
  const seen = new Set();
  return rows.map((values,index) => {
    if (values.length!==4) throw new ConnectorError('csv_columns_row_'+(index+2));
    const [externalId,bid,occurredAt,facility]=values;
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(externalId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(bid) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(facility)) throw new ConnectorError('csv_identifier_row_'+(index+2));
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt) || !Number.isFinite(Date.parse(occurredAt))) throw new ConnectorError('csv_time_row_'+(index+2));
    if(new Date(occurredAt.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==occurredAt.slice(0,10))throw new ConnectorError('csv_calendar_date_row_'+(index+2));
    if (seen.has(externalId)) throw new ConnectorError('csv_duplicate_external_id');
    seen.add(externalId);
    return {externalId,bid,occurredAt:new Date(occurredAt).toISOString(),facility};
  });
}
export function receiptOperation(tenant,connector,receipt) {
  tenantName(tenant); connectorName(connector);
  const key='csv1_'+hash(JSON.stringify([tenant,connector,receipt.externalId]));
  const body={eventType:EVENT_TYPE,bid:receipt.bid,source:connector,occurredAt:receipt.occurredAt,data:{externalBusinessId:receipt.externalId,facilityCode:receipt.facility,evidenceSource:'external_declaration'}};
  return {key,body:JSON.stringify(body),digest:hash(JSON.stringify(body)),externalId:receipt.externalId};
}
