// Guardados acotados: pruebas DIFERENCIALES (mismo comando con transacción acotada y con la transacción
// completa anterior deben producir exactamente los mismos cambios y errores), concurrencia y permisos.
// Base de datos: SIMULADOR de SQL Connect (tests/support/fake-sql-connect.ts) con el club sintético.
import {it,expect,vi,beforeAll,afterAll,afterEach,describe} from 'vitest';
import {syntheticClub,REFERENCE_NOW,people,sid} from '../support/synthetic-club';
import {FakeSqlConnect} from '../support/fake-sql-connect';
import {postReq,getReq,setupEnv,type Who} from '../support/api';
import {changedRows} from '@/domain/sql-connect';
import {mayPromote} from '@/domain/club-rules';
import type {State} from '@/domain/types';
const g=vi.hoisted(()=>({dc:null as unknown}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>g.dc}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),storageBucket:()=>({}),serverAuth:()=>({verifyIdToken:async(token:string)=>{const [uid,email]=token.split('|');return {uid,email,email_verified:true,firebase:{sign_in_provider:'google.com'}};},getUser:async()=>({providerData:[]})})}));
import {GET,POST} from '@/app/api/workspace/route';
import {GET as candidates} from '@/app/api/requests/candidates/route';
beforeAll(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(REFERENCE_NOW);setupEnv();});
afterAll(()=>vi.useRealTimers());
afterEach(()=>{delete process.env.CDIR_SCOPED_COMMANDS;});

const day=864e5,H=3600000;
// One synthetic club, extended with the edge cases the rules care about.
const base=syntheticClub(),who=people(base),season=who.current,admin=who.admin,coach=who.coachMember(0);
const coachId=base.coaches.find(c=>c.email===coach.email)!.id,myTeams=base.coachTeams.filter(t=>t.coachId===coachId&&t.seasonId===season.id&&t.function!=='FORMER').map(t=>t.teamId);
const myTeam=myTeams[0],otherTeam=base.teams.find(t=>t.seasonId===season.id&&!myTeams.includes(t.id))!.id;
const teamOf=(id:string)=>base.teams.find(t=>t.id===id)!;
// Promotion scenario inside coach's branch: a lower team whose players can move up to myTeam.
const lower=base.teams.find(t=>t.seasonId===season.id&&t.id!==myTeam&&mayPromote(base,base.playerSeasons.find(p=>p.teamId===t.id&&p.status==='ACTIVE')?.id||'',myTeam).allowed)!;
const candidate=base.playerSeasons.find(p=>p.teamId===lower?.id&&p.status==='ACTIVE')!;
const futureMatch=base.matches.find(m=>m.teamId===myTeam&&Date.parse(m.startsAt)>REFERENCE_NOW+5*day&&m.status==='SCHEDULED')!;
// The candidate's own team plays the same day: exactly 2 h before (invalid) or 2 h 01 min before (valid).
const lowerMatch=base.matches.find(m=>m.teamId===lower.id&&Date.parse(m.startsAt)>REFERENCE_NOW&&m.status==='SCHEDULED')!;
function withGap(minutes:number):State{const s=structuredClone(base),m=s.matches.find(x=>x.id===lowerMatch.id)!;const start=Date.parse(futureMatch.startsAt)-minutes*60000;m.startsAt=new Date(start).toISOString();m.endsAt=new Date(start+60*60000).toISOString();return s;}
// Pending request for the admin to resolve (match request for myTeam).
const pendingId=sid('request',9000);
function withPending(s:State){s.playerRequests.push({id:pendingId,seasonId:season.id,teamId:myTeam,requestedBy:coach.uid,kind:'MATCH',sessionId:null,matchId:futureMatch.id,neededAt:futureMatch.startsAt,quantity:2,reason:'Prueba',status:'PENDING',recurring:false,createdAt:new Date(REFERENCE_NOW-day).toISOString(),resolvedAt:null,decisionNote:'',proposedPlayerIds:[]});return s;}
const pastSession=base.sessions.find(x=>x.teamId===myTeam&&x.status==='SCHEDULED'&&Date.parse(x.startsAt)<REFERENCE_NOW&&Date.parse(x.startsAt)>REFERENCE_NOW-10*day)!;
const futureSession=base.sessions.find(x=>x.teamId===myTeam&&x.status==='SCHEDULED'&&Date.parse(x.startsAt)>REFERENCE_NOW+2*day)!;
const myPlayer=base.playerSeasons.find(p=>p.teamId===myTeam&&p.status==='ACTIVE'&&p.seasonId===season.id)!,myPlayer2=base.playerSeasons.filter(p=>p.teamId===myTeam&&p.status==='ACTIVE'&&p.seasonId===season.id)[1];
const strangerPlayer=base.playerSeasons.find(p=>p.teamId===otherTeam)!;
const otherSession=base.sessions.find(x=>x.teamId===otherTeam&&Date.parse(x.startsAt)<REFERENCE_NOW&&x.seasonId===season.id&&x.status==='SCHEDULED')!;
const oldSeason=base.seasons.find(x=>x.status==='CLOSED')!,closedSession=base.sessions.find(x=>x.seasonId===oldSeason.id&&x.status==='SCHEDULED')!;
const myPastMatch=base.matches.find(m=>m.teamId===myTeam&&Date.parse(m.startsAt)<REFERENCE_NOW&&m.status!=='CANCELLED')!;
const noScoreTeam=base.teams.find(t=>t.seasonId===season.id&&t.category==='Escuelita')!,noScoreMatch=base.matches.find(m=>m.teamId===noScoreTeam.id&&Date.parse(m.startsAt)<REFERENCE_NOW)!;
const adminNote=base.notifications.find(n=>n.adminOnly)!;
// Recurring approved training request: its players join later sessions of the destination team.
const recurringReq=sid('request',9100),recurringPlayer=candidate;
function withRecurring(s:State){s.playerRequests.push({id:recurringReq,seasonId:season.id,teamId:myTeam,requestedBy:coach.uid,kind:'TRAINING',sessionId:pastSession.id,matchId:null,neededAt:new Date(Date.parse(pastSession.startsAt)-7*day).toISOString(),quantity:1,reason:'Recurrente',status:'APPROVED',recurring:true,createdAt:new Date(REFERENCE_NOW-20*day).toISOString(),resolvedAt:new Date(REFERENCE_NOW-19*day).toISOString(),decisionNote:'',proposedPlayerIds:[]});s.requestPlayers.push({id:sid('requestPlayer',9100),requestId:recurringReq,playerSeasonId:recurringPlayer.id});return s;}

