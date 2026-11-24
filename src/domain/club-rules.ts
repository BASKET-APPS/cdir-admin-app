import type {State} from './types';
import type {PlayerRequest} from './club-types';
function row<T extends {id:string}>(items:T[],key:string){const r=items.find(x=>x.id===key);if(!r)throw Error('Registro no encontrado.');return r;}
export function mayPromote(s:State,playerSeasonId:string,destinationTeamId:string){
 const p=row(s.playerSeasons,playerSeasonId),source=s.teams.find(t=>t.id===p.teamId),dest=row(s.teams,destinationTeamId);
 if(!source||!s.players.find(x=>x.id===p.playerId)?.active||p.status!=='ACTIVE')return {allowed:false,reason:'Jugador sin alta o equipo habitual activo.'};
 if(source.id===dest.id||source.seasonId!==dest.seasonId||source.branch!==dest.branch)return {allowed:false,reason:'Debe ser otro equipo de la misma rama y temporada.'};
 const a=s.teamDetails.find(x=>x.teamId===source.id),b=s.teamDetails.find(x=>x.teamId===dest.id);
 if(!a||!b)return {allowed:false,reason:'Completa la categoría y el año de ambos equipos.'};
 const ac=row(s.categories,a.categoryId),bc=row(s.categories,b.categoryId),ar=ac.sortOrder*10+a.yearGroup,br=bc.sortOrder*10+b.yearGroup;
 const allowed=br>ar||(br===ar&&b.groupCode<a.groupCode);
 return {allowed,reason:allowed?'Subida permitida':'No se permiten bajadas de categoría, año o grupo.'};
}
const day=(date:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const MATCH_START_GAP_MS=2*60*60*1000;
export function requestConflicts(s:State,request:PlayerRequest,playerSeasonId:string){
 const ps=row(s.playerSeasons,playerSeasonId),target=request.matchId?s.matches.find(m=>m.id===request.matchId):s.sessions.find(x=>x.id===request.sessionId);
 if(!target)return [];
 const extraMatchIds=new Set<string>();for(const rp of s.requestPlayers.filter(p=>p.playerSeasonId===ps.id)){const r=s.playerRequests.find(x=>x.id===rp.requestId&&x.status==='APPROVED');if(r?.kind==='MATCH'&&r.matchId)extraMatchIds.add(r.matchId);}
 const start=Date.parse(target.startsAt),end=Date.parse(target.endsAt);
 return s.matches.filter(m=>m.id!==request.matchId&&m.status!=='CANCELLED'&&m.seasonId===request.seasonId&&(m.teamId===ps.teamId||extraMatchIds.has(m.id))).flatMap(m=>{
  const otherStart=Date.parse(m.startsAt),otherEnd=Date.parse(m.endsAt);
  const overlaps=otherStart<end&&otherEnd>start;
  // Different match days are compatible. On the same Madrid date the
  // kick-offs must be strictly more than two hours apart.
  const recoveryConflict=request.kind==='MATCH'&&day(m.startsAt)===day(target.startsAt)&&Math.abs(start-otherStart)<=MATCH_START_GAP_MS;
  if(!overlaps&&!recoveryConflict)return [];
  const date=new Intl.DateTimeFormat('es-ES',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Madrid'}).format(new Date(m.startsAt));
  return [{id:m.id,label:`${s.teams.find(t=>t.id===m.teamId)?.name} · ${m.opponent} · ${date}${!overlaps?' · Los inicios deben separarse más de 2 h':''}`,overlap:true}];
 });
}
export function recurringParticipants(s:State,sessionId:string){const session=row(s.sessions,sessionId);const requests=new Set(s.playerRequests.filter(r=>r.status==='APPROVED'&&r.kind==='TRAINING'&&r.recurring&&r.teamId===session.teamId&&r.seasonId===session.seasonId&&r.neededAt<=session.startsAt).map(r=>r.id));return s.requestPlayers.filter(p=>requests.has(p.requestId)).map(p=>p.playerSeasonId);}
