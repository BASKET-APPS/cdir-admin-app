// Mide operaciones reales del backend (rutas API) contra el SIMULADOR de SQL Connect con el club sintético.
// Mismo conjunto de datos y operaciones para el código anterior y el nuevo. Resultado: tests/bench/out-*.json
// Uso: npx vitest run --config vitest.bench.config.ts   (BENCH_SCALE=growth para el escenario de crecimiento)
import {it,vi,beforeAll,afterAll} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {syntheticClub,BASE,GROWTH,REFERENCE_NOW,people} from '../support/synthetic-club';
import {FakeSqlConnect} from '../support/fake-sql-connect';
import {mayPromote,requestConflicts} from '@/domain/club-rules';
const g=vi.hoisted(()=>({dc:null as unknown}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>g.dc}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),storageBucket:()=>({}),serverAuth:()=>({verifyIdToken:async(token:string)=>{const [uid,email]=token.split('|');return {uid,email,email_verified:true,firebase:{sign_in_provider:'google.com'}};},getUser:async()=>({providerData:[]})})}));
import {GET as workspaceGet,POST as workspacePost} from '@/app/api/workspace/route';
import {GET as candidatesGet} from '@/app/api/requests/candidates/route';
const origin='http://127.0.0.1:3002';
const scale=process.env.BENCH_SCALE==='growth'?GROWTH:BASE,label=process.env.BENCH_LABEL||'run';
const base=syntheticClub(scale),who=people(base),season=who.current;
type Result={op:string;status:number;reads:number;mutations:number;dbBytesOut:number;dbBytesIn:number;responseBytes:number;ms:number;backendMs:number;heapDeltaKB:number};
const results:Result[]=[];
beforeAll(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(REFERENCE_NOW);process.env.CDIR_DATABASE='sql-connect';process.env.FIREBASE_PROJECT_ID='cdir-apps';process.env.APP_ORIGIN=origin;process.env.PUBLIC_FEED_CACHE_SECONDS='0';});
afterAll(()=>{vi.useRealTimers();mkdirSync(path.join(__dirname),{recursive:true});writeFileSync(path.join(__dirname,`out-${label}-${process.env.BENCH_SCALE||'base'}.json`),JSON.stringify({scale:process.env.BENCH_SCALE||'base',results},null,1));});
const token=(m:{uid:string;email:string})=>'Bearer '+m.uid+'|'+m.email;
async function measure(op:string,dc:FakeSqlConnect,run:()=>Promise<Response>){
 // BENCH_QUICK=1 keeps the representative operations only (used for the growth scenario).
 if(process.env.BENCH_QUICK==='1'&&!/workspace|asistencia|resultado/.test(op))return '';
 dc.reset();const gc=(globalThis as {gc?:()=>void}).gc;gc?.();const heap=process.memoryUsage().heapUsed,t=performance.now();
 const r=await run();const body=await r.text();const ms=performance.now()-t,heapDeltaKB=Math.round((process.memoryUsage().heapUsed-heap)/1024);
 if(r.status>=400)console.warn(op,r.status,body.slice(0,200));
 results.push({op,status:r.status,reads:dc.metrics.reads,mutations:dc.metrics.mutations,dbBytesOut:dc.metrics.bytesOut,dbBytesIn:dc.metrics.bytesIn,responseBytes:body.length,ms:Math.round(ms),backendMs:Math.round(ms-dc.metrics.fakeMs),heapDeltaKB});return body;
}
const get=(url:string,user:{uid:string;email:string})=>new Request(origin+url,{headers:{authorization:token(user)}});
const post=(url:string,user:{uid:string;email:string},body:unknown)=>new Request(origin+url,{method:'POST',headers:{authorization:token(user),origin,'content-type':'application/json'},body:JSON.stringify(body)});
it('operaciones del panel',async()=>{
 const dc=new FakeSqlConnect(base);g.dc=dc;const admin=who.admin,coach=who.coachMember(0);
 const coachEntity=base.coaches.find(c=>c.email===coach.email)!,coachTeams=base.coachTeams.filter(t=>t.coachId===coachEntity.id&&t.seasonId===season.id&&t.function!=='FORMER').map(t=>t.teamId);
 const team=coachTeams[0];
 await measure('GET workspace · administración',dc,()=>workspaceGet(get('/api/workspace?seasonId='+season.id,admin)));
 await measure('GET workspace · entrenador',dc,()=>workspaceGet(get('/api/workspace?seasonId='+season.id,coach)));
 const session=base.sessions.find(x=>x.teamId===team&&x.status==='SCHEDULED'&&Date.parse(x.startsAt)<REFERENCE_NOW&&Date.parse(x.startsAt)>REFERENCE_NOW-14*864e5)!,ps=base.playerSeasons.find(p=>p.teamId===team&&p.status==='ACTIVE')!;
 const current=base.attendance.find(a=>a.sessionId===session.id&&a.playerSeasonId===ps.id)?.status||null;
 await measure('POST asistencia · entrenador',dc,()=>workspacePost(post('/api/workspace',coach,{action:'attendance',payload:{sessionId:session.id,playerSeasonId:ps.id,status:current==='PRESENT'?'ABSENT':'PRESENT'},seasonId:season.id,expect:{status:current}})));
 const match=base.matches.find(m=>m.teamId===team&&Date.parse(m.startsAt)<REFERENCE_NOW&&m.status!=='CANCELLED')!;
 await measure('POST resultado · entrenador',dc,()=>workspacePost(post('/api/workspace',coach,{action:'matchResult',payload:{id:match.id,scoreFor:61,scoreAgainst:58},seasonId:season.id,expect:{status:match.status,scoreFor:match.scoreFor,scoreAgainst:match.scoreAgainst}})));
 const note=base.notifications.find(n=>n.adminOnly&&!n.readBy.includes(admin.uid))!;
 await measure('POST leer notificación · administración',dc,()=>workspacePost(post('/api/workspace',admin,{action:'readNotification',payload:{id:note.id},seasonId:season.id})));
 const future=base.sessions.find(x=>x.teamId===team&&x.status==='SCHEDULED'&&Date.parse(x.startsAt)>REFERENCE_NOW+3*864e5)!;
 await measure('POST solicitar jugadores · entrenador',dc,()=>workspacePost(post('/api/workspace',coach,{action:'requestPlayers',payload:{teamId:team,kind:'TRAINING',sessionId:future.id,matchId:null,quantity:2,reason:'Medición sintética',recurring:false,proposedPlayerIds:[]},seasonId:season.id})));
 const state=dc.state(),pending=state.playerRequests.find(r=>r.status==='PENDING'&&r.seasonId===season.id&&Date.parse(r.neededAt)>REFERENCE_NOW)!;
 const eligible=state.playerSeasons.filter(p=>p.seasonId===season.id&&mayPromote(state,p.id,pending.teamId).allowed&&!requestConflicts(state,pending,p.id).length).slice(0,1).map(p=>p.id);
 await measure('POST resolver solicitud · administración',dc,()=>workspacePost(post('/api/workspace',admin,{action:'resolveRequest',payload:{id:pending.id,status:'APPROVED',playerSeasonIds:eligible,note:'Aprobada (sintético)'},seasonId:season.id})));
 const upcoming=base.matches.find(m=>m.seasonId===season.id&&Date.parse(m.startsAt)>REFERENCE_NOW)!;
 await measure('POST publicar partido · administración',dc,()=>workspacePost(post('/api/workspace',admin,{action:'publishMatch',payload:{id:upcoming.id},seasonId:season.id})));
 await measure('GET candidatos de subida · entrenador',dc,()=>candidatesGet(get('/api/requests/candidates?teamId='+team+'&kind=TRAINING&targetId='+future.id,coach)));
 const event=base.events.find(e=>e.seasonId===season.id)!;
 await measure('POST publicar evento · administración (sin acotar)',dc,()=>workspacePost(post('/api/workspace',admin,{action:'publishEvent',payload:{id:event.id,status:'PUBLISHED',registrationOpen:false},seasonId:season.id})));
},600000);
