import {noticeScope,boundedNoticeJson} from './product-notices';
export {boundedNoticeJson};
export type ProductNoticeV2={id:string;kind:'recall'|'quarantine';title:string;message:string;instructions:string;contact:string;publishedAt:string;trackingState:'active'|'closing'|'closed';noticeState:'active'|'lifted';noticeVersion:number;effectiveAt:string;resolutionMessage:string|null};
export type ProductNoticesV2={ok:true;protocol:'nexid.product-notices.v2';scope:{tenant:string;bid:string};observedAt:string;notices:ProductNoticeV2[];total:number;hasMore:boolean;doesNotDetermineNfcAuthenticity:true;closureDoesNotReleaseProduct:true;liftingNoticeDoesNotReleaseProduct:true};
export function parseProductNoticesV2(raw:unknown,tenant:string,bid:string):ProductNoticesV2{
 noticeScope(tenant,bid);const r=raw as ProductNoticesV2;
 if(!r||r.ok!==true||r.protocol!=='nexid.product-notices.v2'||r.scope?.tenant!==tenant||r.scope.bid!==bid||r.doesNotDetermineNfcAuthenticity!==true||r.closureDoesNotReleaseProduct!==true||r.liftingNoticeDoesNotReleaseProduct!==true||!Number.isFinite(Date.parse(r.observedAt))||!Array.isArray(r.notices)||r.notices.length>20||!Number.isSafeInteger(r.total)||r.total<r.notices.length||r.hasMore!==(r.total>20))throw Error('notice_v2_source_invalid');
 const seen=new Set<string>();const notices=r.notices.map(n=>{
  if(!n||!/^[a-f0-9-]{36}$/i.test(n.id)||seen.has(n.id)||!['recall','quarantine'].includes(n.kind)||!['active','closing','closed'].includes(n.trackingState)||!['active','lifted'].includes(n.noticeState)||!Number.isSafeInteger(n.noticeVersion)||n.noticeVersion<1||!Number.isFinite(Date.parse(n.publishedAt))||!Number.isFinite(Date.parse(n.effectiveAt))||Date.parse(n.effectiveAt)<Date.parse(n.publishedAt))throw Error('notice_v2_invalid');seen.add(n.id);
  for(const [k,max] of [['title',160],['message',600],['instructions',1000],['contact',200]] as const)if(typeof n[k]!=='string'||n[k].length>max)throw Error('notice_v2_invalid');
  if(n.noticeState==='lifted'&&(n.trackingState!=='closed'||n.noticeVersion<2||typeof n.resolutionMessage!=='string'||n.resolutionMessage.trim().length<10||n.resolutionMessage.length>1000))throw Error('notice_v2_resolution_required');
  if(n.noticeState==='active'&&n.resolutionMessage!==null)throw Error('notice_v2_resolution_invalid');
  return {id:n.id,kind:n.kind,title:n.title,message:n.message,instructions:n.instructions,contact:n.contact,publishedAt:n.publishedAt,trackingState:n.trackingState,noticeState:n.noticeState,noticeVersion:n.noticeVersion,effectiveAt:n.effectiveAt,resolutionMessage:n.resolutionMessage};
 });
 return {ok:true,protocol:r.protocol,scope:{tenant,bid},observedAt:r.observedAt,notices,total:r.total,hasMore:r.hasMore,doesNotDetermineNfcAuthenticity:true,closureDoesNotReleaseProduct:true,liftingNoticeDoesNotReleaseProduct:true};
}
