import 'server-only';
import {emptyState,type State} from '@/domain/types';
import type {PublicSection} from '@/domain/public-feed';
import {readState} from './store';
import {readSqlConnectLists,sqlConnect,type ListSpec} from './sql-connect-store';
import {normalizeWorkspacePage} from '@/domain/sql-connect';
import {recentMatches,RECENT_RESULTS_LIMIT,UPCOMING_MATCHES_LIMIT,type MatchView} from '@/domain/public-matches';
const eventFields=['id','seasonId','title','slug','kind','description','location','startsAt','endsAt','capacity','price','status','registrationOpen','formId','imageUrl'];
const matchFields=['id','seasonId','teamId','startsAt','endsAt','opponent','venue','location','competition','status','scoreFor','scoreAgainst','published','isExample'];
/**
 * Loads only the rows a public response needs. With SQL Connect this replaces the full club snapshot
 * (players, families, bank data, audit…) by filtered queries; other adapters keep the previous behaviour.
 * `registration` = also load active forms and the CONFIRMED application count (no personal fields).
 */
export async function readPublicSlice(sections:PublicSection[],options:{registration:boolean;contents?:boolean;slug?:string;matchView?:MatchView}):Promise<State>{
 const recent=options.matchView==='recent',now=new Date().toISOString();
 if(process.env.CDIR_DATABASE!=='sql-connect'){const state=await readState();return recent?{...state,matches:recentMatches(state.matches,now)}:state;}
 const specs:ListSpec[]=[];
 if(sections.includes('events'))specs.push({key:'events',where:'{status: {eq: "PUBLISHED"}'+(options.slug?', slug: {eq: $slug}':'')+'}',fields:eventFields});
 if(sections.includes('matches')){
  if(!recent)specs.push({key:'matches',where:'{published: {eq: true}}',fields:matchFields});
  specs.push({key:'teams',fields:['id','name']},{key:'seasons',fields:['id','name']});
 }
 if(sections.includes('magazines'))specs.push({key:'magazines',where:'{published: {eq: true}}',fields:['id','title','description','pdfPath','publishedAt','published','isExample']});
 if(sections.includes('activities'))specs.push({key:'clubActivities',where:'{published: {eq: true}}',fields:['id','title','description','startsAt','location','imageUrl','published','isExample']});
 if(options.contents)specs.push({key:'contents',where:'{status: {eq: "PUBLISHED"}}',fields:['id','kind','title','body','url','status']});
 if(!specs.length)return emptyState();
 const state=await readSqlConnectLists(specs,options.slug&&sections.includes('events')?{definitions:'$slug: String!',values:{slug:options.slug}}:undefined);
 if(recent&&sections.includes('matches')){
  const fields=matchFields.join(' ');
  const data=(await sqlConnect().executeGraphqlRead<{latest:State['matches'];upcoming:State['matches']},{now:string}>(`query RecentMatches($now: Timestamp!) @auth(level: NO_ACCESS) {
   latest: matches(where: {published: {eq: true}, status: {eq: "FINAL"}, startsAt: {le: $now}}, orderBy: [{startsAt: DESC}, {id: DESC}], limit: ${RECENT_RESULTS_LIMIT}) {${fields}}
   upcoming: matches(where: {published: {eq: true}, startsAt: {ge: $now}}, orderBy: [{startsAt: ASC}, {id: ASC}], limit: ${UPCOMING_MATCHES_LIMIT}) {${fields}}
  }`,{variables:{now}})).data;
  state.matches=recentMatches(normalizeWorkspacePage({matches:[...data.latest,...data.upcoming]}).matches,now);
 }
 if(options.registration&&state.events.length){
  const ids=[...new Set(state.events.map(e=>e.id))],forms=[...new Set(state.events.flatMap(e=>e.formId?[e.formId]:[]))];
  const extra=await readSqlConnectLists([
   ...(forms.length?[{key:'forms' as const,where:'{id: {in: $forms}, active: {eq: true}}'}]:[]),
   {key:'applications',where:'{eventId: {in: $events}, status: {eq: "CONFIRMED"}}',fields:['id','eventId','status']},
  ],{definitions:'$events: [UUID!]!'+(forms.length?', $forms: [UUID!]!':''),values:{events:ids,...(forms.length?{forms}:{})}});
  state.forms=extra.forms;state.applications=extra.applications;
 }
 return state;
}
