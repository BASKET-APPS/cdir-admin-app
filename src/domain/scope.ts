import type {Identity,State} from './types';
import {can} from './permissions';
// What the administration panel loads for one screen: the selected season, and for coaches only their
// teams. Small catalogues stay complete (seasons, teams, players, coaches…) because history views use
// them; the tables that grow every week are filtered. The SAME rules drive the SQL Connect filters
// (server/scoped-store.ts) and the in-memory slice used by other adapters and by the tests.
export type WorkspaceScope={seasonId:string;uid:string;admin:boolean;/** null = every team */teamIds:string[]|null};
export const NOTIFICATION_LIMIT=500,AUDIT_PAGE=200;
export function workspaceScope(u:Identity,seasonId:string):WorkspaceScope{
 // Coaches (sports access through COACH function) only ever see their teams' sports rows (see visibleState).
 const teamScoped=u.role==='COACH';
 return {seasonId,uid:u.uid,admin:u.role==='ADMIN',teamIds:teamScoped?(can(u,'sports')?[...u.teamIds]:[]):null};
}
export type Index={sessions:Map<string,{seasonId:string;teamId:string}>;requests:Map<string,{seasonId:string;teamId:string;requestedBy:string}>;support:Map<string,{seasonId:string}>};
export function indexOf(s:Pick<State,'sessions'|'playerRequests'|'supportSessions'>):Index{return {sessions:new Map(s.sessions.map(x=>[x.id,x])),requests:new Map(s.playerRequests.map(x=>[x.id,x])),support:new Map(s.supportSessions.map(x=>[x.id,x]))};}
const team=(c:WorkspaceScope,teamId:string|null|undefined)=>c.teamIds===null||(!!teamId&&c.teamIds.includes(teamId));
const request=(c:WorkspaceScope,r:{seasonId:string;teamId:string;requestedBy:string}|undefined)=>!!r&&r.seasonId===c.seasonId&&(c.teamIds===null||c.teamIds.includes(r.teamId)||r.requestedBy===c.uid);
type Keep=(row:Record<string,unknown>,c:WorkspaceScope,ix:Index)=>boolean;
export const scopedRules:Partial<Record<keyof State,Keep>>={
 sessions:(r,c)=>r.seasonId===c.seasonId&&team(c,r.teamId as string),
 attendance:(r,c,ix)=>{const x=ix.sessions.get(r.sessionId as string);return !!x&&x.seasonId===c.seasonId&&team(c,x.teamId);},
 crossTrainings:(r,c,ix)=>r.seasonId===c.seasonId&&(c.teamIds===null||team(c,ix.sessions.get(r.destinationSessionId as string)?.teamId)),
 matches:(r,c)=>r.seasonId===c.seasonId&&team(c,r.teamId as string),
 playerRequests:(r,c)=>request(c,r as never),
 requestPlayers:(r,c,ix)=>request(c,ix.requests.get(r.requestId as string)),
 events:(r,c)=>r.seasonId===c.seasonId,
 applications:(r,c)=>r.seasonId===c.seasonId,
 invoices:(r,c)=>r.seasonId===c.seasonId,
 supportSessions:(r,c)=>r.seasonId===c.seasonId,
 supportParticipants:(r,c,ix)=>ix.support.get(r.sessionId as string)?.seasonId===c.seasonId,
 supportAttendance:(r,c,ix)=>ix.support.get(r.sessionId as string)?.seasonId===c.seasonId,
 notifications:(r,c)=>r.recipientUid===c.uid||(c.admin&&r.adminOnly===true),
 audit:(r,c)=>c.admin||r.actorUid===c.uid,
};
/** In-memory equivalent of the scoped database read (JSON/PostgreSQL adapters and tests). */
export function sliceState(s:State,c:WorkspaceScope):State&{auditHasMore:boolean}{
 const ix=indexOf(s),out={...s} as State&{auditHasMore:boolean};
 for(const [key,keep] of Object.entries(scopedRules) as [keyof State,Keep][])(out[key] as unknown[])=(s[key] as unknown as Record<string,unknown>[]).filter(r=>keep(r,c,ix));
 out.notifications=[...out.notifications].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).slice(0,NOTIFICATION_LIMIT);
 const audit=[...out.audit].sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));out.auditHasMore=audit.length>AUDIT_PAGE;out.audit=audit.slice(0,AUDIT_PAGE).reverse();
 return out;
}
