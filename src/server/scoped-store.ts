import 'server-only';
import type {Identity,State} from '@/domain/types';
import {emptyState} from '@/domain/types';
import {changedRows,workspaceMutation,markOmittedAvatars} from '@/domain/sql-connect';
import {sliceState,workspaceScope,AUDIT_PAGE,NOTIFICATION_LIMIT,type WorkspaceScope} from '@/domain/scope';
import {ConflictError,SAME_RECORD_MESSAGE,assertExpected} from '@/domain/concurrency';
import {retentionReminders} from '@/domain/club-operations';
import {readState,transaction as storeTransaction} from './store';
import {sqlConnect,readSqlConnectLists,readConsistentLists,sqlConnectRevision,fullSqlConnectSnapshot,type ListSpec,type Vars} from './sql-connect-store';
import {invalidatePublicCache} from './public-cache';
const sql=()=>process.env.CDIR_DATABASE==='sql-connect';
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
const uuids=(x:unknown)=>Array.isArray(x)?[...new Set(x.filter(uuid))]:[];
type Loaded={state:State;version:number|null};

// ---------------------------------------------------------------- reads
const profileFields=['id','uid','googlePhotoUrl','avatarVersion','avatarSource','googleSyncedAt','updatedAt'];
function workspaceSpecs(c:WorkspaceScope):{specs:ListSpec[];vars:Vars}{
 const T=c.teamIds!==null,team=T?', teamId: {in: $teams}':'';
 const requests=T?'{_and: [{seasonId: {eq: $sid}}, {_or: [{teamId: {in: $teams}}, {requestedBy: {eq: $uid}}]}]}':'{seasonId: {eq: $sid}}';
 const scoped:Partial<Record<keyof State,ListSpec>>={
  sessions:{key:'sessions',where:`{seasonId: {eq: $sid}${team}}`},
  attendance:{key:'attendance',where:`{session: {seasonId: {eq: $sid}${team}}}`},
  crossTrainings:{key:'crossTrainings',where:`{seasonId: {eq: $sid}${T?', destinationSession: {teamId: {in: $teams}}':''}}`},
  matches:{key:'matches',where:`{seasonId: {eq: $sid}${team}}`},
  playerRequests:{key:'playerRequests',where:requests},
  requestPlayers:{key:'requestPlayers',where:`{request: ${requests}}`},
  events:{key:'events',where:'{seasonId: {eq: $sid}}'},applications:{key:'applications',where:'{seasonId: {eq: $sid}}'},invoices:{key:'invoices',where:'{seasonId: {eq: $sid}}'},
  supportSessions:{key:'supportSessions',where:'{seasonId: {eq: $sid}}'},
  supportParticipants:{key:'supportParticipants',where:'{session: {seasonId: {eq: $sid}}}'},supportAttendance:{key:'supportAttendance',where:'{session: {seasonId: {eq: $sid}}}'},
  notifications:{key:'notifications',where:c.admin?'{_or: [{recipientUid: {eq: $uid}}, {adminOnly: {eq: true}}]}':'{recipientUid: {eq: $uid}}',orderBy:'[{createdAt: DESC}, {id: DESC}]',max:NOTIFICATION_LIMIT},
  audit:{key:'audit',where:c.admin?undefined:'{actorUid: {eq: $uid}}',orderBy:'[{at: DESC}, {id: DESC}]',max:AUDIT_PAGE+1},
  profiles:{key:'profiles',fields:profileFields},
 };
 const all=Object.keys(emptyState()) as (keyof State)[];
 return {specs:all.map(k=>scoped[k]||{key:k}),vars:{definitions:'$sid: UUID!, $uid: String!, $teams: [UUID!]!',values:{sid:c.seasonId,uid:c.uid,teams:c.teamIds||[]}}};
}
/** Season (and team, for coaches) slice of the club for the panel. */
export async function readWorkspace(u:Identity,wanted?:string|null):Promise<{state:State;version:number|null;auditHasMore:boolean;seasonId:string}>{
 if(!sql()){const full=await readState(),seasonId=pickSeason(full.seasons,wanted);const out=sliceState(full,workspaceScope(u,seasonId));return {state:out,version:null,auditHasMore:out.auditHasMore,seasonId};}
 const seasons=(await readSqlConnectLists([{key:'seasons'}])).seasons,seasonId=pickSeason(seasons,wanted);
 const c=workspaceScope(u,seasonId),{specs,vars}=workspaceSpecs(c);
 const {state,version}=await readConsistentLists(specs,vars);markOmittedAvatars(state);
 const auditHasMore=state.audit.length>AUDIT_PAGE;state.audit=state.audit.slice(0,AUDIT_PAGE).reverse();
 return {state,version,auditHasMore,seasonId};
}
function pickSeason(seasons:State['seasons'],wanted?:string|null){if(wanted&&seasons.some(s=>s.id===wanted))return wanted;return seasons.find(s=>s.current)?.id||seasons[0]?.id||'';}
/** Older audit rows (visible to this user), newest first. */
export async function readAuditPage(u:Identity,before:string|null,beforeId:string|null=null){
 const admin=u.role==='ADMIN';
 if(!sql()){const all=(await readState()).audit.filter(a=>admin||a.actorUid===u.uid).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id)).filter(a=>!before||a.at<before||(a.at===before&&!!beforeId&&a.id<beforeId));return {rows:all.slice(0,AUDIT_PAGE),hasMore:all.length>AUDIT_PAGE};}
 // Legacy clients may still send only `before`; new clients use both components of the ordering.
 const cursor=before?(beforeId?'_or: [{at: {lt: $before}}, {at: {eq: $before}, id: {lt: $beforeId}}]':'at: {lt: $before}'):'';
 const parts=[admin?'':'actorUid: {eq: $uid}',cursor].filter(Boolean);
 const where=parts.length>1?'_and: ['+parts.map(p=>'{'+p+'}').join(', ')+']':parts[0];
 const rows=(await readSqlConnectLists([{key:'audit',where:where?'{'+where+'}':undefined,orderBy:'[{at: DESC}, {id: DESC}]',max:AUDIT_PAGE+1}],{definitions:'$uid: String!, $before: Timestamp!, $beforeId: UUID!',values:{uid:u.uid,before:before||'',beforeId:beforeId||''}})).audit;
 return {rows:rows.slice(0,AUDIT_PAGE),hasMore:rows.length>AUDIT_PAGE};
}

