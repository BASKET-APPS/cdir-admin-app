// Varias instancias: una escritura hecha en OTRA instancia no vacía esta caché local, pero la revisión
// global la invalida como máximo tras PUBLIC_FEED_REVISION_CHECK_SECONDS (5 s). Simulador de SQL Connect.
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {syntheticClub,REFERENCE_NOW} from '../support/synthetic-club';
import {FakeSqlConnect} from '../support/fake-sql-connect';
const g=vi.hoisted(()=>({dc:null as unknown}));
vi.mock('firebase-admin/data-connect',()=>({getDataConnect:()=>g.dc}));
vi.mock('@/server/firebase',()=>({adminApp:()=>({}),storageBucket:()=>({}),serverAuth:()=>({})}));
import {GET} from '@/app/api/public/club/route';
import {invalidatePublicCache} from '@/server/public-cache';
const base=syntheticClub();
beforeEach(()=>{vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(REFERENCE_NOW);vi.stubEnv('CDIR_DATABASE','sql-connect');vi.stubEnv('FIREBASE_PROJECT_ID','cdir-apps');delete process.env.PUBLIC_FEED_CACHE_SECONDS;invalidatePublicCache();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();});
const feed=async()=>(await GET(new Request('http://127.0.0.1:3002/api/public/club?sections=magazines'))).json();
/** Simulates a write committed by another server instance (bumps the revision, no local invalidation). */
function otherInstanceWithdraws(dc:FakeSqlConnect,id:string){(dc.tables.Magazine as {id:string;published:boolean}[]).find(m=>m.id===id)!.published=false;dc.revision++;}
it('otra instancia retira una revista: aquí se refleja en ≤ 5 s y sin releer el feed mientras no cambie nada',async()=>{
 const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;const first=await feed(),id=first.magazines[0].id;
 dc.reset();await feed();expect(dc.metrics.reads).toBe(0);
 vi.setSystemTime(REFERENCE_NOW+6000);dc.reset();await feed();expect(dc.metrics.operations).toEqual(['R Revision']);
 otherInstanceWithdraws(dc,id);
 vi.setSystemTime(REFERENCE_NOW+8000);expect((await feed()).magazines.map((m:{id:string})=>m.id)).toContain(id);
 vi.setSystemTime(REFERENCE_NOW+12000);expect((await feed()).magazines.map((m:{id:string})=>m.id)).not.toContain(id);
});
it('una escritura en esta instancia se refleja inmediatamente',async()=>{
 const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;const id=(await feed()).magazines[0].id;
 otherInstanceWithdraws(dc,id);invalidatePublicCache();expect((await feed()).magazines.map((m:{id:string})=>m.id)).not.toContain(id);
});
it('diez visitas simultáneas comparten tanto la revisión inicial como la revalidación',async()=>{
 const dc=new FakeSqlConnect(structuredClone(base));g.dc=dc;
 await Promise.all(Array.from({length:10},()=>feed()));
 expect(dc.metrics.operations).toEqual(['R Revision','R PublicSlice']);
 vi.setSystemTime(REFERENCE_NOW+6000);dc.reset();
 await Promise.all(Array.from({length:10},()=>feed()));expect(dc.metrics.operations).toEqual(['R Revision']);
 otherInstanceWithdraws(dc,base.magazines.find(m=>m.published)!.id);
 vi.setSystemTime(REFERENCE_NOW+12000);dc.reset();
 await Promise.all(Array.from({length:10},()=>feed()));expect(dc.metrics.operations).toEqual(['R Revision','R PublicSlice']);
});
it('las cabeceras limitan la copia compartida a 15 s (+15 s mientras se refresca)',async()=>{g.dc=new FakeSqlConnect(structuredClone(base));const r=await GET(new Request('http://127.0.0.1:3002/api/public/club'));expect(r.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=15, stale-while-revalidate=15');});
it('feed con el club sintético completo: solo publicado y solo campos públicos',async()=>{
 const s=structuredClone(base);s.events[0].status='DRAFT';const dc=new FakeSqlConnect(s);g.dc=dc;vi.stubEnv('PUBLIC_FEED_CACHE_SECONDS','0');
 const body=await(await GET(new Request('http://127.0.0.1:3002/api/public/club'))).json();
 expect(Object.keys(body).sort()).toEqual(['activities','events','magazines','matches']);
 expect(body.matches.length).toBe(s.matches.filter(m=>m.published).length);expect(body.magazines.length).toBe(s.magazines.filter(m=>m.published).length);
 expect(body.events.map((e:{id:string})=>e.id)).not.toContain(s.events[0].id);expect(body.events.length).toBe(s.events.filter(e=>e.status==='PUBLISHED').length);
 const text=JSON.stringify(body);for(const p of s.players.slice(0,50))expect(text).not.toContain(p.name);for(const gd of s.guardians.slice(0,50))expect(text).not.toContain(gd.email);expect(text).not.toMatch(/@example\.invalid|ibanEncrypted|holderDocument|avatarPath|uid-sintetico/);
 expect(dc.metrics.operations.every(o=>o==='R PublicSlice')).toBe(true);
});