type Case={name:string;user:Who;action:string;payload:unknown;state?:()=>State};
const cases:Case[]=[
 {name:'asistencia propia',user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'}},
 {name:'asistencia de jugador ajeno a la sesión',user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:strangerPlayer.id,status:'PRESENT'}},
 {name:'asistencia en equipo no asignado',user:coach,action:'attendance',payload:{sessionId:otherSession.id,playerSeasonId:strangerPlayer.id,status:'PRESENT'}},
 {name:'asistencia en temporada cerrada',user:admin,action:'attendance',payload:{sessionId:closedSession.id,playerSeasonId:myPlayer.id,status:'PRESENT'}},
 {name:'asistencia de participante recurrente',user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:recurringPlayer.id,status:'PRESENT'},state:()=>withRecurring(structuredClone(base))},
 {name:'asistencia con identificador no válido',user:coach,action:'attendance',payload:{sessionId:'x',playerSeasonId:myPlayer.id,status:'PRESENT'}},
 {name:'resultado propio',user:coach,action:'matchResult',payload:{id:myPastMatch.id,scoreFor:70,scoreAgainst:65}},
 {name:'resultado de partido futuro',user:coach,action:'matchResult',payload:{id:futureMatch.id,scoreFor:1,scoreAgainst:0}},
 {name:'resultado de equipo no asignado',user:coach,action:'matchResult',payload:{id:base.matches.find(m=>m.teamId===otherTeam&&Date.parse(m.startsAt)<REFERENCE_NOW)!.id,scoreFor:1,scoreAgainst:0}},
 {name:'resultado en categoría sin marcador',user:admin,action:'matchResult',payload:{id:noScoreMatch.id,scoreFor:1,scoreAgainst:0}},
 {name:'leer notificación de administración',user:admin,action:'readNotification',payload:{id:adminNote.id}},
 {name:'entrenador lee notificación ajena',user:coach,action:'readNotification',payload:{id:adminNote.id}},
 {name:'publicar partido',user:admin,action:'publishMatch',payload:{id:futureMatch.id}},
 {name:'entrenador no puede publicar',user:coach,action:'publishMatch',payload:{id:futureMatch.id}},
 {name:'solicitud con jugador que puede subir',user:coach,action:'requestPlayers',payload:{teamId:myTeam,kind:'TRAINING',sessionId:futureSession.id,matchId:null,quantity:2,reason:'Faltan jugadores',recurring:false,proposedPlayerIds:[candidate.id]}},
 {name:'solicitud que propone una bajada',user:coach,action:'requestPlayers',payload:{teamId:myTeam,kind:'TRAINING',sessionId:futureSession.id,matchId:null,quantity:2,reason:'Faltan jugadores',recurring:false,proposedPlayerIds:[myPlayer.id]}},
 {name:'solicitud para equipo no asignado',user:coach,action:'requestPlayers',payload:{teamId:otherTeam,kind:'TRAINING',sessionId:futureSession.id,matchId:null,quantity:1,reason:'Faltan jugadores',recurring:false,proposedPlayerIds:[]}},
 {name:'partido: inicios separados exactamente 2 h (no válido)',user:coach,action:'requestPlayers',payload:{teamId:myTeam,kind:'MATCH',sessionId:null,matchId:futureMatch.id,quantity:1,reason:'Convocatoria',recurring:false,proposedPlayerIds:[candidate.id]},state:()=>withGap(120)},
 {name:'partido: inicios separados 2 h 01 min (válido)',user:coach,action:'requestPlayers',payload:{teamId:myTeam,kind:'MATCH',sessionId:null,matchId:futureMatch.id,quantity:1,reason:'Convocatoria',recurring:false,proposedPlayerIds:[candidate.id]},state:()=>withGap(121)},
 {name:'aprobar solicitud: exactamente 2 h (no válido)',user:admin,action:'resolveRequest',payload:{id:pendingId,status:'APPROVED',playerSeasonIds:[candidate.id],note:'ok'},state:()=>withPending(withGap(120))},
 {name:'aprobar solicitud: 2 h 01 min (válido)',user:admin,action:'resolveRequest',payload:{id:pendingId,status:'APPROVED',playerSeasonIds:[candidate.id],note:'ok'},state:()=>withPending(withGap(121))},
 {name:'rechazar solicitud',user:admin,action:'resolveRequest',payload:{id:pendingId,status:'REJECTED',playerSeasonIds:[],note:'No'},state:()=>withPending(structuredClone(base))},
 {name:'entrenador no puede resolver',user:coach,action:'resolveRequest',payload:{id:pendingId,status:'REJECTED',playerSeasonIds:[],note:'No'},state:()=>withPending(structuredClone(base))},
];
// New rows get random ids/keys: compare them without those fields; updated rows keep their id.
function normalized(before:State,after:State){return changedRows(before,after).map(c=>{const row=c.row as Record<string,unknown>,existed=(before[c.key] as {id:string}[]).some(r=>r.id===row.id);return c.key+':'+JSON.stringify(existed?row:{...row,id:'new',dedupeKey:row.dedupeKey?'new':undefined});}).sort();}
async function run(c:Case,scoped:boolean){const start=c.state?c.state():structuredClone(base),dc=new FakeSqlConnect(start);g.dc=dc;if(!scoped)process.env.CDIR_SCOPED_COMMANDS='false';else delete process.env.CDIR_SCOPED_COMMANDS;const r=await POST(postReq('/api/workspace',c.user,{action:c.action,payload:c.payload,seasonId:season.id}));const body=await r.json();return {status:r.status,message:body.message,changes:normalized(start,dc.state()),reads:dc.metrics.reads,bytes:dc.metrics.bytesOut};}

