import type {ProductNoticesV2} from './product-notices-v2';
export type PublicNoticeSignal='not_checked'|'checking'|'unknown'|'warning'|'stale_warning'|'lifted'|'none'|'more';
export function publicNoticeSignal(input:{enabled:boolean;loading:boolean;failed:boolean;value:ProductNoticesV2|null}|null):PublicNoticeSignal{
 if(!input?.enabled)return 'not_checked';
 const active=input.value?.notices.some(n=>n.noticeState==='active');
 if(active)return input.loading||input.failed?'stale_warning':'warning';
 if(input.loading)return 'checking';
 if(input.failed||!input.value)return 'unknown';
 if(input.value.hasMore)return 'more';
 if(input.value.notices.length)return 'lifted';
 return 'none';
}
export type EvidenceCarrier='secure_nfc'|'tagtamper'|'qr'|'gs1'|'basic_nfc'|'uhf'|'unknown';
export function evidenceCarrier(code:string,isQr:boolean):EvidenceCarrier{
 if(code==='gs1_digital_link')return 'gs1';
 if(isQr||code==='qr_basic')return 'qr';
 if(code==='ntag424_dna_tt')return 'tagtamper';
 if(code==='ntag424_dna')return 'secure_nfc';
 if(['ntag213','ntag215','ntag216'].includes(code))return 'basic_nfc';
 if(code==='uhf_rfid')return 'uhf';
 return 'unknown';
}
