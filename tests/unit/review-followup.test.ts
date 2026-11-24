import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {emptyState,type State,type Identity} from '@/domain/types';
import {FakeSqlConnect} from '../support/fake-sql-connect';
import {recentMatches,RECENT_RESULTS_LIMIT,UPCOMING_MATCHES_LIMIT} from '@/domain/public-matches';
const g=vi.hoisted(()=>({dc:null as unknown,state:null as unknown as State,user:null as unknown as Identity}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>g.dc}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),serverAuth:()=>({}),storageBucket:()=>({})}));
vi.mock('@/server/auth',()=>({identity:async()=>g.user}));
vi.mock('@/server/store',()=>({readState:async()=>g.state,transaction:async()=>{throw Error('No se permiten escrituras en estas pruebas');}}));
import {GET as auditGet} from '@/app/api/audit/route';
import {readSqlConnectCoachAvatar} from '@/server/sql-connect-store';
import {readPublicSlice} from '@/server/public-data';
import {GET as feedGet} from '@/app/api/public/club/route';
import {invalidatePublicCache} from '@/server/public-cache';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
beforeEach(()=>{
 vi.stubEnv('FIREBASE_PROJECT_ID','cdir-apps');vi.stubEnv('CDIR_DATABASE','sql-connect');vi.stubEnv('PUBLIC_FEED_CACHE_SECONDS','0');
 g.state=emptyState();g.user={uid:'admin',name:'Prueba',email:'admin@example.invalid',role:'ADMIN',teamIds:[],active:true};invalidatePublicCache();
});
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});

for(const adapter of ['sql-connect','local'])it(`auditoría ${adapter}: recorre 450 filas con timestamp idéntico sin omitir ni duplicar`,async()=>{
 vi.stubEnv('CDIR_DATABASE',adapter);
 g.state.audit=Array.from({length:450},(_,i)=>({id:id(i+1),at:'2030-01-01T00:00:00.000Z',actor:'Prueba',actorUid:'admin',action:'test',detail:'Sintético'}));
 g.dc=new FakeSqlConnect(g.state);
 let query='',more=true;const seen:string[]=[];
 while(more){const r=await auditGet(new Request('http://localhost/api/audit'+query));expect(r.status).toBe(200);const page=await r.json();seen.push(...page.rows.map((r:{id:string})=>r.id));more=page.hasMore;
  const last=page.rows.at(-1);if(more){expect(last).toBeTruthy();query='?before='+encodeURIComponent(last.at)+'&beforeId='+last.id;}
 }
 expect(seen).toHaveLength(450);expect(new Set(seen).size).toBe(450);
 expect(seen).toEqual(g.state.audit.map(a=>a.id).sort().reverse());
});
it('el cursor compuesto mantiene el aislamiento de auditoría del usuario',async()=>{
 g.user.role='COACH';g.user.uid='coach';g.state.audit=Array.from({length:405},(_,i)=>({id:id(i+1),at:'2030-01-01T00:00:00.000Z',actor:'Prueba',actorUid:i%2?'admin':'coach',action:'test',detail:'Sintético'}));
 g.dc=new FakeSqlConnect(g.state);
 const a=await(await auditGet(new Request('http://localhost/api/audit'))).json();const last=a.rows.at(-1);
 const b=await(await auditGet(new Request('http://localhost/api/audit?before='+last.at+'&beforeId='+last.id))).json();
 expect([...a.rows,...b.rows]).toHaveLength(203);expect([...a.rows,...b.rows].every(r=>r.actorUid==='coach')).toBe(true);
});
it('rechaza cursores de auditoría inválidos',async()=>{
 for(const query of ['?before=basura','?beforeId='+id(1),'?before=2030-01-01&beforeId=basura'])expect((await auditGet(new Request('http://localhost/api/audit'+query))).status).toBe(400);
});
it('la foto consulta solo al miembro vinculado, incluso entre miles de miembros',async()=>{
 g.state.coaches=[{id:id(1),name:'Técnico',email:'tecnico@example.invalid',phone:'',qualification:''}];
 g.state.members=Array.from({length:2100},(_,i)=>({id:id(100+i),uid:'u'+i,name:'Sintético',email:i===2099?'tecnico@example.invalid':'persona'+i+'@example.invalid',role:'COACH',teamIds:[],active:true}));
 g.state.profiles=[{id:id(5000),uid:'u2099',googlePhotoUrl:null,avatarPath:'data:image/webp;base64,AAAA',avatarVersion:'v1',avatarSource:'UPLOAD',googleSyncedAt:null,updatedAt:'2030-01-01T00:00:00.000Z'}];
 const dc=new FakeSqlConnect(g.state);g.dc=dc;const result=await readSqlConnectCoachAvatar(id(1));
 expect(result.members).toHaveLength(1);expect(result.members[0].uid).toBe('u2099');expect(result.profiles[0].avatarVersion).toBe('v1');
 expect(dc.metrics.bytesOut).toBeLessThan(2000);expect(dc.metrics.reads).toBe(3);
});

function matches(){
 g.state.seasons=[{id:id(1),name:'Sintética',startsAt:'2020-01-01',endsAt:'2040-01-01',current:true,status:'OPEN'}];
 g.state.teams=[{id:id(2),seasonId:id(1),name:'Equipo sintético',category:'Senior',modality:'FEDERATED',branch:'MALE',active:true}];
 const now=Date.parse('2030-06-01T00:00:00.000Z');vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(now);
 g.state.matches=Array.from({length:500},(_,i)=>({id:id(100+i),seasonId:id(1),teamId:id(2),startsAt:new Date(now+(i-250)*86400000).toISOString(),endsAt:new Date(now+(i-250)*86400000+3600000).toISOString(),opponent:'Rival sintético',venue:'HOME',location:'Pista',competition:'Prueba',status:i<250?'FINAL':'SCHEDULED',scoreFor:i<250?60:null,scoreAgainst:i<250?50:null,published:i!==249,isExample:true}));
}
it('la portada limita resultados y próximos partidos; el archivo conserva todo el histórico',async()=>{
 matches();const dc=new FakeSqlConnect(g.state);g.dc=dc;
 const recent=await readPublicSlice(['matches'],{registration:false,matchView:'recent'});
 expect(recent.matches).toEqual(recentMatches(g.state.matches));expect(recent.matches).toHaveLength(RECENT_RESULTS_LIMIT+UPCOMING_MATCHES_LIMIT);
 const bytes=dc.metrics.bytesOut;dc.reset();const archive=await readPublicSlice(['matches'],{registration:false});
 expect(archive.matches).toHaveLength(499);expect(bytes).toBeLessThan(dc.metrics.bytesOut);
 expect(recent.matches.every(m=>m.published)).toBe(true);
});
it('la opción reciente funciona igual en el adaptador local sin mutar su estado',async()=>{
 matches();vi.stubEnv('CDIR_DATABASE','local');const all=g.state.matches.length;
 expect((await readPublicSlice(['matches'],{registration:false,matchView:'recent'})).matches).toEqual(recentMatches(g.state.matches));expect(g.state.matches).toHaveLength(all);
});
it('no comparte una respuesta reciente con consumidores del archivo completo',async()=>{
 matches();g.dc=new FakeSqlConnect(g.state);vi.stubEnv('PUBLIC_FEED_CACHE_SECONDS','30');
 const recent=await(await feedGet(new Request('http://localhost/api/public/club?sections=matches&matchView=recent'))).json();
 const archive=await(await feedGet(new Request('http://localhost/api/public/club?sections=matches'))).json();
 expect(recent.matches).toHaveLength(160);expect(archive.matches).toHaveLength(499);
});
