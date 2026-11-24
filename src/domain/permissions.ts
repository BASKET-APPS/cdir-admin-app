import {coachIdentity} from './people';
import {recurringParticipants} from './club-rules';
import {coachPhoto} from './coach-photo';
import type {Identity,State,PublicState} from './types';
export type Permission='people'|'sports'|'events'|'applications'|'finance'|'content'|'users'|'support';
const grants:Record<Identity['role'],Permission[]>={ADMIN:['people','sports','events','applications','finance','content','users'],SECRETARY:['people','applications'],COORDINATOR:['sports','events'],COACH:['sports'],TREASURY:['finance'],EDITOR:['content','events'],DIRECTOR:[]};
export function can(user:Identity,permission:Permission){return user.active&&(permission==='support'?(user.role==='ADMIN'||user.role==='COACH'&&!!user.staffFunctions?.some(f=>f==='PHYSICAL'||f==='PSYCHOLOGY')):permission==='sports'&&user.role==='COACH'?(!user.staffFunctions||user.staffFunctions.includes('COACH')):grants[user.role].includes(permission));}
export function requirePermission(user:Identity,p:Permission){if(!can(user,p))throw new Error('No tienes permiso para realizar esta operación.');}
export function requireTeam(user:Identity,teamId:string){if(user.role==='COACH'&&!user.teamIds.includes(teamId))throw new Error('Este equipo no está asignado a tu cuenta.');}
export function visibleState(s:State,u:Identity):PublicState{
 const out=structuredClone(s) as unknown as PublicState;
 out.profiles=[];out.notifications=s.notifications.filter(n=>n.adminOnly?u.role==='ADMIN':n.recipientUid===u.uid);if(u.role!=='ADMIN'){out.magazines=[];out.clubActivities=[];}
 out.bankAccounts=can(u,'finance')?s.bankAccounts.map(({ibanEncrypted,holderDocument,...a})=>a):[];
 if(!can(u,'finance'))out.invoices=[];
 if(!can(u,'users'))out.members=[];else out.members=s.members.map(m=>coachIdentity(s,m));
 if(u.role!=='ADMIN')out.audit=s.audit.filter(a=>a.actorUid===u.uid);
 if(!can(u,'applications'))out.applications=[];if(!can(u,'content'))out.contents=[];if(!can(u,'events')&&!can(u,'applications')){out.events=[];out.forms=[];}
 if(!can(u,'people')&&!can(u,'sports')&&!can(u,'finance')){out.players=[];out.playerSeasons=[];out.guardians=[];out.guardianLinks=[];out.coaches=[];out.coachTeams=[];out.files=[];out.crossTrainings=[];out.attendance=[];}
 if(!can(u,'people')){out.guardians=[];out.guardianLinks=[];out.files=[];}
 if(u.role==='COACH'){
 out.matches=s.matches.filter(m=>u.teamIds.includes(m.teamId));out.playerRequests=s.playerRequests.filter(r=>r.requestedBy===u.uid||u.teamIds.includes(r.teamId));const requests=new Set(out.playerRequests.map(r=>r.id));out.requestPlayers=s.requestPlayers.filter(p=>requests.has(p.requestId));
 out.teams=s.teams.filter(t=>u.teamIds.includes(t.id));out.teamDetails=s.teamDetails.filter(t=>u.teamIds.includes(t.teamId));out.playerSeasons=s.playerSeasons.filter(p=>p.teamId&&u.teamIds.includes(p.teamId));
 const ids=new Set(out.playerSeasons.map(p=>p.playerId));out.players=s.players.filter(p=>ids.has(p.id)).map(p=>({...p,email:'',phone:''}));out.sessions=s.sessions.filter(x=>u.teamIds.includes(x.teamId));
 const sessions=new Set(out.sessions.map(x=>x.id));const crosses=s.crossTrainings.filter(x=>sessions.has(x.destinationSessionId));const extra=new Set([...crosses.map(x=>x.playerSeasonId),...out.sessions.flatMap(session=>recurringParticipants(s,session.id)),...out.requestPlayers.map(p=>p.playerSeasonId)]);
 out.playerSeasons=[...out.playerSeasons,...s.playerSeasons.filter(p=>extra.has(p.id)&&!out.playerSeasons.some(x=>x.id===p.id))];
 const pids=new Set(out.playerSeasons.map(p=>p.playerId));out.players=s.players.filter(p=>pids.has(p.id)).map(p=>({...p,email:'',phone:''}));
 out.playerDetails=s.playerDetails.filter(d=>pids.has(d.playerId)).map(d=>({...d,joinedAt:null,leftAt:null,reviewedAt:null}));out.coachDetails=s.coachDetails.filter(d=>s.coachTeams.some(c=>c.coachId===d.coachId&&u.teamIds.includes(c.teamId)));out.crossTrainings=crosses;out.attendance=s.attendance.filter(a=>sessions.has(a.sessionId));out.coachTeams=s.coachTeams.filter(x=>u.teamIds.includes(x.teamId));const coaches=new Set(out.coachTeams.map(x=>x.coachId));out.coaches=s.coaches.filter(x=>coaches.has(x.id));
 }
 if(u.role!=='ADMIN'){
 const own=new Set(u.staffCoachIds||s.coaches.filter(c=>c.email.toLowerCase()===u.email.toLowerCase()).map(c=>c.id));
 out.staffFunctions=s.staffFunctions.filter(f=>own.has(f.coachId));
 out.supportSessions=s.supportSessions.filter(x=>own.has(x.coachId)&&u.staffFunctions?.includes(x.kind));
 const physical=new Set(out.supportSessions.filter(x=>x.kind==='PHYSICAL').map(x=>x.id));
 out.supportParticipants=s.supportParticipants.filter(x=>physical.has(x.sessionId));out.supportAttendance=s.supportAttendance.filter(x=>physical.has(x.sessionId));
 const extras=new Set(out.supportParticipants.filter(p=>p.active).map(p=>p.playerSeasonId));
 const extraPlayers=s.playerSeasons.filter(p=>extras.has(p.id));
 for(const p of extraPlayers)if(!out.playerSeasons.some(x=>x.id===p.id))out.playerSeasons.push(p);
 const pids=new Set(out.playerSeasons.map(p=>p.playerId));out.players=s.players.filter(p=>pids.has(p.id)).map(p=>({...p,email:'',phone:''}));
 const ownTeams=new Set(out.supportSessions.flatMap(x=>x.teamId?[x.teamId]:[]));for(const t of s.teams.filter(t=>ownTeams.has(t.id)))if(!out.teams.some(x=>x.id===t.id))out.teams.push(t);
 for(const c of s.coaches.filter(c=>own.has(c.id)))if(!out.coaches.some(x=>x.id===c.id))out.coaches.push(c);
 out.playerDetails=out.playerDetails.filter(d=>pids.has(d.playerId));
 if(!can(u,'sports')){out.sessions=[];out.matches=[];out.playerRequests=[];out.requestPlayers=[];out.attendance=[];out.crossTrainings=[];out.teamDetails=[];out.coachTeams=[];}
 }
 out.coachDetails=out.coaches.map(c=>{const d=s.coachDetails.find(d=>d.coachId===c.id);return {id:d?.id||c.id,coachId:c.id,isExample:d?.isExample||false,photoUrl:coachPhoto(s,c.id)};});
 return out;
}
