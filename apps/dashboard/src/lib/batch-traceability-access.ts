export function traceRequestScopeAllowed(session:{role:string;tenantSlug?:string|null;isDemo?:boolean},requested:unknown){
 if(session.isDemo||Array.isArray(requested))return false;
 const tenant=typeof requested==='string'?requested.trim().toLowerCase():'';
 if(session.role==='super-admin')return !session.tenantSlug;
 return Boolean(session.tenantSlug)&&(!tenant||tenant===session.tenantSlug);
}