// ---------------------------------------------------------------- scoped transactions
function merge(into:State,part:State){for(const k of Object.keys(part) as (keyof State)[]){const have=new Set((into[k] as {id:string}[]).map(r=>r.id));for(const r of part[k] as {id:string}[])if(!have.has(r.id)){(into[k] as unknown[]).push(r);have.add(r.id);}}}
async function stage(s:State,specs:ListSpec[],vars?:Vars){if(specs.length)merge(s,await readSqlConnectLists(specs,vars));}
const APPROVED_TRAINING='status: {eq: "APPROVED"}, kind: {eq: "TRAINING"}, recurring: {eq: true}';
/** Minimal rows each frequent command reads (see the differential tests in tests/unit/scoped-commands.test.ts). */
const loaders:Record<string,(s:State,p:Record<string,unknown>)=>Promise<void>>={
 async attendance(s,p){if(!uuid(p.sessionId)||!uuid(p.playerSeasonId))return;
  await stage(s,[{key:'sessions',where:'{id: {eq: $s}}'},{key:'playerSeasons',where:'{id: {eq: $p}}'},{key:'attendance',where:'{sessionId: {eq: $s}, playerSeasonId: {eq: $p}}'},{key:'crossTrainings',where:'{playerSeasonId: {eq: $p}, destinationSessionId: {eq: $s}}'},{key:'seasons'}],{definitions:'$s: UUID!, $p: UUID!',values:{s:p.sessionId,p:p.playerSeasonId}});
  const session=s.sessions[0];if(!session)return;
  await stage(s,[{key:'playerRequests',where:`{teamId: {eq: $t}, seasonId: {eq: $sid}, ${APPROVED_TRAINING}}`},{key:'requestPlayers',where:`{request: {teamId: {eq: $t}, seasonId: {eq: $sid}, ${APPROVED_TRAINING}}}`}],{definitions:'$t: UUID!, $sid: UUID!',values:{t:session.teamId,sid:session.seasonId}});
 },
 async matchResult(s,p){if(!uuid(p.id))return;
  await stage(s,[{key:'matches',where:'{id: {eq: $m}}'},{key:'seasons'},{key:'categories'}],{definitions:'$m: UUID!',values:{m:p.id}});
  const m=s.matches[0];if(!m)return;
  await stage(s,[{key:'teamDetails',where:'{teamId: {eq: $t}}'},{key:'teams',where:'{id: {eq: $t}}'}],{definitions:'$t: UUID!',values:{t:m.teamId}});
 },
 async publishMatch(s,p){if(uuid(p.id))await stage(s,[{key:'matches',where:'{id: {eq: $m}}'},{key:'seasons'}],{definitions:'$m: UUID!',values:{m:p.id}});},
 async cancelMatch(s,p){await loaders.publishMatch(s,p);},
 async readNotification(s,p){if(uuid(p.id))await stage(s,[{key:'notifications',where:'{id: {eq: $n}}'}],{definitions:'$n: UUID!',values:{n:p.id}});},
 async requestPlayers(s,p){if(!uuid(p.teamId))return;const pids=uuids(p.proposedPlayerIds),target=p.kind==='MATCH'?p.matchId:p.sessionId;
  await stage(s,[{key:'teams',where:'{id: {eq: $team}}'},{key:'seasons'},{key:'categories'},{key:'playerSeasons',where:'{id: {in: $pids}}'},{key:'requestPlayers',where:'{playerSeasonId: {in: $pids}}'},...(uuid(target)?[{key:(p.kind==='MATCH'?'matches':'sessions') as keyof State,where:'{id: {eq: $target}}'}]:[])],{definitions:'$team: UUID!, $pids: [UUID!]!, $target: UUID!',values:{team:p.teamId,pids,target:uuid(target)?target:''}});
  const team=s.teams.find(t=>t.id===p.teamId);if(!team)return;await promotionContext(s,team.seasonId,[team.id]);
 },
 async resolveRequest(s,p){if(!uuid(p.id))return;const pids=uuids(p.playerSeasonIds);
  await stage(s,[{key:'playerRequests',where:'{id: {eq: $r}}'},{key:'seasons'},{key:'categories'},{key:'playerSeasons',where:'{id: {in: $pids}}'},{key:'requestPlayers',where:'{playerSeasonId: {in: $pids}}'}],{definitions:'$r: UUID!, $pids: [UUID!]!',values:{r:p.id,pids}});
  const r=s.playerRequests.find(x=>x.id===p.id);if(!r)return;
  const target=r.kind==='MATCH'?r.matchId:r.sessionId;
  await stage(s,[...(uuid(target)?[{key:(r.kind==='MATCH'?'matches':'sessions') as keyof State,where:'{id: {eq: $target}}'}]:[]),...(r.kind==='TRAINING'&&uuid(r.sessionId)?[{key:'crossTrainings' as const,where:'{destinationSessionId: {eq: $target}}'}]:[])],{definitions:'$target: UUID!',values:{target:target||''}});
  await promotionContext(s,r.seasonId,[r.teamId]);
 },
};
/** Rows used by mayPromote() and requestConflicts() for the loaded player seasons. */
async function promotionContext(s:State,seasonId:string,teamIds:string[]){
 const sources=[...new Set(s.playerSeasons.flatMap(p=>p.teamId?[p.teamId]:[]))],teams=[...new Set([...teamIds,...sources])],players=[...new Set(s.playerSeasons.map(p=>p.playerId))],requests=[...new Set(s.requestPlayers.map(r=>r.requestId))];
 await stage(s,[{key:'teams',where:'{id: {in: $teams}}'},{key:'teamDetails',where:'{teamId: {in: $teams}}'},{key:'players',where:'{id: {in: $players}}'},{key:'playerRequests',where:'{id: {in: $requests}}'}],{definitions:'$teams: [UUID!]!, $players: [UUID!]!, $requests: [UUID!]!',values:{teams,players,requests}});
 const extra=[...new Set(s.playerRequests.filter(r=>r.status==='APPROVED'&&r.kind==='MATCH'&&r.matchId&&requests.includes(r.id)).map(r=>r.matchId!))];
 if(sources.length||extra.length)await stage(s,[{key:'matches',where:'{_and: [{seasonId: {eq: $sid}}, {_or: [{teamId: {in: $sources}}, {id: {in: $extra}}]}]}'}],{definitions:'$sid: UUID!, $sources: [UUID!]!, $extra: [UUID!]!',values:{sid:seasonId,sources,extra}});
}
export const scopedActions=new Set(Object.keys(loaders));
export const isScoped=(action:string)=>scopedActions.has(action)&&process.env.CDIR_SCOPED_COMMANDS!=='false';

