import {STUDIO_CONTRACT,parseStudioSnapshot,readStudioDocument,type StudioScope,type StudioDocument,type StudioSnapshot} from "./passport-studio-contract";
export type StudioEnrollment={contract:typeof STUDIO_CONTRACT;scope:StudioScope;actorId:string;capabilities:{edit:boolean;review:boolean;publish:boolean};currentPublicDigest:string;template:"general"|"agro";locale:"es-AR"|"en"|"pt-BR";document:StudioDocument};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function parseStudioEntry(raw:unknown,expected:{bid:string;tenantId?:string|null}):{snapshot:StudioSnapshot|null;enrollment:StudioEnrollment|null}{
 const r=raw as any;if(!r||r.ok!==true||(!r.snapshot&&!r.enrollment)||(r.snapshot&&r.enrollment))throw new Error("studio_entry_invalid");
 const item=r.snapshot||r.enrollment,s=item.scope;
 if(!s||!UUID.test(s.tenantId)||!UUID.test(s.batchId)||s.bid!==expected.bid||(expected.tenantId&&s.tenantId!==expected.tenantId))throw new Error("studio_scope_mismatch");
 if(r.snapshot)return {snapshot:parseStudioSnapshot(item,s),enrollment:null};
 if(Object.keys(item).some(k=>!['contract','scope','actorId','capabilities','currentPublicDigest','template','locale','document'].includes(k))||item.contract!==STUDIO_CONTRACT||!/^[a-f0-9]{64}$/.test(item.currentPublicDigest)||!['general','agro'].includes(item.template)||!['es-AR','en','pt-BR'].includes(item.locale))throw new Error("studio_entry_invalid");
 if(typeof item.actorId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/.test(item.actorId)||typeof s.tenantLabel!=='string'||s.tenantLabel.length>180)throw new Error("studio_entry_invalid");
 if(!item.capabilities||Object.keys(item.capabilities).some(k=>!['edit','review','publish'].includes(k))||['edit','review','publish'].some(k=>typeof item.capabilities[k]!=='boolean'))throw new Error("studio_permissions_invalid");
 const document=readStudioDocument(item.document);if(document.template!==item.template||document.locale!==item.locale)throw new Error("studio_entry_invalid");
 return {snapshot:null,enrollment:{contract:STUDIO_CONTRACT,scope:{tenantId:s.tenantId,batchId:s.batchId,bid:s.bid,tenantLabel:s.tenantLabel},actorId:item.actorId,capabilities:{edit:item.capabilities.edit,review:item.capabilities.review,publish:item.capabilities.publish},currentPublicDigest:item.currentPublicDigest,template:item.template,locale:item.locale,document}};
}
