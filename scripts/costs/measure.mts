// Offline measurement of the actual API handlers. No credentials or .env files are loaded.
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {FakeSqlConnect} from '../../tests/support/fake-sql-connect';
import {syntheticClub,BASE,GROWTH,people,REFERENCE_NOW,sid} from '../../tests/support/synthetic-club';

const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
const output=path.resolve(process.argv[2]||'../_simulacion-costes-2026-11-15');
fs.mkdirSync(output,{recursive:true});
const scale=process.argv.includes('--growth')?'growth':'base';
const state=syntheticClub(scale==='growth'?GROWTH:BASE),who=people(state);
const g=globalThis as any;
const dc=new FakeSqlConnect(state);g.cdirCostDb=dc;
// Intercept both SDK access and credential setup before importing any server module.
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='server-only')return {url:'cdir-cost:empty',shortCircuit:true};
  if(specifier==='firebase-admin/data-connect')return {url:'cdir-cost:db',shortCircuit:true};
  const result=next(specifier,context);
  if(result.url.replaceAll('\\','/').endsWith('/src/server/firebase.ts'))return {url:'cdir-cost:firebase',shortCircuit:true};
  return result;
 },
 load(url,context,next){
  if(url==='cdir-cost:empty')return {format:'module',source:'export {};',shortCircuit:true};
  if(url==='cdir-cost:db')return {format:'module',source:'export const getDataConnect=()=>globalThis.cdirCostDb;',shortCircuit:true};
  if(url==='cdir-cost:firebase')return {format:'module',shortCircuit:true,source:`export const adminApp=()=>({}); export const storageBucket=()=>{throw Error('Storage disabled in offline simulation')}; export const serverAuth=()=>({verifyIdToken:async token=>{const [uid,email]=token.split('|');return {uid,email,email_verified:true,firebase:{sign_in_provider:'google.com'}}},getUser:async()=>({providerData:[]})});`};
  return next(url,context);
 }
});
globalThis.fetch=async()=>{throw Error('Network disabled in cost simulation');};
Object.assign(process.env,{CDIR_DATABASE:'sql-connect',FIREBASE_PROJECT_ID:'cdir-apps',APP_ORIGIN:'http://127.0.0.1:3002',PUBLIC_FEED_CACHE_SECONDS:'30',PUBLIC_REGISTRATION_ENABLED:'false'});
let bytesOut=0,bytesIn=0;
for(const method of ['executeGraphqlRead','executeGraphql'] as const){
 const original=dc[method].bind(dc);
 (dc as any)[method]=async(query:string,options:unknown)=>{
  bytesIn+=Buffer.byteLength(JSON.stringify({query,...options as object}));
  const result=await original(query,options as any);bytesOut+=Buffer.byteLength(JSON.stringify(result));return result;
 };
}
const api=await import('../../src/app/api/workspace/route');
const feed=await import('../../src/app/api/public/club/route');
const eventApi=await import('../../src/app/api/public/events/route');
const applicationApi=await import('../../src/app/api/public/applications/route');
const candidates=await import('../../src/app/api/requests/candidates/route');
const cache=await import('../../src/server/public-cache');
const origin=process.env.APP_ORIGIN!;
const get=(url:string,u?:{uid:string;email:string},etag?:string)=>new Request(origin+url,{headers:{...(u?{authorization:'Bearer '+u.uid+'|'+u.email}:{}),...(etag?{'if-none-match':etag}:{})}});
const post=(u:{uid:string;email:string}|null,body:unknown)=>new Request(origin+'/api/workspace',{method:'POST',headers:{origin,'content-type':'application/json',...(u?{authorization:'Bearer '+u.uid+'|'+u.email}:{})},body:JSON.stringify(body)});
const rows:any[]=[];
async function measure(id:string,run:()=>Promise<Response>,note=''){
 console.log('Measuring '+scale+': '+id);
 dc.reset();bytesIn=0;bytesOut=0;const t=performance.now();const response=await run();const body=await response.text();
 const row={id,status:response.status,dbReads:dc.metrics.reads,dbWrites:dc.metrics.mutations,dbOperations:dc.metrics.reads+dc.metrics.mutations,dbResponseBytes:bytesOut,dbRequestBytes:bytesIn,httpBodyBytes:Buffer.byteLength(body),localHandlerMs:Math.round(performance.now()-t),note};
 rows.push(row);if(![200,201,304,503].includes(response.status))throw Error(id+': '+response.status+' '+body.slice(0,160));
 return {response,body};
}
const season=who.current,admin=who.admin;
const competitive=(id:string)=>!['Escuelita','Babybasket'].includes(state.teams.find(t=>t.id===id)?.category||'Escuelita');
const coach=Array.from({length:(scale==='growth'?GROWTH:BASE).coaches},(_,i)=>who.coachMember(i)).find(u=>{
 const c=state.coaches.find(c=>c.email===u.email);return c&&state.coachTeams.some(t=>t.coachId===c.id&&t.seasonId===season.id&&t.function!=='FORMER'&&competitive(t.teamId));
})!;
const coachId=state.coaches.find(c=>c.email===coach.email)!.id;
const team=state.coachTeams.find(t=>t.coachId===coachId&&t.seasonId===season.id&&t.function!=='FORMER'&&competitive(t.teamId))!.teamId;
await measure('admin_workspace_first',()=>api.GET(get('/api/workspace?seasonId='+season.id,admin)),'Includes a possible one-off weekly retention reminder.');
await measure('admin_workspace',()=>api.GET(get('/api/workspace?seasonId='+season.id,admin)),'Repeated workspace load after retention reminder setup.');
await measure('coach_workspace',()=>api.GET(get('/api/workspace?seasonId='+season.id,coach)));
const session=state.sessions.find(s=>s.teamId===team&&s.status==='SCHEDULED'&&Date.parse(s.startsAt)<REFERENCE_NOW)!,player=state.playerSeasons.find(p=>p.teamId===team&&p.status==='ACTIVE')!;
await measure('attendance',()=>api.POST(post(coach,{action:'attendance',payload:{sessionId:session.id,playerSeasonId:player.id,status:'ABSENT'},seasonId:season.id})));
const match=state.matches.find(m=>m.teamId===team&&Date.parse(m.startsAt)<REFERENCE_NOW&&m.status!=='CANCELLED')!;
await measure('match_result',()=>api.POST(post(coach,{action:'matchResult',payload:{id:match.id,scoreFor:61,scoreAgainst:58},seasonId:season.id})));
const future=state.sessions.find(s=>s.teamId===team&&Date.parse(s.startsAt)>Date.now()+7*864e5)!;
if(future){
 await measure('request_players',()=>api.POST(post(coach,{action:'requestPlayers',payload:{teamId:team,kind:'TRAINING',sessionId:future.id,matchId:null,quantity:2,reason:'Synthetic measurement',recurring:false,proposedPlayerIds:[]},seasonId:season.id})));
 await measure('candidates',()=>candidates.GET(get('/api/requests/candidates?teamId='+team+'&kind=TRAINING&targetId='+future.id,coach)));
}
for(const [id,query] of [['home','sections=events,matches,magazines,activities&matchView=recent'],['calendar','sections=matches'],['magazines','sections=magazines']]){
 const url='/api/public/club?'+query;
 cache.invalidatePublicCache();
 const cold=await measure('public_'+id+'_cold',()=>feed.GET(get(url)));
 await measure('public_'+id+'_warm',()=>feed.GET(get(url)));
 await measure('public_'+id+'_304',()=>feed.GET(get(url,undefined,cold.response.headers.get('etag')!)));
 const originalNow=Date.now;const later=originalNow()+6000;
 try{Date.now=()=>later;await measure('public_'+id+'_revision',()=>feed.GET(get(url)));}finally{Date.now=originalNow;}
}
await measure('public_event_detail',()=>eventApi.GET(get('/api/public/events')));
await measure('public_registration_disabled',()=>applicationApi.POST(post(null,{})),'Current production flag: no application is saved.');
// Future feature projection only: turn on registration in this isolated process and synthetic memory.
process.env.PUBLIC_REGISTRATION_ENABLED='true';
cache.invalidatePublicCache();
await measure('public_home_registration_cold',()=>feed.GET(get('/api/public/club?sections=events,matches,magazines,activities&matchView=recent')),'Projected public feed with registration flag enabled, in memory only.');
const event=dc.tables.ClubEvent.find((e:any)=>e.seasonId===season.id)!;
Object.assign(event,{status:'PUBLISHED',registrationOpen:true,capacity:10000,startsAt:new Date(Date.now()+90*864e5).toISOString(),endsAt:new Date(Date.now()+91*864e5).toISOString()});
const form=state.forms.find(f=>f.id===event.formId)!;
const answers=Object.fromEntries(form.fields.map(f=>[f.key,'Synthetic answer']));
await measure('registration_future',()=>applicationApi.POST(post(null,{eventId:event.id,name:'Persona Ficticia Prueba',birthDate:'2014-01-01',email:'simulation@example.invalid',phone:'600000000',requestKey:sid('costRequest',1),privacyAccepted:true,privacyVersion:'v1',imageConsent:false,answers})),'Future enabled API; the public frontend still only demonstrates submission.');
const {prototypeRegistration}=await import('./scoped-registration.mts');
await measure('registration_prototype',()=>prototypeRegistration({eventId:event.id,name:'Otra Persona Ficticia',birthDate:'2014-01-01',email:'other@example.invalid',phone:'600000000',requestKey:sid('costRequest',2),privacyAccepted:true,privacyVersion:'v1',imageConsent:false,answers}),'Isolated experimental narrow transaction, not a production change.');
// Exercise actual chunking and document API using a synthetic payload, never real club files.
const {saveMagazinePdf}=await import('../../src/server/magazine-storage');
const pdfApi=await import('../../src/app/api/public/magazines/[id]/pdf/route');
const pdf=Buffer.alloc(20*1024*1024);pdf.write('%PDF-1.4\n');let magazineId='';
await measure('pdf_upload_20MiB',async()=>{magazineId=await saveMagazinePdf(dc as any,admin as any,pdf,'Revista sintetica','Only payload transfer is measured');return Response.json({ok:true});},'Synthetic bytes: not a rendered or visually validated PDF. All uploaded parts are in memory.');
(dc.tables.Magazine.find(m=>m.id===magazineId) as any).published=true;
const downloaded=await measure('pdf_download_20MiB',()=>pdfApi.GET(get('/api/public/magazines/'+magazineId+'/pdf'),{params:Promise.resolve({id:magazineId})}));
await measure('pdf_304_20MiB',()=>pdfApi.GET(get('/api/public/magazines/'+magazineId+'/pdf',undefined,downloaded.response.headers.get('etag')!),{params:Promise.resolve({id:magazineId})}));
const digest=createHash('sha256');
function hashDir(dir:string){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isDirectory())hashDir(p);else if(/\.(ts|tsx|json)$/.test(p)){digest.update(path.relative(root,p));digest.update(fs.readFileSync(p));}}}
hashDir(path.join(root,'src'));
const result={date:new Date().toISOString(),mode:'OFFLINE_ACTUAL_HANDLERS_SYNTHETIC_DB',scale,sourceSha256:digest.digest('hex'),dataset:{players:state.players.length,teamsCurrentSeason:state.teams.filter(t=>t.seasonId===season.id).length,seasons:state.seasons.length,staffAccounts:state.members.length},limitations:['No real SQL execution, network, database plans, billed CPU, concurrency or real cloud latency measured.','GraphQL operations and UTF-8 JSON sizes measured at the SDK boundary. All writes are in synthetic memory.','Current public forms do not submit. registration_future is a deliberately enabled isolated projection.'],results:rows};
fs.writeFileSync(path.join(output,'measurements-'+scale+'.json'),JSON.stringify(result,null,2));
console.table(rows.map(({id,status,dbOperations,dbResponseBytes})=>({id,status,dbOperations,dbResponseBytes})));
