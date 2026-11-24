import type {State} from './types';
// Homepage only: keep its payload bounded as seasons accumulate. The archive API stays unchanged.
export type MatchView='archive'|'recent';
export const RECENT_RESULTS_LIMIT=80,UPCOMING_MATCHES_LIMIT=80;
export function recentMatches(matches:State['matches'],now=new Date().toISOString()){
 const published=matches.filter(m=>m.published);
 const latest=published.filter(m=>m.status==='FINAL'&&m.startsAt<=now).sort((a,b)=>b.startsAt.localeCompare(a.startsAt)||b.id.localeCompare(a.id)).slice(0,RECENT_RESULTS_LIMIT);
 const next=published.filter(m=>m.startsAt>=now).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)||a.id.localeCompare(b.id)).slice(0,UPCOMING_MATCHES_LIMIT);
 return [...new Map([...latest,...next].map(m=>[m.id,m])).values()];
}
