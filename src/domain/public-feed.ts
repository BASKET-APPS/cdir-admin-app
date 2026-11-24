import {publicEvent} from './commands';
import type {State} from './types';
// Public website feed. Only explicitly whitelisted fields leave the server.
export const PUBLIC_SECTIONS=['events','matches','magazines','activities'] as const;
export type PublicSection=typeof PUBLIC_SECTIONS[number];
/** `?sections=matches,magazines`; missing, empty or unknown values mean every section (backwards compatible). */
export function parseSections(raw:string|null|undefined):PublicSection[]{
 const wanted=new Set((raw||'').split(',').map(x=>x.trim()).filter((x):x is PublicSection=>(PUBLIC_SECTIONS as readonly string[]).includes(x)));
 return wanted.size?PUBLIC_SECTIONS.filter(x=>wanted.has(x)):[...PUBLIC_SECTIONS];
}
export type PublicFeedSource=Pick<State,'events'|'forms'|'applications'|'matches'|'seasons'|'teams'|'magazines'|'clubActivities'>;
export function publicFeed(s:PublicFeedSource,sections:PublicSection[],registrationEnabled:boolean){
 const out:Record<string,unknown>={};
 if(sections.includes('events'))out.events=publicEvent(s as State).map(({id,title,slug,kind,description,location,startsAt,endsAt,price,registrationOpen,imageUrl})=>({id,title,slug,kind,description,location,startsAt,endsAt,price,imageUrl,registrationOpen:registrationOpen&&registrationEnabled}));
 if(sections.includes('matches')){const seasons=new Map(s.seasons.map(y=>[y.id,y.name])),teams=new Map(s.teams.map(t=>[t.id,t.name]));out.matches=s.matches.filter(m=>m.published).map(({id,teamId,seasonId,startsAt,endsAt,opponent,venue,location,competition,status,scoreFor,scoreAgainst,isExample})=>({id,season:seasons.get(seasonId)||'',team:teams.get(teamId)||'CDIR',startsAt,endsAt,opponent,venue,location,competition,status,scoreFor,scoreAgainst,isExample}));}
 if(sections.includes('magazines'))out.magazines=s.magazines.filter(m=>m.published&&m.pdfPath).map(({id,title,description,pdfPath,publishedAt,isExample})=>({id,title,description,pdfPath,publishedAt,isExample}));
 if(sections.includes('activities'))out.activities=s.clubActivities.filter(a=>a.published).map(({id,title,description,startsAt,location,imageUrl,isExample})=>({id,title,description,startsAt,location,imageUrl,isExample}));
 return out;
}