/**
 * Optimistic transaction over the global revision (compare-and-swap). If another change committed in
 * between, it is retried on fresh data — unless that change touched a record this command modifies,
 * which is reported as a conflict instead of being overwritten.
 */
async function optimistic<T>(load:()=>Promise<{state:State;version:number}>,fn:(s:State)=>T|Promise<T>){
 let first:State|null=null;
 for(let attempt=0;attempt<3;attempt++){
  const {state,version}=await load(),before=structuredClone(state),result=await fn(state);
  if(first)for(const c of changedRows(before,state)){const id=(c.row as {id:string}).id,orig=(first[c.key] as {id:string}[]).find(r=>r.id===id),now=(before[c.key] as {id:string}[]).find(r=>r.id===id);if(JSON.stringify(orig)!==JSON.stringify(now))throw new ConflictError(SAME_RECORD_MESSAGE);}
  const mutation=workspaceMutation(before,state,version);
  if(!mutation)return {result,before,after:state,version,committed:version};
  try{await sqlConnect().executeGraphql(mutation.query,{variables:mutation.variables});return {result,before,after:state,version,committed:version+1};}
  catch(e){if(!String(e).includes('CDIR_CONCURRENT_CHANGE'))throw e;first??=before;}
 }
 throw new Error('Otra persona ha guardado cambios. Recarga y vuelve a intentarlo.');
}
async function scopedLoad(action:string,payload:unknown):Promise<{state:State;version:number}>{const version=await sqlConnectRevision(),state=emptyState();await loaders[action](state,(payload||{}) as Record<string,unknown>);return {state,version};}

