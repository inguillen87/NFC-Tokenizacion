export const NOTICE_REVIEW_PROTOCOL: 'nexid.recall-notice-review.v1';
export const NOTICE_REVIEW_ACTIONS: readonly string[];
export class NoticeReviewError extends Error {code:string;status:number;constructor(code:string,status?:number);}
export type NoticeText={title:string;publicMessage:string;instructions:string;contact:string};
export type NoticeSource={tenantId:string;batchId:string;caseId:string;caseVersion:number;noticeVersion:number;trackingState:string;publishedAt:string;noticeState:string;notice:NoticeText};
export type NoticeAuthority={id:string;role:string;tenantId:string|null;canRead:boolean;canWrite:boolean;canPublish:boolean;mfaVerified:boolean};
export type ReviewCommand={action:string;caseId:string;proposalId:string;operationId:string;expectedReviewVersion:number;expectedCaseVersion:number;expectedNoticeVersion:number;reason?:string;evidenceReference?:string;notice?:NoticeText;resolutionMessage?:string};
export type NoticeReview={protocol:typeof NOTICE_REVIEW_PROTOCOL;id:string;tenantId:string;batchId:string;caseId:string;kind:'correction'|'lift';state:'draft'|'in_review'|'changes_requested'|'applied'|'cancelled';version:number;baseCaseVersion:number;baseNoticeVersion:number;baseNotice:NoticeText;createdBy:string;contributorIds:string[];createdAt:string;updatedAt:string;submittedAt:string|null;approvedBy:string|null;approvedAt:string|null;requestedNotice:NoticeText|null;resolutionMessage:string|null;reason:string;evidenceReference:string;contentDigest:string};
export type NoticePlan={protocol:typeof NOTICE_REVIEW_PROTOCOL;review:NoticeReview;effect:null|{kind:'replace_notice'|'lift_notice';scope:{tenantId:string;batchId:string;caseId:string};expectedCaseVersion:number;expectedNoticeVersion:number;nextNoticeVersion:number;notice:NoticeText;noticeState:'active'|'lifted';resolutionMessage:string|null;issuedAt:string;approvedBy:string;doesNotDetermineNfcAuthenticity:true;doesNotReleaseProduct:true};audit:Record<string,unknown>;idempotency:Record<string,unknown>;requiresAtomicPersistence:true;persisted:false};
export function noticeReviewDigest(value:unknown):string;
export function parseNoticeReviewCommand(action:string,raw:unknown):ReviewCommand;
export function authorizeNoticeReview(actor:NoticeAuthority,current:NoticeSource,action:string):string;
export function planNoticeReview(args:{current:NoticeSource;review?:unknown;actor:NoticeAuthority;action:string;body:unknown;now:string}):NoticePlan;
