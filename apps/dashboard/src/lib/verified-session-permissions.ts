/** Only call after /auth/session confirmed an opaque authenticated session. Never use for browser claims. */
export function verifiedSessionPermissions(input:{role:string;tenantId?:string|null;tenantSlug?:string|null;isDemo?:boolean;permissions?:unknown}):string[]{
 const permissions=Array.isArray(input.permissions)?input.permissions.map(String):[];
 const globalAdmin=input.role==='super-admin'&&!input.tenantId&&!input.tenantSlug&&input.isDemo!==true;
 return [...new Set(globalAdmin?['*',...permissions]:permissions)];
}
