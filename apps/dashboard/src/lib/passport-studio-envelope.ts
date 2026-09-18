import {parseStudioSnapshot,readStudioDocument,type StudioSnapshot,type StudioScope,type StudioDocument} from './passport-studio-contract';
export type StudioEnrollment={contract:string;scope:StudioScope;actorId:string;capabilities:{edit:boolean;review:boolean;publish:boolean};currentPublicDigest:string;template:'general'|'agro';locale:'es-AR'|'en'|'pt-BR';document:StudioDocument};
export type StudioEnvelope={snapshot:StudioSnapshot;enrollment?:never}|{snapshot?:never;enrollment:StudioEnrollment};
export function parseStudioEnvelope(raw:unknown,expected:{tenantId:string;batchId:string;bid:string}):StudioEnvelope{
 const r=raw as Record<string,any>|null;
 if(!r||r.ok!==true)throw new Error('studio_source_invalid');
 if(r.snapshot){const s=parseStudioSnapshot(r.snapshot,expected);if(s.scope.bid!==expected.bid)throw new Error('studio_scope_mismatch');return {snapshot:s};}
 const e=r.enrollment;
 if(!e||e.contract!=='nexid.passport-studio.v1'||e.scope?.tenantId!==expected.tenantId||e.scope?.batchId!==expected.batchId||e.scope?.bid!==expected.bid||!['general','agro'].includes(e.template)||!['es-AR','en','pt-BR'].includes(e.locale))throw new Error('studio_scope_mismatch');
 if(!/^[a-f0-9]{64}$/.test(e.currentPublicDigest)||typeof e.actorId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_:-]{0,179}$/.test(e.actorId))throw new Error('studio_source_invalid');
 for(const key of ['edit','review','publish'])if(typeof e.capabilities?.[key]!=='boolean')throw new Error('studio_source_invalid');
 return {enrollment:{contract:e.contract,scope:{tenantId:e.scope.tenantId,batchId:e.scope.batchId,bid:e.scope.bid,tenantLabel:String(e.scope.tenantLabel).slice(0,180)},actorId:e.actorId,capabilities:{...e.capabilities},currentPublicDigest:e.currentPublicDigest,template:e.template,locale:e.locale,document:readStudioDocument(e.document)}};
}