export type CommandResult={before:State;after:State;version:number|null;committed:number|null;scoped:boolean};
/**
 * Runs a workspace command. Frequent commands read only their rows; the rest keep the full transaction.
 * `expected` is what the user saw for the edited record (see domain/concurrency.ts).
 */
export async function runCommand(action:string,payload:unknown,expected:unknown,fn:(s:State)=>void|Promise<void>):Promise<CommandResult>{
 const guarded=async(s:State)=>{assertExpected(s,action,payload,expected);await fn(s);};
 if(!sql()){let before:State|null=null,after:State|null=null;await storeTransaction(async s=>{before=structuredClone(s);await guarded(s);after=structuredClone(s);});return {before:before!,after:after!,version:null,committed:null,scoped:scopedActions.has(action)&&process.env.CDIR_SCOPED_COMMANDS!=='false'};}
 // CDIR_SCOPED_COMMANDS=false forces the previous full transaction (rollback switch, also used by tests).
 const scoped=scopedActions.has(action)&&process.env.CDIR_SCOPED_COMMANDS!=='false';
 const out=await optimistic(scoped?()=>scopedLoad(action,payload):()=>fullSqlConnectSnapshot(),guarded);
 invalidatePublicCache();
 return {before:out.before,after:out.after,version:out.version,committed:out.committed,scoped};
}

/** Weekly privacy reminders for admins, with only the rows they depend on. */
export async function ensureRetentionReminders(now=new Date()){
 const weekStart=new Date(Math.floor(now.getTime()/(7*86400000))*7*86400000).toISOString();
 const load=async()=>{const version=await sqlConnectRevision(),state=emptyState();await stage(state,[{key:'playerDetails'},{key:'players',fields:['id','name','birthDate','email','phone','active']},{key:'notifications',where:'{dedupeKey: {startsWith: "retention-"}, createdAt: {ge: $since}}'}],{definitions:'$since: Timestamp!',values:{since:weekStart}});return {state,version};};
 if(!sql()){const s=await readState(),preview=structuredClone(s);retentionReminders(preview,now);if(preview.notifications.length!==s.notifications.length)await storeTransaction(x=>{retentionReminders(x,now);});return;}
 const {state}=await load(),preview=structuredClone(state);retentionReminders(preview,now);
 if(preview.notifications.length===state.notifications.length)return;
 await optimistic(load,s=>{retentionReminders(s,now);});
}

/** Rows /api/requests/candidates needs: one season of sports data plus the target activity. */
export async function readCandidatesState(input:{requestId?:string;teamId?:string;targetId?:string;kind?:string}):Promise<State>{
 if(!sql())return readState();
 const s=emptyState();
 await stage(s,[...(uuid(input.requestId)?[{key:'playerRequests' as const,where:'{id: {eq: $r}}'}]:[]),...(uuid(input.teamId)?[{key:'teams' as const,where:'{id: {eq: $t}}'}]:[])],{definitions:'$r: UUID!, $t: UUID!',values:{r:input.requestId||'',t:input.teamId||''}});
 const seasonId=s.playerRequests[0]?.seasonId||s.teams[0]?.seasonId;if(!seasonId)return s;
 await stage(s,[{key:'seasons'},{key:'categories'},{key:'teams',where:'{seasonId: {eq: $sid}}'},{key:'teamDetails',where:'{team: {seasonId: {eq: $sid}}}'},{key:'playerSeasons',where:'{seasonId: {eq: $sid}}'},{key:'players'},{key:'playerDetails'},{key:'matches',where:'{seasonId: {eq: $sid}}'},{key:'playerRequests',where:'{seasonId: {eq: $sid}}'},{key:'requestPlayers',where:'{request: {seasonId: {eq: $sid}}}'},...(uuid(input.targetId)&&input.kind==='TRAINING'?[{key:'sessions' as const,where:'{id: {eq: $target}}'}]:[])],{definitions:'$sid: UUID!, $target: UUID!',values:{sid:seasonId,target:input.targetId||''}});
 const r=s.playerRequests.find(x=>x.id===input.requestId);if(r?.sessionId&&!s.sessions.some(x=>x.id===r.sessionId))await stage(s,[{key:'sessions',where:'{id: {eq: $target}}'}],{definitions:'$target: UUID!',values:{target:r.sessionId}});
 return s;
}
