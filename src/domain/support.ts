import {calendarDay,calendarMonday,addCalendarDays} from './calendar';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {State,Identity,StaffFunction,SupportSession} from './types';
const id=z.string().uuid(),instant=z.iso.datetime({offset:true});

export function setStaffFunctions(s:State,coachId:string,kinds:StaffFunction[]){
 for(const kind of ['COACH','PHYSICAL','PSYCHOLOGY'] as const){const old=s.staffFunctions.find(f=>f.coachId===coachId&&f.kind===kind);if(old)old.active=kinds.includes(kind);else s.staffFunctions.push({id:randomUUID(),coachId,kind,active:kinds.includes(kind)});}
}
export function ownsSupport(s:State,u:Identity,x:SupportSession){return u.role==='ADMIN'||u.active&&u.role==='COACH'&&!!u.staffFunctions?.includes(x.kind)&&s.coaches.some(c=>c.id===x.coachId&&c.email.toLowerCase()===u.email.toLowerCase());}
function row<T extends {id:string}>(items:T[],key:string){const x=items.find(x=>x.id===key);if(!x)throw Error('Registro no encontrado.');return x;}
function admin(u:Identity){if(u.role!=='ADMIN')throw Error('Solo administración puede gestionar asignaciones y horarios.');}
function open(s:State,sid:string){if(row(s.seasons,sid).status!=='OPEN')throw Error('La temporada está cerrada.');}
const overlaps=(a:{startsAt:string;endsAt:string},b:{startsAt:string;endsAt:string})=>Date.parse(a.startsAt)<Date.parse(b.endsAt)&&Date.parse(a.endsAt)>Date.parse(b.startsAt);
export function checkSupportPlayer(s:State,x:SupportSession,pid:string){
 const p=row(s.playerSeasons,pid);if(p.seasonId!==x.seasonId||p.status!=='ACTIVE'||!row(s.players,p.playerId).active)throw Error('Selecciona un jugador activo de esta temporada.');
 if(s.supportSessions.some(o=>o.id!==x.id&&o.status==='SCHEDULED'&&overlaps(x,o)&&s.supportParticipants.some(a=>a.sessionId===o.id&&a.playerSeasonId===pid&&a.active)))throw Error('El jugador ya tiene otra sesión de preparación física en ese horario.');
 if(s.sessions.some(o=>o.status==='SCHEDULED'&&overlaps(x,o)&&(o.teamId===p.teamId||s.crossTrainings.some(c=>c.destinationSessionId===o.id&&c.playerSeasonId===pid))))throw Error('El jugador tiene un entrenamiento en ese horario.');
 if(s.matches.some(o=>o.status!=='CANCELLED'&&overlaps(x,o)&&o.teamId===p.teamId))throw Error('El jugador tiene un partido en ese horario.');
}
export const supportActions=new Set(['physicalFromTraining','professional','staffFunctions','supportSession','supportParticipant','supportAttendance','cancelSupportSession']);
export function executeSupport(s:State,u:Identity,action:string,payload:unknown){
 if(action==='physicalFromTraining'){
 admin(u);const d=z.object({trainingId:id,coachId:id,placement:z.enum(['BEFORE','AFTER']),playerSeasonIds:z.array(id).max(200),weeks:z.coerce.number().int().min(1).max(12).default(1)}).strict().parse(payload),training=row(s.sessions,d.trainingId);open(s,training.seasonId);
 if(d.weeks>1){const work=structuredClone(s),clock=(date:string)=>new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Europe/Madrid'}).format(new Date(date));for(let i=0;i<d.weeks;i++){const day=addCalendarDays(calendarDay(training.startsAt),i*7),source=work.sessions.find(x=>x.teamId===training.teamId&&x.seasonId===training.seasonId&&x.status==='SCHEDULED'&&calendarDay(x.startsAt)===day&&clock(x.startsAt)===clock(training.startsAt));if(!source)throw Error('No hay entrenamiento programado con este horario para el '+day+'. No se ha creado ninguna sesión de la serie.');executeSupport(work,u,'physicalFromTraining',{...d,trainingId:source.id,weeks:1});}Object.assign(s,work);return s;}
 if(training.status!=='SCHEDULED')throw Error('El entrenamiento está suspendido.');
 const week=calendarMonday(calendarDay(training.startsAt));if(s.supportSessions.some(x=>x.kind==='PHYSICAL'&&x.teamId===training.teamId&&x.status==='SCHEDULED'&&calendarMonday(calendarDay(x.startsAt))===week))throw Error('Este equipo ya tiene su hora de preparación física esta semana.');
 const startsAt=new Date(d.placement==='BEFORE'?Date.parse(training.startsAt)-3600000:Date.parse(training.endsAt)).toISOString(),endsAt=new Date(Date.parse(startsAt)+3600000).toISOString();
 if(Date.parse(startsAt)<Date.now())throw Error('Selecciona un entrenamiento futuro para añadir su sesión física.');
 const own=new Set(s.playerSeasons.filter(p=>p.seasonId===training.seasonId&&p.teamId===training.teamId&&p.status==='ACTIVE').map(p=>p.id));if(d.playerSeasonIds.some(pid=>!own.has(pid)))throw Error('Los invitados se añaden después de crear la sesión habitual.');
 executeSupport(s,u,'supportSession',{seasonId:training.seasonId,coachId:d.coachId,teamId:training.teamId,venueId:training.venueId,kind:'PHYSICAL',title:'Preparación física · '+row(s.teams,training.teamId).name,startsAt,endsAt,playerSeasonIds:d.playerSeasonIds});
 }
 else if(action==='professional'){
 admin(u);const d=z.object({existingId:z.union([id,z.literal('')]).optional(),name:z.string().trim().min(2).max(200),email:z.union([z.email(),z.literal('')]),phone:z.string().trim().max(30),qualification:z.string().trim().max(200),functions:z.array(z.enum(['COACH','PHYSICAL','PSYCHOLOGY'])).min(1).max(3)}).strict().parse(payload);
 let coach=d.existingId?row(s.coaches,d.existingId):d.email?s.coaches.find(c=>c.email.toLowerCase()===d.email.toLowerCase()):undefined;
 const existing=!!coach;if(!coach){coach={id:randomUUID(),name:d.name,email:d.email.toLowerCase(),phone:d.phone,qualification:d.qualification};s.coaches.push(coach);s.coachDetails.push({id:randomUUID(),coachId:coach.id,photoUrl:'',isExample:false});}
 const old=s.staffFunctions.filter(f=>f.coachId===coach!.id);const prior=old.length?old.filter(f=>f.active).map(f=>f.kind):existing?['COACH' as const]:[];
 setStaffFunctions(s,coach.id,[...new Set([...prior,...d.functions])]);
 }
 else if(action==='staffFunctions'){admin(u);const d=z.object({coachId:id,functions:z.array(z.enum(['COACH','PHYSICAL','PSYCHOLOGY'])).min(1).max(3)}).strict().parse(payload);row(s.coaches,d.coachId);setStaffFunctions(s,d.coachId,[...new Set(d.functions)]);}
 else if(action==='supportSession'){
 admin(u);const d=z.object({seasonId:id,coachId:id,teamId:id.nullable().default(null),venueId:id,kind:z.enum(['PHYSICAL','PSYCHOLOGY']),title:z.string().trim().min(2).max(200),startsAt:instant,endsAt:instant,playerSeasonIds:z.array(id).max(200).default([])}).strict().parse(payload);open(s,d.seasonId);const season=row(s.seasons,d.seasonId);if(row(s.venues,d.venueId).active===false)throw Error('Esta instalación está archivada. Selecciona una instalación actual.');row(s.coaches,d.coachId);
 if(!s.staffFunctions.some(f=>f.coachId===d.coachId&&f.kind===d.kind&&f.active))throw Error('El profesional no tiene habilitada esta función.');
 if(d.teamId&&row(s.teams,d.teamId).seasonId!==d.seasonId)throw Error('El equipo pertenece a otra temporada.');
 if(Date.parse(d.startsAt)>=Date.parse(d.endsAt)||Date.parse(d.endsAt)-Date.parse(d.startsAt)>86400000||d.startsAt.slice(0,10)<season.startsAt||d.endsAt.slice(0,10)>season.endsAt)throw Error('Revisa las fechas y la temporada de la sesión.');
 const coachTeams=new Set(s.coachTeams.filter(a=>a.coachId===d.coachId&&a.function!=='FORMER').map(a=>a.teamId));
 if(s.supportSessions.some(x=>x.status==='SCHEDULED'&&overlaps(d,x)&&(x.coachId===d.coachId||x.venueId===d.venueId))||s.sessions.some(x=>x.status==='SCHEDULED'&&overlaps(d,x)&&(x.venueId===d.venueId||coachTeams.has(x.teamId)))||s.matches.some(x=>x.status!=='CANCELLED'&&coachTeams.has(x.teamId)&&overlaps(d,x)))throw Error('La instalación o el profesional ya tiene un compromiso en ese horario.');
 if(d.kind==='PSYCHOLOGY'&&d.playerSeasonIds.length)throw Error('Psicología solo gestiona horarios, sin fichas ni asistencia.');
 const {playerSeasonIds,...data}=d,x:SupportSession={...data,id:randomUUID(),status:'SCHEDULED'};for(const pid of new Set(playerSeasonIds))checkSupportPlayer(s,x,pid);s.supportSessions.push(x);for(const pid of new Set(playerSeasonIds))s.supportParticipants.push({id:randomUUID(),sessionId:x.id,playerSeasonId:pid,mode:'REGULAR',active:true});
 }
 else {
 const d=z.object({sessionId:id,playerSeasonId:id.optional(),mode:z.enum(['REGULAR','GUEST','RECOVERY']).optional(),active:z.boolean().optional(),status:z.enum(['PRESENT','ABSENT','EXCUSED']).optional()}).strict().parse(payload),x=row(s.supportSessions,d.sessionId);open(s,x.seasonId);
 if(!ownsSupport(s,u,x))throw Error('No tienes acceso a esta sesión.');
 if(action==='cancelSupportSession'){if(u.role!=='ADMIN'&&x.kind!=='PHYSICAL')throw Error('Psicología solo puede consultar sus horarios.');x.status='CANCELLED';}
 else {if(x.kind!=='PHYSICAL'||x.status==='CANCELLED')throw Error('Solo las sesiones físicas activas admiten participantes y asistencia.');if(!d.playerSeasonId)throw Error('Selecciona un jugador.');
 if(action==='supportParticipant'){admin(u);if(d.active!==false)checkSupportPlayer(s,x,d.playerSeasonId);const old=s.supportParticipants.find(a=>a.sessionId===x.id&&a.playerSeasonId===d.playerSeasonId);if(old){old.active=d.active!==false;old.mode=d.mode||'REGULAR';}else s.supportParticipants.push({id:randomUUID(),sessionId:x.id,playerSeasonId:d.playerSeasonId,mode:d.mode||'REGULAR',active:d.active!==false});}
 if(action==='supportAttendance'){if(!d.status||!s.supportParticipants.some(a=>a.sessionId===x.id&&a.playerSeasonId===d.playerSeasonId&&a.active))throw Error('El jugador no está asignado a esta sesión.');if(Date.now()<Date.parse(x.startsAt))throw Error('La asistencia se registra desde el comienzo de la sesión.');const old=s.supportAttendance.find(a=>a.sessionId===x.id&&a.playerSeasonId===d.playerSeasonId);if(old)old.status=d.status;else s.supportAttendance.push({id:randomUUID(),sessionId:x.id,playerSeasonId:d.playerSeasonId,status:d.status});}
 }
 }
 s.audit.push({id:randomUUID(),at:new Date().toISOString(),actor:u.name,actorUid:u.uid,action,detail:'Gestión de funciones y sesiones de apoyo'});return s;
}

export function assertSupportConflictForTeam(s:State,x:{teamId:string;startsAt:string;endsAt:string},venueId?:string){
 const coaches=new Set(s.coachTeams.filter(c=>c.teamId===x.teamId&&c.function!=='FORMER').map(c=>c.coachId));
 const players=new Set(s.playerSeasons.filter(p=>p.teamId===x.teamId&&p.status==='ACTIVE').map(p=>p.id));
 if(s.supportSessions.some(o=>o.status==='SCHEDULED'&&overlaps(x,o)&&(o.venueId===venueId||coaches.has(o.coachId)||s.supportParticipants.some(p=>p.sessionId===o.id&&p.active&&players.has(p.playerSeasonId)))))throw Error('Hay una sesión física o de psicología que coincide con el horario del profesional, jugadores o instalación.');
}
