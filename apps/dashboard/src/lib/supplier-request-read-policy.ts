export type SupplierReadKind = 'list' | 'record';
export type SupplierReadDenial = 'all' | 'record' | null;
/** A read denial hides cached data. A network/contract failure is not a revocation. */
export function supplierReadDenial(status:number,kind:SupplierReadKind):SupplierReadDenial {
  if(status===401||status===403||(status===404&&kind==='list'))return 'all';
  return status===404?'record':null;
}