describe('transacciones acotadas = transacción completa',()=>{
 it('el escenario de prueba es válido',()=>{expect(lower).toBeTruthy();expect(candidate).toBeTruthy();expect(lowerMatch).toBeTruthy();expect(noScoreMatch).toBeTruthy();});
 for(const c of cases)it(c.name,async()=>{const full=await run(c,false),scoped=await run(c,true);expect(scoped.status).toBe(full.status);expect(scoped.message).toBe(full.message);expect(scoped.changes).toEqual(full.changes);expect(scoped.reads).toBeLessThan(full.reads);expect(scoped.bytes).toBeLessThan(full.bytes/20);});
 it('la regla de 2 h se aplica en los dos sentidos',async()=>{expect((await run(cases.find(c=>c.name.includes('exactamente 2 h (no'))!,true)).status).toBe(400);expect((await run(cases.find(c=>c.name.includes('2 h 01 min (válido)')&&c.action==='requestPlayers')!,true)).status).toBe(200);expect((await run(cases.find(c=>c.name.startsWith('aprobar solicitud: exactamente'))!,true)).status).toBe(400);expect((await run(cases.find(c=>c.name.startsWith('aprobar solicitud: 2 h 01'))!,true)).status).toBe(200);});
});

describe('concurrencia (revisión global con comparación y reintento)',()=>{
 async function concurrent(first:{user:Who;action:string;payload:unknown;expect?:unknown},second:{user:Who;action:string;payload:unknown;expect?:unknown}){
  const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;let injected=false;
  // The second user commits while the first one is between reading and writing.
  dc.beforeOperation=async kind=>{if(kind==='mutation'&&!injected){injected=true;const hook=dc.beforeOperation;dc.beforeOperation=undefined;const r=await POST(postReq('/api/workspace',second.user,{action:second.action,payload:second.payload,seasonId:season.id,expect:second.expect}));secondStatus=r.status;dc.beforeOperation=hook;}};
  let secondStatus=0;const r=await POST(postReq('/api/workspace',first.user,{action:first.action,payload:first.payload,seasonId:season.id,expect:first.expect}));
  return {status:r.status,body:await r.json(),secondStatus,state:dc.state()};
 }
 const att=(s:State,ps:string)=>s.attendance.find(a=>a.sessionId===pastSession.id&&a.playerSeasonId===ps)?.status;
 it('registros distintos: se conservan los dos cambios',async()=>{const r=await concurrent({user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'}},{user:admin,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer2.id,status:'EXCUSED'}});expect(r.secondStatus).toBe(200);expect(r.status).toBe(200);expect(att(r.state,myPlayer.id)).toBe('EXCUSED');expect(att(r.state,myPlayer2.id)).toBe('EXCUSED');});
 it('mismo registro: se detecta el conflicto y no se pisa el cambio ajeno',async()=>{const r=await concurrent({user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'ABSENT'}},{user:admin,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'}});expect(r.secondStatus).toBe(200);expect(r.status).toBe(409);expect(r.body.message).toMatch(/Otra persona/);expect(att(r.state,myPlayer.id)).toBe('EXCUSED');});
 it('mismo resultado editado a la vez: conflicto, se conserva el primero guardado',async()=>{const r=await concurrent({user:coach,action:'matchResult',payload:{id:myPastMatch.id,scoreFor:10,scoreAgainst:5}},{user:admin,action:'matchResult',payload:{id:myPastMatch.id,scoreFor:80,scoreAgainst:79}});expect(r.status).toBe(409);const m=r.state.matches.find(x=>x.id===myPastMatch.id)!;expect([m.scoreFor,m.scoreAgainst]).toEqual([80,79]);});
 it('pantalla desactualizada: el valor que vio el usuario ya no coincide (409, sin sobrescribir)',async()=>{const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;const seen=base.attendance.find(a=>a.sessionId===pastSession.id&&a.playerSeasonId===myPlayer.id)?.status??null;
  expect((await POST(postReq('/api/workspace',admin,{action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'},expect:{status:seen}}))).status).toBe(200);
  const stale=await POST(postReq('/api/workspace',coach,{action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'ABSENT'},expect:{status:seen}}));expect(stale.status).toBe(409);expect(att(dc.state(),myPlayer.id)).toBe('EXCUSED');});
 it('el mismo flujo con la transacción completa también reintenta y detecta el conflicto',async()=>{process.env.CDIR_SCOPED_COMMANDS='false';const r=await concurrent({user:coach,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'ABSENT'}},{user:admin,action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'}});expect(r.status).toBe(409);});
});

describe('lectura acotada, permisos y cambios de usuario, rol y temporada',()=>{
 const workspace=async(u:Who,seasonId?:string)=>{const r=await GET(getReq('/api/workspace'+(seasonId?'?seasonId='+seasonId:''),u));return {status:r.status,...await r.json()};};
 it('el entrenador solo recibe filas de sus equipos y de la temporada elegida',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const w=await workspace(coach);expect(w.seasonId).toBe(season.id);
  for(const k of ['sessions','matches']as const)for(const r of w.state[k])expect(myTeams).toContain(r.teamId);
  const sessions=new Set(w.state.sessions.map((x:{id:string})=>x.id));for(const a of w.state.attendance)expect(sessions.has(a.sessionId)).toBe(true);
  expect(w.state.members).toEqual([]);expect(w.state.bankAccounts).toEqual([]);expect(w.state.notifications.every((n:{recipientUid:string})=>n.recipientUid===coach.uid)).toBe(true);
  expect(w.state.players.every((p:{email:string;phone:string})=>p.email===''&&p.phone==='')).toBe(true);});
 it('cambiar de temporada recarga y no mezcla filas de otra temporada',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const w=await workspace(admin,oldSeason.id);expect(w.seasonId).toBe(oldSeason.id);for(const k of ['sessions','matches','events','invoices','applications','playerRequests']as const)for(const r of w.state[k])expect(r.seasonId).toBe(oldSeason.id);});
 it('un cambio de rol se aplica en la siguiente lectura (sin caché de permisos)',async()=>{const s=structuredClone(base),dc=new FakeSqlConnect(s);g.dc=dc;expect((await workspace(coach)).state.members).toEqual([]);(dc.tables.Member as {uid:string;role:string}[]).find(m=>m.uid===coach.uid)!.role='ADMIN';const w=await workspace(coach);expect(w.user.role).toBe('ADMIN');expect(w.state.members.length).toBe(base.members.length);});
 it('una cuenta desactivada deja de acceder',async()=>{const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;(dc.tables.Member as {uid:string;active:boolean}[]).find(m=>m.uid===coach.uid)!.active=false;expect((await workspace(coach)).status).toBe(403);});
 it('dos usuarios distintos reciben datos distintos de la misma ruta',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const a=await workspace(admin),c=await workspace(coach);expect(a.state.members.length).toBeGreaterThan(0);expect(c.state.members).toEqual([]);expect(a.state.sessions.length).toBeGreaterThan(c.state.sessions.length);});
 it('guardar y leer: asistencia, resultado y solicitud aparecen en la siguiente carga',async()=>{const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;
  const a=await POST(postReq('/api/workspace',coach,{action:'attendance',payload:{sessionId:pastSession.id,playerSeasonId:myPlayer.id,status:'EXCUSED'},seasonId:season.id}));const patch=(await a.json()).patch;expect(patch.attendance[0].status).toBe('EXCUSED');expect(patch.audit).toHaveLength(1);
  expect((await POST(postReq('/api/workspace',coach,{action:'matchResult',payload:{id:myPastMatch.id,scoreFor:33,scoreAgainst:31},seasonId:season.id}))).status).toBe(200);
  expect((await POST(postReq('/api/workspace',coach,{action:'requestPlayers',payload:{teamId:myTeam,kind:'TRAINING',sessionId:futureSession.id,matchId:null,quantity:1,reason:'Prueba de lectura',recurring:false,proposedPlayerIds:[]},seasonId:season.id}))).status).toBe(200);
  const w=await workspace(coach);expect(w.state.attendance.find((x:{sessionId:string;playerSeasonId:string})=>x.sessionId===pastSession.id&&x.playerSeasonId===myPlayer.id).status).toBe('EXCUSED');expect(w.state.matches.find((m:{id:string})=>m.id===myPastMatch.id).scoreFor).toBe(33);expect(w.state.playerRequests.some((r:{reason:string})=>r.reason==='Prueba de lectura')).toBe(true);});
 it('la respuesta parcial no incluye notificaciones que el usuario no puede ver',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const r=await POST(postReq('/api/workspace',coach,{action:'requestPlayers',payload:{teamId:myTeam,kind:'TRAINING',sessionId:futureSession.id,matchId:null,quantity:1,reason:'Sin fuga',recurring:false,proposedPlayerIds:[]},seasonId:season.id}));const {patch}=await r.json();expect(patch.notifications||[]).toEqual([]);expect(patch.playerRequests).toHaveLength(1);});
 it('candidatos: solo para equipos propios y con las mismas filas que la lectura completa',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const own=await candidates(getReq(`/api/requests/candidates?teamId=${myTeam}&kind=TRAINING&targetId=${futureSession.id}`,coach));expect(own.status).toBe(200);const scoped=(await own.json()).players;
  const {requestCandidates}=await import('@/domain/request-candidates');const {coachIdentity}=await import('@/domain/people');const member=base.members.find(m=>m.uid===coach.uid)!;expect(scoped).toEqual(requestCandidates(base,coachIdentity(base,member),{teamId:myTeam,kind:'TRAINING',targetId:futureSession.id}));
  expect((await candidates(getReq(`/api/requests/candidates?teamId=${otherTeam}&kind=TRAINING&targetId=${otherSession.id}`,coach))).status).toBe(403);});
 void teamOf;
});
