import {headers} from 'next/headers';
import {stripConsumerTapCapabilityCookies} from '../../api/_lib/consumer-tap-handoff';
import {productUrls} from '@product/config';
import {requireConsumerSession,buildConsumerNextPath} from '../_components/consumer-api';
import {PortalShell} from '../_components/portal-shell';
import {ConsumerHistory} from './consumer-history';
import {boundedHistoryJson,parseHistory,historyParams,EMPTY_HISTORY_FILTERS,type HistoryPage} from './history-model';
export default async function TapsTimelinePage({searchParams}:{searchParams?:Promise<Record<string,string|string[]|undefined>>}){
 const p=await searchParams||{};await requireConsumerSession(buildConsumerNextPath('/me/taps',p));
 const filters={...EMPTY_HISTORY_FILTERS};for(const k of ['tenant','from','to','event'] as const)if(typeof p[k]==='string')filters[k]=p[k] as string;
 let initial:HistoryPage|null=null;
 try{const h=await headers(),r=await fetch(productUrls.api+'/consumer/taps/history?'+historyParams(filters),{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{cookie:stripConsumerTapCapabilityCookies(h.get('cookie')),'user-agent':h.get('user-agent')||'nexid-web-history'}});if(r.ok)initial=parseHistory(await boundedHistoryJson(r),{query:filters,page:1});}catch{}
 return <PortalShell title="Historial de lecturas" subtitle="Encontrá tus lecturas guardadas y volvé a su evidencia sin repetir el TAP."><ConsumerHistory initial={initial} initialFilters={filters}/></PortalShell>;
}
